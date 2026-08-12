'use client';

// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import {
  resolveCategoryStatusId,
  statusCategoryOf,
  statusCategoryLabel,
} from '@/lib/utils/statusCategories.mjs';
import {
  compareMyTaskIssues,
  normalizeMyTaskOrders,
  planMyTaskDrop,
} from '@/lib/utils/myTaskOrder.mjs';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { transitionIssueStatusViaApi } from '@/lib/services/issues';
import { issuePath } from '@/lib/utils/issueKeys.mjs';

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
  const { closedStatusIds, statuses } = useWorkflowConfig();
  const [snapshotTasks, setSnapshotTasks] = useState([]);
  const [snapshotAllIssues, setSnapshotAllIssues] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myTaskOrders, setMyTaskOrders] = useState({});
  const [myTaskOrderLoading, setMyTaskOrderLoading] = useState(true);
  // Keeps the "My tasks" kanban from springing a dropped card back to its old
  // column while the write is in flight. Sorted by due date here, not by
  // `order`, so the merged list needs no re-sort.
  const [tasks, applyPatch, revertPatch] = useOptimisticPatch(snapshotTasks);
  const [allIssues, applyAllPatch, revertAllPatch] = useOptimisticPatch(snapshotAllIssues);
  const compareTaskCards = useMemo(
    () => compareMyTaskIssues(myTaskOrders),
    [myTaskOrders],
  );
  const categoryOfIssue = useCallback(
    issue => statusCategoryOf(issue?.columnId || issue?.status || null, statuses),
    [statuses],
  );
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

  // Project `order` belongs to project boards. This private settings document
  // holds the user's own cross-project order for "My tasks".
  useEffect(() => {
    if (!userId || !activeOrgId) {
      queueMicrotask(() => {
        setMyTaskOrders({});
        setMyTaskOrderLoading(false);
      });
      return;
    }
    queueMicrotask(() => setMyTaskOrderLoading(true));
    const orderRef = doc(db, 'users', userId, 'settings', `my-tasks-${activeOrgId}`);
    return onSnapshot(
      orderRef,
      snapshot => {
        setMyTaskOrders(normalizeMyTaskOrders(snapshot.data()?.orders));
        setMyTaskOrderLoading(false);
      },
      error => {
        reportLoadError('[useAllMyTasks] personal order', error);
        setMyTaskOrders({});
        setMyTaskOrderLoading(false);
      },
    );
  }, [activeOrgId, userId]);

  // Shared by the board and by any other status write: a parent or a blocked
  // task may not be closed while real work under it is still open.
  const assertCompletable = useCallback((taskId, current, nextStatus) => {
    if (!current || !nextStatus) return;
    const wasClosed = closedStatusIds.includes(current.columnId || current.status);
    const willBeClosed = closedStatusIds.includes(nextStatus);
    if (!willBeClosed || wasClosed) return;
    const blockers = issueCompletionBlockers({
      issueId: taskId,
      issues: allIssues,
      issueLinks,
      closedStatusIds,
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
  }, [allIssues, closedStatusIds, issueLinks]);

  /**
   * A drop on "Мої завдання" always updates a private cross-project order.
   * Project `order` is only touched when the task really enters another status;
   * a reorder in one category creates no status update or audit event.
   */
  const moveTask = useCallback(async (
    taskId,
    columnId,
    categoryId,
    position,
    actorUser = {},
  ) => {
    const current = allIssues.find(issue => issue.id === taskId);
    if (!current) throw new Error('Issue not found');
    const fromColumnId = current.columnId || current.status || null;
    const statusChanged = fromColumnId !== columnId;
    const personalPlan = planMyTaskDrop({
      issues: tasks,
      issueId: taskId,
      targetCategoryId: categoryId,
      position,
      orders: myTaskOrders,
      categoryOf: categoryOfIssue,
    });
    if (!personalPlan) throw new Error('Issue not found');
    const previousOrders = myTaskOrders;

    let statusPlan = null;
    if (statusChanged) {
      assertCompletable(taskId, current, columnId);
      statusPlan = planDrop(
        allIssues,
        taskId,
        columnId,
        { index: 0 },
        { scopeToProject: true },
      );
      if (!statusPlan) {
        throw new Error('Issue not found');
      }
    }
    setMyTaskOrders(personalPlan.orders);
    if (statusPlan) {
      applyPatch(statusPlan.patches);
      applyAllPatch(statusPlan.patches);
    }

    let statusPersisted = false;
    try {
      if (statusPlan) {
        await transitionIssueStatusViaApi({
          issueId: taskId,
          status: columnId,
          order: statusPlan.patches[taskId]?.order,
          orderUpdates: Object.entries(statusPlan.patches)
            .filter(([, patch]) => patch.order !== undefined)
            .map(([id, patch]) => ({ issueId: id, order: patch.order })),
        });
        statusPersisted = true;
      }
      await setDoc(
        doc(db, 'users', userId, 'settings', `my-tasks-${activeOrgId}`),
        {
          organizationId: activeOrgId,
          orders: personalPlan.orders,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      // If the status request already succeeded, keep its optimistic patch:
      // reverting here would briefly lie about the server state until the
      // Firestore snapshot arrives. The personal order may still remain useful
      // for this session even when its separate settings write failed.
      if (!statusPersisted) {
        setMyTaskOrders(previousOrders);
      }
      if (statusPlan && !statusPersisted) {
        revertPatch(Object.keys(statusPlan.patches));
        revertAllPatch(Object.keys(statusPlan.patches));
      }
      throw error;
    }

    // Only a real status transition reaches participants. Personal sorting is
    // private UI state and must not look like activity on the task itself.
    if (statusChanged) {
      const recipients = issueParticipants(current, {
        actorId: actorUser.userId || userId,
      });
      if (recipients.length) {
        sendNotification({
          userIds: recipients,
          type: 'status_changed',
          title: `${current.issueKey || 'Задача'}: статус змінено`,
          body: `${current.title || ''} → ${statusLabel(columnId, statuses)}`,
          link: issuePath(current),
          issueId: taskId,
          projectId: current.projectId,
          organizationId: activeOrgId,
        }).catch(() => {});
      }
    }
    return { statusChanged, statusId: columnId };
  }, [
    activeOrgId,
    allIssues,
    applyAllPatch,
    applyPatch,
    assertCompletable,
    categoryOfIssue,
    myTaskOrders,
    revertAllPatch,
    revertPatch,
    statuses,
    tasks,
    userId,
  ]);

  /**
   * A drop on the category columns of «Мої завдання». The column names a
   * category; the status written is one the task's *own project* uses, so a
   * column of this board can never be missing from a project and a drop can
   * never be refused by a project setting the person dropping the card cannot
   * see. A task already in the target category keeps its status — moving inside
   * one category is a reorder, not a status change.
   */
  const moveTaskToCategory = useCallback(async (taskId, categoryId, position, actorUser = {}) => {
    const current = allIssues.find(issue => issue.id === taskId);
    if (!current) throw new Error('Issue not found');
    const project = (projects || []).find(item => item.id === current.projectId);
    const statusId = resolveCategoryStatusId(categoryId, statuses, {
      currentStatusId: current.columnId || current.status || null,
      hiddenStatusIds: Array.isArray(project?.hiddenColumns) ? project.hiddenColumns : [],
    });
    if (!statusId) {
      throw new Error(
        `У проєкті «${project?.name || current.projectId}» немає доступної колонки `
          + `категорії «${statusCategoryLabel(categoryId) || categoryId}». `
          + 'Увімкніть її в налаштуваннях проєкту або оберіть інший статус',
      );
    }
    return moveTask(taskId, statusId, categoryId, position, actorUser);
  }, [allIssues, moveTask, projects, statuses]);

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
    loading: loading || myTaskOrderLoading,
    moveTask,
    moveTaskToCategory,
    compareTaskCards,
    updateTask
  };
}
