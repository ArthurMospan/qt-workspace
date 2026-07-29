'use client';

// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import { reportLoadError } from '@/lib/utils/errors';
import { pickPatchableFields } from '@/lib/utils/optimistic.mjs';
import { issueCompletionBlockers } from '@/lib/utils/issueExecution.mjs';
import { transitionIssueStatusViaApi } from '@/lib/services/issues';

function issueLabel(issue) {
  return issue?.issueKey || issue?.title || issue?.id || 'без назви';
}

export function useAllMyTasks(userId) {
  const {
    activeOrgId
  } = useAppContext();
  const { doneStatusIds } = useWorkflowConfig();
  const [snapshotTasks, setSnapshotTasks] = useState([]);
  const [snapshotAllIssues, setSnapshotAllIssues] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Keeps the "My tasks" kanban from springing a dropped card back to its old
  // column while the write is in flight. Sorted by due date here, not by
  // `order`, so the merged list needs no re-sort.
  const [tasks, applyPatch, revertPatch] = useOptimisticPatch(snapshotTasks);
  const [allIssues, applyAllPatch, revertAllPatch] = useOptimisticPatch(snapshotAllIssues);
  useEffect(() => {
    if (!activeOrgId || !userId) {
      queueMicrotask(() => {
        setSnapshotTasks([]);
        setSnapshotAllIssues([]);
        setIssueLinks([]);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setSnapshotTasks([]);
      setSnapshotAllIssues([]);
      setIssueLinks([]);
      setLoading(true);
    });
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId));
    const unsub = onSnapshot(q, snap => {
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const docs = allDocs
        .filter(issue => issue.assigneeIds?.includes(userId));
      docs.sort((a, b) => {
        const aTime = a.dueDate?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.dueDate?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setSnapshotAllIssues(allDocs);
      setSnapshotTasks(docs);
      setLoading(false);
    }, err => {
      reportLoadError('[useAllMyTasks]', err);
      setLoading(false);
    });

    const lq = query(collection(db, 'issueLinks'), where('organizationId', '==', activeOrgId));
    const unsubLinks = onSnapshot(lq, snap => {
      setIssueLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      reportLoadError('[useAllMyTasks] links', err);
    });

    return () => { unsub(); unsubLinks(); };
  }, [userId, activeOrgId]);
  const updateTask = useCallback(async (taskId, data) => {
    const current = tasks.find(task => task.id === taskId);
    if (
      data.status !== undefined
      && data.columnId !== undefined
      && data.status !== data.columnId
    ) {
      throw new Error('Статус і колонка задачі мають збігатися');
    }
    const hasStatusUpdate = data.status !== undefined || data.columnId !== undefined;
    if (data.completedAt !== undefined && !hasStatusUpdate) {
      throw new Error('Дата завершення керується статусом задачі');
    }
    const nextStatus = data.columnId ?? data.status;
    const directData = { ...data };
    delete directData.status;
    delete directData.columnId;
    delete directData.completedAt;
    if (hasStatusUpdate) delete directData.order;
    if (current && nextStatus) {
      const wasDone = doneStatusIds.includes(current.columnId || current.status);
      const willBeDone = doneStatusIds.includes(nextStatus);
      if (willBeDone && !wasDone) {
        const blockers = issueCompletionBlockers({
          issueId: taskId,
          issues: allIssues,
          issueLinks,
          doneStatusIds,
        });
        if (!blockers.canComplete) {
          const reasons = [];
          if (blockers.children.length > 0) {
            reasons.push(
              `спочатку завершіть підзавдання: ${blockers.children.map(issueLabel).join(', ')}`,
            );
          }
          if (blockers.dependencies.length > 0) {
            reasons.push(
              `завдання ще блокують: ${blockers.dependencies.map(issueLabel).join(', ')}`,
            );
          }
          throw new Error(`Не можна завершити завдання — ${reasons.join('; ')}.`);
        }
      }
    }
    // Paint the new column before the round-trip, otherwise the drop animation
    // lands the card back where it started and the echo teleports it.
    const optimistic = pickPatchableFields(data);
    if (optimistic) {
      applyPatch({ [taskId]: optimistic });
      applyAllPatch({ [taskId]: optimistic });
    }

    try {
      if (hasStatusUpdate) {
        await transitionIssueStatusViaApi({
          issueId: taskId,
          status: nextStatus,
          ...(data.order !== undefined ? { order: data.order } : {}),
        });
      }
      if (Object.keys(directData).length > 0) {
        await updateDoc(doc(db, 'issues', taskId), {
          ...directData,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (optimistic) {
        revertPatch([taskId]);
        revertAllPatch([taskId]);
      }
      throw err;
    }
  }, [
    allIssues,
    applyAllPatch,
    applyPatch,
    doneStatusIds,
    issueLinks,
    revertAllPatch,
    revertPatch,
    tasks,
  ]);
  return {
    tasks,
    allIssues,
    issueLinks,
    loading,
    updateTask
  };
}
