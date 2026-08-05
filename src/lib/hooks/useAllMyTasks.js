'use client';

// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import {
  chunkProjectIds,
  flattenDocumentBuckets,
} from '@/lib/utils/projectScopedQueries.mjs';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import { reportLoadError } from '@/lib/utils/errors';
import { pickPatchableFields, planDrop } from '@/lib/utils/optimistic.mjs';
import { issueCompletionBlockers } from '@/lib/utils/issueExecution.mjs';
import { issueParticipants } from '@/lib/utils/issueParticipants.mjs';
import { statusLabel } from '@/lib/utils/workflowDefaults.mjs';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { transitionIssueStatusViaApi } from '@/lib/services/issues';

function issueLabel(issue) {
  return issue?.issueKey || issue?.title || issue?.id || 'без назви';
}

export function useAllMyTasks(userId) {
  const {
    activeOrgId,
    projects,
    authLoading,
    orgLoading,
    projectsLoading,
  } = useAppContext();
  const { doneStatusIds, statuses } = useWorkflowConfig();
  const [snapshotTasks, setSnapshotTasks] = useState([]);
  const [snapshotAllIssues, setSnapshotAllIssues] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Keeps the "My tasks" kanban from springing a dropped card back to its old
  // column while the write is in flight. Sorted by due date here, not by
  // `order`, so the merged list needs no re-sort.
  const [tasks, applyPatch, revertPatch] = useOptimisticPatch(snapshotTasks);
  const [allIssues, applyAllPatch, revertAllPatch] = useOptimisticPatch(snapshotAllIssues);
  // Only the projects this user can already open. An organization-wide query
  // is rejected in full the moment it touches one project they are not on the
  // team of, which is what used to empty this page for every member.
  const projectScope = useMemo(
    () => [...new Set((projects || []).map(project => project.id).filter(Boolean))]
      .sort()
      .join(','),
    [projects],
  );
  useEffect(() => {
    const projectIds = projectScope ? projectScope.split(',') : [];
    if (!activeOrgId || !userId || projectIds.length === 0) {
      queueMicrotask(() => {
        setSnapshotTasks([]);
        setSnapshotAllIssues([]);
        setIssueLinks([]);
        // An empty project list before the projects have loaded is not a user
        // with nothing assigned to them.
        setLoading(Boolean(authLoading || orgLoading || projectsLoading));
      });
      return;
    }
    queueMicrotask(() => {
      setSnapshotTasks([]);
      setSnapshotAllIssues([]);
      setIssueLinks([]);
      setLoading(true);
    });

    const chunks = chunkProjectIds(projectIds);
    const issueBuckets = new Map();
    const linkBuckets = new Map();
    const readyStreams = new Set();
    const expectedStreamCount = chunks.length * 2;
    const unsubs = [];
    const markReady = key => {
      readyStreams.add(key);
      if (readyStreams.size >= expectedStreamCount) setLoading(false);
    };
    const publishIssues = () => {
      const allDocs = flattenDocumentBuckets(issueBuckets);
      const docs = allDocs
        .filter(issue => issue.assigneeIds?.includes(userId));
      docs.sort((a, b) => {
        const aTime = a.dueDate?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.dueDate?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setSnapshotAllIssues(allDocs);
      setSnapshotTasks(docs);
    };

    chunks.forEach((chunk, chunkIndex) => {
      const issuesKey = `issues:${chunkIndex}`;
      unsubs.push(onSnapshot(
        query(
          collection(db, 'issues'),
          where('organizationId', '==', activeOrgId),
          where('projectId', 'in', chunk),
        ),
        snap => {
          issueBuckets.set(issuesKey, snap.docs.map(d => ({ id: d.id, ...d.data() })));
          publishIssues();
          markReady(issuesKey);
        },
        err => {
          reportLoadError('[useAllMyTasks]', err);
          issueBuckets.set(issuesKey, []);
          publishIssues();
          markReady(issuesKey);
        },
      ));

      const linksKey = `links:${chunkIndex}`;
      unsubs.push(onSnapshot(
        query(
          collection(db, 'issueLinks'),
          where('organizationId', '==', activeOrgId),
          where('projectId', 'in', chunk),
        ),
        snap => {
          linkBuckets.set(linksKey, snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setIssueLinks(flattenDocumentBuckets(linkBuckets));
          markReady(linksKey);
        },
        err => {
          reportLoadError('[useAllMyTasks] links', err);
          linkBuckets.set(linksKey, []);
          setIssueLinks(flattenDocumentBuckets(linkBuckets));
          markReady(linksKey);
        },
      ));
    });

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [userId, activeOrgId, projectScope, authLoading, orgLoading, projectsLoading]);
  // Shared by the board and by any other status write: a parent or a blocked
  // task may not be closed while real work under it is still open.
  const assertCompletable = useCallback((taskId, current, nextStatus) => {
    if (!current || !nextStatus) return;
    const wasDone = doneStatusIds.includes(current.columnId || current.status);
    const willBeDone = doneStatusIds.includes(nextStatus);
    if (!willBeDone || wasDone) return;
    const blockers = issueCompletionBlockers({
      issueId: taskId,
      issues: allIssues,
      issueLinks,
      doneStatusIds,
    });
    if (blockers.canComplete) return;
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
  }, [allIssues, doneStatusIds, issueLinks]);

  /**
   * A drop on the "Мої завдання" board. Its columns mix projects, but `order`
   * numbers one project's column, so the card is positioned among its own
   * project's cards and its neighbours there are renumbered with it — exactly
   * what the project board does. This used to write the raw index of a
   * cross-project list as the card's `order` and update nobody else, so the
   * card landed at whatever row that number meant in its project and the
   * project's own board inherited the collision.
   */
  const moveTask = useCallback(async (taskId, columnId, position, actorUser = {}) => {
    const current = allIssues.find(issue => issue.id === taskId);
    if (!current) throw new Error('Issue not found');
    assertCompletable(taskId, current, columnId);

    const plan = planDrop(allIssues, taskId, columnId, position, { scopeToProject: true });
    if (!plan) throw new Error('Issue not found');
    const fromColumnId = current.columnId || current.status || null;

    applyPatch(plan.patches);
    applyAllPatch(plan.patches);
    try {
      await transitionIssueStatusViaApi({
        issueId: taskId,
        status: columnId,
        order: plan.patches[taskId]?.order,
        orderUpdates: Object.entries(plan.patches)
          .filter(([, patch]) => patch.order !== undefined)
          .map(([id, patch]) => ({ issueId: id, order: patch.order })),
      });
    } catch (error) {
      revertPatch(Object.keys(plan.patches));
      revertAllPatch(Object.keys(plan.patches));
      throw error;
    }

    // The same event as a move on the project board, so it reaches the same
    // people. Moving a task here used to tell nobody at all.
    if (fromColumnId !== columnId) {
      const recipients = issueParticipants(current, {
        actorId: actorUser.userId || userId,
      });
      if (recipients.length) {
        sendNotification({
          userIds: recipients,
          type: 'status_changed',
          title: `${current.issueKey || 'Задача'}: статус змінено`,
          body: `${current.title || ''} → ${statusLabel(columnId, statuses)}`,
          link: `/${current.projectId}/issue/${taskId}`,
          issueId: taskId,
          projectId: current.projectId,
          organizationId: activeOrgId,
        }).catch(() => {});
      }
    }
  }, [
    activeOrgId,
    allIssues,
    applyAllPatch,
    applyPatch,
    assertCompletable,
    revertAllPatch,
    revertPatch,
    statuses,
    userId,
  ]);

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
    assertCompletable(taskId, current, nextStatus);
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
    applyAllPatch,
    applyPatch,
    assertCompletable,
    revertAllPatch,
    revertPatch,
    tasks,
  ]);
  return {
    tasks,
    allIssues,
    issueLinks,
    loading,
    moveTask,
    updateTask
  };
}
