'use client';
// src/lib/hooks/useIssues.js — CRUD for issues collection with audit logging
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, writeBatch, runTransaction,
} from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Helper — write an audit log entry to issues/{issueId}/audit subcollection
// ---------------------------------------------------------------------------
async function writeAudit(issueId, { userId, userName, action, from, to }) {
  try {
    await addDoc(collection(db, 'issues', issueId, 'audit'), {
      userId: userId || null,
      userName: userName || null,
      action,
      from: from ?? null,
      to: to ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[useIssues] audit write failed', err);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useIssues(projectId) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    // No orderBy — sorted client-side to avoid composite index
    const q = query(
      collection(db, 'issues'),
      where('organizationId', '==', ORG_ID),
      where('projectId', '==', projectId),
    );

    const unsub = onSnapshot(q, { serverTimestamps: 'estimate' }, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side by order ASC, fallback to createdAt asc
      docs.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setIssues(docs);
      setLoading(false);
    }, (err) => {
      console.error('[useIssues] onSnapshot error', err);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId]);

  // -------------------------------------------------------------------------
  // createIssue — atomic issueCounter increment + addDoc + audit
  // -------------------------------------------------------------------------
  const createIssue = useCallback(async (data, actorUser = {}) => {
    const { userId, userName } = actorUser;
    const projectRef = doc(db, 'projects', projectId);

    // Use runTransaction to safely increment the counter and get issueKey
    const { issueKey } = await runTransaction(db, async (tx) => {
      const projectSnap = await tx.get(projectRef);
      if (!projectSnap.exists()) throw new Error('Project not found');

      const current = projectSnap.data().issueCounter ?? 0;
      const next = current + 1;
      tx.update(projectRef, { issueCounter: next });
      return { issueKey: `QT-${next}` };
    });

    // Count issues in target column to determine order
    const colId = data.columnId || data.status || 'backlog';
    const orderVal = issues.filter(i => i.columnId === colId).length;

    const newIssueRef = await addDoc(collection(db, 'issues'), {
      issueKey,
      projectId,
      organizationId: ORG_ID,
      title: data.title || '',
      description: data.description || '',
      type: data.type || 'task',
      columnId: colId,
      status: colId,
      priority: data.priority || 'medium',
      assigneeIds: data.assigneeIds || [],
      reporterId: data.reporterId || userId || null,
      order: orderVal,
      estimateMinutes: data.estimateMinutes ?? null,
      dueDate: data.dueDate || null,
      linkedClientMaterialId: data.linkedClientMaterialId || null,
      clientVisibility: data.clientVisibility ?? false,
      subtasks: data.subtasks || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Audit: issue created
    await writeAudit(newIssueRef.id, {
      userId,
      userName,
      action: 'created',
      from: null,
      to: issueKey,
    });

    return { id: newIssueRef.id, issueKey };
  }, [projectId, issues]);

  // -------------------------------------------------------------------------
  // updateIssue — updateDoc + conditional audit for key field changes
  // -------------------------------------------------------------------------
  const updateIssue = useCallback(async (issueId, data, actorUser = {}) => {
    const { userId, userName } = actorUser;

    // Find current issue for diff
    const current = issues.find(i => i.id === issueId);

    await updateDoc(doc(db, 'issues', issueId), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    // Write audit for notable field changes
    const auditFields = ['status', 'priority', 'title', 'columnId', 'assigneeIds'];
    for (const field of auditFields) {
      if (data[field] !== undefined && current && data[field] !== current[field]) {
        const from = Array.isArray(current[field])
          ? JSON.stringify(current[field])
          : String(current[field] ?? '');
        const to = Array.isArray(data[field])
          ? JSON.stringify(data[field])
          : String(data[field] ?? '');
        await writeAudit(issueId, { userId, userName, action: `changed_${field}`, from, to });
      }
    }
  }, [issues]);

  // -------------------------------------------------------------------------
  // deleteIssue
  // -------------------------------------------------------------------------
  const deleteIssue = useCallback(async (issueId) => {
    await deleteDoc(doc(db, 'issues', issueId));
  }, []);

  // -------------------------------------------------------------------------
  // moveIssue — batch reorder + columnId/status update + audit
  //   Guards:
  //     - 'done': blocks if open subtasks exist
  //   Side-effects:
  //     - 'client-approval': sets clientApprovalPending on linked stage
  // -------------------------------------------------------------------------
  const moveIssue = useCallback(async (issueId, newColumnId, newOrder, actorUser = {}) => {
    const { userId, userName } = actorUser;

    const issue = issues.find(i => i.id === issueId);
    if (!issue) throw new Error('Issue not found');

    // Guard: cannot move to 'done' if open subtasks exist
    if (newColumnId === 'done') {
      const hasOpenSubtasks = issue.subtasks?.some(s => !s.done);
      if (hasOpenSubtasks) {
        throw new Error('Є незакриті підзадачі');
      }
    }

    const oldColumnId = issue.columnId;
    const batch = writeBatch(db);

    // Reorder destination column (exclude the moving issue)
    const destIssues = issues
      .filter(i => i.id !== issueId && i.columnId === newColumnId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Insert moving issue at target position
    destIssues.splice(Math.max(0, newOrder), 0, { id: issueId });
    destIssues.forEach((i, idx) => {
      batch.update(doc(db, 'issues', i.id), { order: idx, updatedAt: serverTimestamp() });
    });

    // Update the moved issue itself
    batch.update(doc(db, 'issues', issueId), {
      columnId: newColumnId,
      status: newColumnId,
      order: Math.max(0, newOrder),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Audit
    await writeAudit(issueId, {
      userId,
      userName,
      action: 'moved',
      from: oldColumnId,
      to: newColumnId,
    });

    // Side-effect: if moved to client-approval and has a linked stage, mark it
    if (newColumnId === 'client-approval' && issue.linkedClientMaterialId) {
      try {
        await updateDoc(doc(db, 'stages', issue.linkedClientMaterialId), {
          clientApprovalPending: true,
          clientApprovalRequestedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[useIssues] could not update stage clientApprovalPending', err);
      }
    }
  }, [issues]);

  return {
    issues,
    loading,
    createIssue,
    updateIssue,
    deleteIssue,
    moveIssue,
  };
}
