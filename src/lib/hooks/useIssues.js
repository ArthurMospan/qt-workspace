'use client';

// src/lib/hooks/useIssues.js — CRUD for issues collection with audit logging
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, deleteField, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import { createIssueViaApi } from '@/lib/services/issues';
import { reportLoadError } from '@/lib/utils/errors';
import { statusLabel } from '@/lib/utils/workflowDefaults.mjs';
import { compareIssues, pickPatchableFields, planMove } from '@/lib/utils/optimistic.mjs';

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
    activeOrgId, currentUser
  } = useAppContext();
  const { doneStatusIds, statuses } = useWorkflowConfig();
  const [snapshotIssues, setSnapshotIssues] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
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
      queueMicrotask(() => {
        setSnapshotIssues([]);
        setIssueLinks([]);
        setError(null);
        setLoading(false);
      });
      return;
    }

    if (targetChanged) {
      queueMicrotask(() => {
        setSnapshotIssues([]);
        setIssueLinks([]);
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
      const lq = query(collection(db, 'issueLinks'), where('organizationId', '==', activeOrgId));
      unsubLinks = onSnapshot(lq, { serverTimestamps: 'estimate' }, snap => {
        setIssueLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => {
        reportLoadError('[useIssues] links', err);
      });
    }

    return () => { unsub(); unsubLinks(); };
  }, [projectId, activeOrgId, includeLinks, currentUserId]);

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

    // Step 4: Notify assignees who didn't create the task themselves
    const notifyIds = (data.assigneeIds || []).filter(uid => uid && uid !== userId);
    if (notifyIds.length) {
      sendNotification({
        userIds: notifyIds,
        type: 'assigned',
        title: `${userName || 'Колега'} призначив вам нове завдання`,
        body: data.title || '',
        link: `/${projectId}/issue/${result.id}`,
        issueId: result.id,
        projectId,
        organizationId: activeOrgId,
        // No `actor` here: /api/notifications resolves the sender from the
        // verified ID token. Passing one was silently discarded.
      }).catch(() => {});
    }
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

    // Mirror board-position fields locally right away. Backlog and sprint views
    // drag cards by writing sprintId/assigneeIds through here, and without the
    // overlay the card springs back until the round-trip completes.
    const optimistic = pickPatchableFields(data);
    if (optimistic) applyPatch({ [issueId]: optimistic });

    try {
      await updateDoc(doc(db, 'issues', issueId), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      if (optimistic) revertPatch([issueId]);
      throw err;
    }

    // Touch parent project
    await updateDoc(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp()
    }).catch(() => {});

    // Write audit for notable field changes. Arrays are compared by VALUE —
    // comparing them by reference logged a "changed_assigneeIds" entry on every
    // single save, because a fresh array is never `===` the stored one.
    const auditFields = ['status', 'priority', 'title', 'columnId', 'assigneeIds'];
    for (const field of auditFields) {
      if (data[field] === undefined || !current) continue;
      const from = auditValue(current[field]);
      const to = auditValue(data[field]);
      if (from === to) continue;
      await writeAudit(issueId, {
        userId,
        userName,
        action: `changed_${field}`,
        from,
        to
      });
    }
  }, [issues, projectId, applyPatch, revertPatch]);

  // -------------------------------------------------------------------------
  // deleteIssue
  // -------------------------------------------------------------------------
  const deleteIssue = useCallback(async issueId => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не вдалося видалити задачу');
  }, []);

  // -------------------------------------------------------------------------
  // moveIssue — batch reorder + columnId/status update + audit
  //   Guards:
  //     - 'done': blocks if open subtasks exist
  //   Side-effects:
  //     - 'client-approval': sets clientApprovalPending on linked stage
  // -------------------------------------------------------------------------
  const moveIssue = useCallback(async (issueId, newColumnId, newOrder, actorUser = {}) => {
    const {
      userId,
      userName
    } = actorUser;
    const issue = issues.find(i => i.id === issueId);
    if (!issue) throw new Error('Issue not found');

    // Guard: cannot move to a terminal status if open subtasks exist
    if (doneStatusIds.includes(newColumnId)) {
      const hasOpenSubtasks = issue.subtasks?.some(s => !s.done);
      if (hasOpenSubtasks) {
        throw new Error('Є незакриті підзавдання');
      }
    }
    const oldColumnId = issue.columnId;

    // One plan drives both the repaint and the writes, so the overlay retires
    // the moment Firestore echoes back instead of disagreeing with it. Cards
    // whose position is unchanged are left out — no repaint, no write.
    const plan = planMove(issues, issueId, newColumnId, newOrder);
    if (!plan) throw new Error('Issue not found');

    // Paint first: @hello-pangea/dnd animates the card into the list as it
    // stands when the drag ends, so the destination slot has to exist by now.
    applyPatch(plan.patches);

    try {
      const batch = writeBatch(db);

      // `subtasks` is deliberately NOT written here: echoing back our local copy
      // overwrote whatever a colleague had just ticked off, and moving a card
      // never changes its subtasks anyway.
      for (const [id, patch] of Object.entries(plan.patches)) {
        const updates = { ...patch, updatedAt: serverTimestamp() };
        if (id === issueId) {
          const wasDone = doneStatusIds.includes(oldColumnId);
          const willBeDone = doneStatusIds.includes(newColumnId);
          if (willBeDone && !wasDone) updates.completedAt = serverTimestamp();
          if (!willBeDone && wasDone) updates.completedAt = deleteField();
        }
        batch.update(doc(db, 'issues', id), updates);
      }

      // Touch parent project in the same batch
      batch.update(doc(db, 'projects', projectId), {
        updatedAt: serverTimestamp()
      });

      await batch.commit();
    } catch (err) {
      revertPatch(Object.keys(plan.patches));
      throw err;
    }

    // Audit
    await writeAudit(issueId, {
      userId,
      userName,
      action: 'moved',
      from: oldColumnId,
      to: newColumnId
    });

    // Notify assignees + watchers about the status change (skip same-column reorders and the actor)
    if (oldColumnId !== newColumnId) {
      const recipients = [...new Set([...(issue.assigneeIds || []), ...(issue.watcherIds || [])])]
        .filter(uid => uid && uid !== userId);
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
  }, [activeOrgId, issues, projectId, doneStatusIds, statuses, applyPatch, revertPatch]);
  return {
    issues,
    issueLinks,
    loading,
    error,
    createIssue,
    updateIssue,
    deleteIssue,
    moveIssue
  };
}
