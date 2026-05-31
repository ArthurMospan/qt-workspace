'use client';

// src/lib/hooks/useIssues.js — CRUD for issues collection with audit logging
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

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
export function useIssues(projectId) {
  const {
    activeOrgId
  } = useAppContext();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId || !activeOrgId) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    // No orderBy — sorted client-side to avoid composite index
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort client-side by order ASC, fallback to createdAt asc
      docs.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setIssues(docs);
      setLoading(false);
    }, err => {
      console.error('[useIssues] onSnapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [projectId, activeOrgId]);

  // -------------------------------------------------------------------------
  // createIssue — atomic issueCounter increment + addDoc + audit
  // -------------------------------------------------------------------------
  const createIssue = useCallback(async (data, actorUser = {}) => {
    const {
      userId,
      userName
    } = actorUser;
    const orgId = activeOrgId || 'unknown';
    const colId = data.columnId || data.status || 'backlog';
    const orderVal = issues.filter(i => i.columnId === colId).length;

    // Step 1: Generate a temp optimistic key and create the doc IMMEDIATELY
    const tempKey = `WS-${Date.now()}`;
    const newIssueRef = await addDoc(collection(db, 'issues'), {
      issueKey: tempKey,
      projectId,
      organizationId: orgId,
      title: data.title || '',
      description: data.description || '',
      type: data.type || 'task',
      columnId: colId,
      status: colId,
      priority: data.priority || 'medium',
      assigneeIds: data.assigneeIds || (userId ? [userId] : []),
      reporterId: data.reporterId || userId || null,
      order: orderVal,
      estimateMinutes: data.estimateMinutes ?? null,
      dueDate: data.dueDate || null,
      linkedClientMaterialId: data.linkedClientMaterialId || null,
      clientVisibility: data.clientVisibility ?? false,
      subtasks: data.subtasks || [],
      sprintId: data.sprintId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Step 2: Get real key via transaction — runs ASYNC, updates key in background
    const projectRef = doc(db, 'projects', projectId);
    runTransaction(db, async tx => {
      const projectSnap = await tx.get(projectRef);
      if (!projectSnap.exists()) return;
      const projectData = projectSnap.data();
      const current = projectData.issueCounter ?? 0;
      const next = current + 1;
      
      // Calculate project prefix dynamically: first 3 letters of name, capitalized, e.g. "QT" or "PRO"
      const pName = projectData.name || 'WS';
      const cleanProj = pName.replace(/[^a-zA-Z]/g, '');
      let prefix = cleanProj.slice(0, 3).toUpperCase();
      if (prefix.length < 2) {
        prefix = pName.slice(0, 2).toUpperCase();
      }
      if (!prefix) prefix = 'WS';

      tx.update(projectRef, {
        issueCounter: next,
        updatedAt: serverTimestamp()
      });
      tx.update(doc(db, 'issues', newIssueRef.id), {
        issueKey: `${prefix}-${next}`
      });
    }).catch(err => console.warn('[useIssues] issueCounter update failed (key stays temp):', err));

    // Step 3: Audit log — fire and forget
    writeAudit(newIssueRef.id, {
      userId,
      userName,
      action: 'created',
      from: null,
      to: tempKey
    }).catch(() => {});
    return {
      id: newIssueRef.id,
      issueKey: tempKey
    };
  }, [projectId, issues, activeOrgId]);

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

    // Write audit for notable field changes
    const auditFields = ['status', 'priority', 'title', 'columnId', 'assigneeIds'];
    for (const field of auditFields) {
      if (data[field] !== undefined && current && data[field] !== current[field]) {
        const from = Array.isArray(current[field]) ? JSON.stringify(current[field]) : String(current[field] ?? '');
        const to = Array.isArray(data[field]) ? JSON.stringify(data[field]) : String(data[field] ?? '');
        await writeAudit(issueId, {
          userId,
          userName,
          action: `changed_${field}`,
          from,
          to
        });
      }
    }
  }, [issues, projectId]);

  // -------------------------------------------------------------------------
  // deleteIssue
  // -------------------------------------------------------------------------
  const deleteIssue = useCallback(async issueId => {
    await deleteDoc(doc(db, 'issues', issueId));
    await updateDoc(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp()
    }).catch(() => {});
  }, [projectId]);

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

    // Update the moved issue itself
    batch.update(doc(db, 'issues', issueId), {
      columnId: newColumnId,
      status: newColumnId,
      order: Math.max(0, newOrder),
      updatedAt: serverTimestamp()
    });

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
  }, [issues]);
  return {
    issues,
    loading,
    createIssue,
    updateIssue,
    deleteIssue,
    moveIssue
  };
}