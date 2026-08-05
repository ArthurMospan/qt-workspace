'use client';

// src/lib/hooks/useIssues.js — CRUD for issues collection with audit logging
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import {
  createIssueViaApi,
  notifyIssueAssigned,
  transitionIssueStatusViaApi,
} from '@/lib/services/issues';
import { createResponseError, reportLoadError } from '@/lib/utils/errors';
import { statusLabel } from '@/lib/utils/workflowDefaults.mjs';
import { issueCompletionBlockers } from '@/lib/utils/issueExecution.mjs';
import { issueParticipants } from '@/lib/utils/issueParticipants.mjs';
import { compareIssues, pickPatchableFields, planDrop } from '@/lib/utils/optimistic.mjs';

// Stable string form of an audited field, so array values compare by content
// rather than by identity. Order-insensitive for arrays: reordering assignees
// is not a change worth an activity entry.
function auditValue(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].map(String).sort());
  return String(value ?? '');
}

// ---------------------------------------------------------------------------
// Helper — write an audit log entry to issues/{issueId}/audit subcollection
// ---------------------------------------------------------------------------
async function writeAudit(issueId, {
  userId,
  userName,
  action,
  from,
  to
}) {
  try {
    await addDoc(collection(db, 'issues', issueId, 'audit'), {
      userId: userId || null,
      userName: userName || null,
      action,
      from: from ?? null,
      to: to ?? null,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[useIssues] audit write failed', err);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useIssues(projectId, { includeLinks = true } = {}) {
  const {
    activeOrgId, currentUser, authLoading, orgLoading
  } = useAppContext();
  const { closedStatusIds, statuses } = useWorkflowConfig();
  const [snapshotIssues, setSnapshotIssues] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [linksReady, setLinksReady] = useState(!includeLinks);
  const [linksError, setLinksError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // A drag & drop is painted from this overlay until Firestore echoes it back.
  const [issues, applyPatch, revertPatch] = useOptimisticPatch(snapshotIssues, compareIssues);
  const deliveredRef = useRef(false);
  // Depend on the uid, not on the `currentUser` object: the profile listener
  // hands back a fresh object whenever anything on the user document changes,
  // and that identity churn used to tear down and rebuild this subscription.
  const currentUserId = currentUser?.uid || currentUser?.id || null;
  // Which query the rows on screen belong to. Re-running the effect for the
  // same project must not blank them — the board renders a spinner while
  // `loading` is true, so clearing on every re-subscribe is exactly the
  // "board reloaded itself" flash. Rows are only stale once the target moves.
  const targetRef = useRef(null);
  useEffect(() => {
    const target = `${activeOrgId || ''}/${projectId || ''}`;
    const targetChanged = targetRef.current !== target;
    targetRef.current = target;
    if (targetChanged) deliveredRef.current = false;
    if (!projectId || !activeOrgId || !currentUserId) {
      // Nothing was subscribed, so the next run has to count as a fresh target
      // however it is reached — otherwise the run that finally has a uid would
      // skip the reset below and render an empty board instead of a spinner.
      targetRef.current = null;
      deliveredRef.current = false;
      // "Nothing was asked" is not "nothing was found". On a page refresh the
      // uid and the organization arrive a beat after the first render, and
      // reporting `loading: false` with an empty list there is what made the
      // task page flash «Задачу не знайдено» for a second before the task
      // appeared. While auth or the organization is still resolving the honest
      // answer is that we are still loading; only a caller with no project at
      // all has genuinely finished with nothing.
      const stillResolving = authLoading || orgLoading || !currentUserId || !activeOrgId;
      queueMicrotask(() => {
        setSnapshotIssues([]);
        setIssueLinks([]);
        setLinksReady(!includeLinks);
        setLinksError(null);
        setError(null);
        setLoading(Boolean(projectId) && stillResolving);
      });
      return;
    }

    if (targetChanged) {
      queueMicrotask(() => {
        setSnapshotIssues([]);
        setIssueLinks([]);
        setLinksReady(!includeLinks);
        setLinksError(null);
        setError(null);
        setLoading(true);
      });
    }

    // No orderBy — sorted client-side to avoid composite index
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, {
      // Needed so an empty project still leaves the loading state once the
      // server confirms it really is empty (a metadata-only transition).
      includeMetadataChanges: true,
    }, snap => {
      // An empty cache is not proof that a task was deleted. While Firestore is
      // offline or quota-blocked, wait for a server result (or the error callback)
      // instead of flashing the destructive "task not found" state.
      if (snap.empty && snap.metadata.fromCache) {
        setError(null);
        setLoading(true);
        return;
      }
      // Metadata-only event — typically the server acknowledging a write we
      // already applied locally. The documents are identical to what is on
      // screen, so publishing a fresh array would re-render every card for
      // nothing; mid drop-animation that repaint is exactly the visible blink.
      if (deliveredRef.current && snap.docChanges().length === 0) {
        setError(null);
        setLoading(false);
        return;
      }
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' })
      }));
      // Sort client-side by order ASC, fallback to createdAt asc
      docs.sort(compareIssues);
      deliveredRef.current = true;
      setSnapshotIssues(docs);
      setError(null);
      setLoading(false);
    }, err => {
      reportLoadError('[useIssues]', err);
      setError(err);
      setLoading(false);
    });

    let unsubLinks = () => {};
    if (includeLinks) {
      // Scoped to this project, like the issue stream above. Links never cross
      // projects, and an organization-wide link query is rejected outright:
      // Firestore evaluates the read rule per document, so a single link in a
      // project this user cannot open fails the whole query.
      const lq = query(
        collection(db, 'issueLinks'),
        where('organizationId', '==', activeOrgId),
        where('projectId', '==', projectId),
      );
      unsubLinks = onSnapshot(lq, { serverTimestamps: 'estimate' }, snap => {
        setIssueLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLinksReady(true);
        setLinksError(null);
      }, err => {
        reportLoadError('[useIssues] links', err);
        setLinksReady(false);
        setLinksError(err);
      });
    }

    return () => { unsub(); unsubLinks(); };
  }, [projectId, activeOrgId, includeLinks, currentUserId, authLoading, orgLoading]);

  // -------------------------------------------------------------------------
  // createIssue — atomic issueCounter increment + addDoc + audit
  // -------------------------------------------------------------------------
  const createIssue = useCallback(async (data, actorUser = {}) => {
    const {
      userId,
      userName
    } = actorUser;
    const orgId = activeOrgId;
    if (!orgId || !projectId) throw new Error('Organization and project are required');
    const result = await createIssueViaApi({
      organizationId: orgId,
      projectId,
      data: {
        ...data,
        status: data.columnId || data.status || 'backlog',
        assigneeIds: data.assigneeIds || (userId ? [userId] : []),
        reporterId: data.reporterId || userId || null,
      },
    });

    // Step 4: Notify assignees who didn't create the task themselves. Said the
    // same way by every composer, so it cannot go out from one and not another.
    // No `actor` is passed: /api/notifications resolves the sender from the
    // verified ID token, and passing one was silently discarded.
    notifyIssueAssigned({
      issueId: result.id,
      title: data.title,
      assigneeIds: data.assigneeIds || [],
      actorId: userId,
      actorName: userName,
      projectId,
      organizationId: activeOrgId,
    });
    return {
      id: result.id,
      issueKey: result.issueKey
    };
  }, [projectId, activeOrgId]);

  // -------------------------------------------------------------------------
  // updateIssue — updateDoc + conditional audit for key field changes
  // -------------------------------------------------------------------------
  const updateIssue = useCallback(async (issueId, data, actorUser = {}) => {
    const {
      userId,
      userName
    } = actorUser;

    // Find current issue for diff
    const current = issues.find(i => i.id === issueId);

    const hasStatusUpdate = data.status !== undefined || data.columnId !== undefined;
    if (
      data.status !== undefined
      && data.columnId !== undefined
      && data.status !== data.columnId
    ) {
      throw new Error('Статус і колонка задачі мають збігатися');
    }
    if (data.completedAt !== undefined && !hasStatusUpdate) {
      throw new Error('Дата завершення керується статусом задачі');
    }
    const requestedStatus = data.columnId ?? data.status;
    const directData = { ...data };
    delete directData.status;
    delete directData.columnId;
    delete directData.completedAt;
    if (hasStatusUpdate) delete directData.order;

    // Mirror board-position fields locally right away. Backlog and sprint views
    // drag cards by writing sprintId/assigneeIds through here, and without the
    // overlay the card springs back until the round-trip completes.
    const optimistic = pickPatchableFields(data);
    if (optimistic) applyPatch({ [issueId]: optimistic });

    try {
      if (hasStatusUpdate) {
        await transitionIssueStatusViaApi({
          issueId,
          status: requestedStatus,
          ...(data.order !== undefined ? { order: data.order } : {}),
        });
      }
      if (Object.keys(directData).length > 0) {
        const actorId = userId || currentUserId;
        await updateDoc(doc(db, 'issues', issueId), {
          ...directData,
          updatedAt: serverTimestamp(),
          lastActivityType: 'updated',
          lastActivityAt: serverTimestamp(),
          lastActivityActorId: actorId || null,
          lastActivityActorName: userName || currentUser?.name || currentUser?.displayName || currentUser?.email || '',
          lastActivityActorAvatar: currentUser?.avatar || currentUser?.photoURL || null,
        });
      }
    } catch (err) {
      if (optimistic) revertPatch([issueId]);
      throw err;
    }

    // Touch parent project
    if (Object.keys(directData).length > 0) {
      await updateDoc(doc(db, 'projects', projectId), {
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }

    // Write audit for notable field changes. Arrays are compared by VALUE —
    // comparing them by reference logged a "changed_assigneeIds" entry on every
    // single save, because a fresh array is never `===` the stored one.
    const auditFields = ['priority', 'title', 'assigneeIds'];
    for (const field of auditFields) {
      if (directData[field] === undefined || !current) continue;
      const from = auditValue(current[field]);
      const to = auditValue(directData[field]);
      if (from === to) continue;
      await writeAudit(issueId, {
        userId,
        userName,
        action: `changed_${field}`,
        from,
        to
      });
    }
  }, [issues, projectId, applyPatch, revertPatch, currentUser, currentUserId]);

  // -------------------------------------------------------------------------
  // deleteIssue
  // -------------------------------------------------------------------------
  const deleteIssue = useCallback(async (issueId, { childPolicy } = {}) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const policyQuery = childPolicy ? `?childPolicy=${encodeURIComponent(childPolicy)}` : '';
    const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}${policyQuery}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) {
      throw createResponseError(response, result, 'Не вдалося видалити задачу');
    }
    return result;
  }, []);

  const restoreIssue = useCallback(async (issueId, organizationId) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}/restore`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw createResponseError(response, result, 'Не вдалося відновити задачу');
    }
    return result;
  }, []);

  // Hierarchy writes go through the authenticated server route, which validates
  // same-project scope and the one-level invariant transactionally.
  const setIssueParent = useCallback(async (issueId, parentIssueId) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    applyPatch({ [issueId]: { parentIssueId: parentIssueId || null } });
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}/parent`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parentIssueId: parentIssueId || null }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw createResponseError(response, result, 'Не вдалося змінити основну задачу');
      }
      return result;
    } catch (error) {
      revertPatch([issueId]);
      throw error;
    }
  }, [applyPatch, revertPatch]);

  // -------------------------------------------------------------------------
  // moveIssue — batch reorder + columnId/status update + audit
  //   Guards:
  //     - terminal statuses: block while real child issues remain open
  //   Side-effects:
  //     - 'client-approval': sets clientApprovalPending on linked stage
  // -------------------------------------------------------------------------
  const moveIssue = useCallback(async (issueId, newColumnId, position, actorUser = {}) => {
    const { userId } = actorUser;
    const issue = issues.find(i => i.id === issueId);
    if (!issue) throw new Error('Issue not found');

    // A parent is a roll-up container, so closing it while a real child issue is
    // still open would make the hierarchy contradict the board and analytics.
    // Description checkboxes and legacy `subtasks[]` are lightweight checklist
    // items and deliberately do not participate in this guard.
    if (closedStatusIds.includes(newColumnId)) {
      if (includeLinks && !linksReady) {
        throw new Error(linksError
          ? 'Не вдалося перевірити залежності. Оновіть сторінку й повторіть.'
          : 'Зачекайте, перевіряємо залежності задачі');
      }
      const blockers = issueCompletionBlockers({
        issueId,
        issues,
        issueLinks,
        closedStatusIds,
      });
      if (blockers.children.length > 0) {
        throw new Error(`Спершу закрийте підзадачі: ${blockers.children.length} ще в роботі`);
      }
      if (blockers.dependencies.length > 0) {
        const names = blockers.dependencies
          .slice(0, 2)
          .map(blocker => blocker.issueKey || blocker.title)
          .filter(Boolean)
          .join(', ');
        throw new Error(`Задачу ще блокують: ${names || blockers.dependencies.length}`);
      }
    }
    const oldColumnId = issue.columnId || issue.status;

    // One plan drives both the repaint and the writes, so the overlay retires
    // the moment Firestore echoes back instead of disagreeing with it. Cards
    // whose position is unchanged are left out — no repaint, no write.
    const plan = planDrop(issues, issueId, newColumnId, position);
    if (!plan) throw new Error('Issue not found');

    // Paint first: @hello-pangea/dnd animates the card into the list as it
    // stands when the drag ends, so the destination slot has to exist by now.
    applyPatch(plan.patches);

    try {
      const movedPatch = plan.patches[issueId] || {};
      const orderUpdates = Object.entries(plan.patches)
        .filter(([, patch]) => patch.order !== undefined)
        .map(([id, patch]) => ({ issueId: id, order: patch.order }));
      await transitionIssueStatusViaApi({
        issueId,
        status: newColumnId,
        order: movedPatch.order,
        orderUpdates,
      });
    } catch (err) {
      revertPatch(Object.keys(plan.patches));
      throw err;
    }

    // Tell the task's participants it moved (same-column reorders are not a
    // status change and notify nobody). Shared rule, so the person who opened
    // the task is included — they used to be the one party never told.
    if (oldColumnId !== newColumnId) {
      const recipients = issueParticipants(issue, { actorId: userId });
      if (recipients.length) {
        sendNotification({
          userIds: recipients,
          type: 'status_changed',
          title: `${issue.issueKey || 'Задача'}: статус змінено`,
          body: `${issue.title || ''} → ${statusLabel(newColumnId, statuses)}`,
          link: `/${projectId}/issue/${issueId}`,
          issueId,
          projectId,
          organizationId: activeOrgId,
        }).catch(() => {});
      }
    }

    // Side-effect: if moved to client-approval and has a linked stage, mark it
    if (newColumnId === 'client-approval' && issue.linkedClientMaterialId) {
      try {
        await updateDoc(doc(db, 'stages', issue.linkedClientMaterialId), {
          clientApprovalPending: true,
          clientApprovalRequestedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('[useIssues] could not update stage clientApprovalPending', err);
      }
    }
  }, [activeOrgId, includeLinks, issues, issueLinks, linksError, linksReady, projectId, closedStatusIds, statuses, applyPatch, revertPatch]);
  return {
    issues,
    issueLinks,
    linksLoading: includeLinks && !linksReady && !linksError,
    linksError,
    loading,
    error,
    createIssue,
    updateIssue,
    setIssueParent,
    deleteIssue,
    restoreIssue,
    moveIssue
  };
}
