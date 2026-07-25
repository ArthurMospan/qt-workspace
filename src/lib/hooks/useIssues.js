'use client';

// src/lib/hooks/useIssues.js — CRUD for issues collection with audit logging
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, deleteField, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { createIssueViaApi } from '@/lib/services/issues';
import { reportLoadError } from '@/lib/utils/errors';
import { statusLabel } from '@/lib/utils/workflowDefaults.mjs';

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
  const [issues, setIssues] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!projectId || !activeOrgId || !currentUser) {
      queueMicrotask(() => {
        setIssues([]);
        setIssueLinks([]);
        setError(null);
        setLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      setIssues([]);
      setIssueLinks([]);
      setError(null);
      setLoading(true);
    });

    // No orderBy — sorted client-side to avoid composite index
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, {
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
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' })
      }));
      // Sort client-side by order ASC, fallback to createdAt asc
      docs.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setIssues(docs);
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
  }, [projectId, activeOrgId, includeLinks, currentUser]);

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
    await updateDoc(doc(db, 'issues', issueId), {
      ...data,
      updatedAt: serverTimestamp()
    });

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
  }, [issues, projectId]);

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
    const batch = writeBatch(db);

    // Reorder destination column (exclude the moving issue)
    const destIssues = issues.filter(i => i.id !== issueId && i.columnId === newColumnId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Insert moving issue at target position
    destIssues.splice(Math.max(0, newOrder), 0, {
      id: issueId
    });
    destIssues.forEach((i, idx) => {
      batch.update(doc(db, 'issues', i.id), {
        order: idx,
        updatedAt: serverTimestamp()
      });
    });

    // Update the moved issue itself. `subtasks` is deliberately NOT written
    // here: echoing back our local copy overwrote whatever a colleague had
    // just ticked off, and moving a card never changes its subtasks anyway.
    const movedIssueUpdates = {
      columnId: newColumnId,
      status: newColumnId,
      order: Math.max(0, newOrder),
      updatedAt: serverTimestamp()
    };
    const wasDone = doneStatusIds.includes(oldColumnId);
    const willBeDone = doneStatusIds.includes(newColumnId);
    if (willBeDone && !wasDone) movedIssueUpdates.completedAt = serverTimestamp();
    if (!willBeDone && wasDone) movedIssueUpdates.completedAt = deleteField();
    batch.update(doc(db, 'issues', issueId), movedIssueUpdates);

    // Touch parent project in the same batch
    batch.update(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp()
    });

    await batch.commit();

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
  }, [activeOrgId, issues, projectId, doneStatusIds, statuses]);
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
