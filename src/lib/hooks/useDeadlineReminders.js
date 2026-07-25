'use client';

// src/lib/hooks/useDeadlineReminders.js
// There is no backend cron in this stack, so deadline reminders are generated
// client-side: the first active session in a 4-hour window scans the org's
// issues and creates 'deadline' notifications idempotently — deterministic doc
// IDs make parallel sessions collapse into a single notification.
//
// Rules:
//   - дедлайн у найближчі 24 години → одне нагадування на кожен дедлайн
//   - дедлайн прострочено → одне нагадування на день, поки завдання не закрите
import { useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { parseDueDate } from '@/lib/utils/date';

const THROTTLE_MS = 4 * 3600 * 1000;

function dayKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useDeadlineReminders(userId, activeOrgId) {
  const { doneStatusIds, loading: workflowLoading } = useWorkflowConfig();
  useEffect(() => {
    if (!userId || !activeOrgId) return;
    // Until the org's workflow has loaded, doneStatusIds is the *default*
    // (['done']). Running now would treat an org whose terminal status is named
    // anything else as "nothing is finished" and nag about completed tasks —
    // and then the throttle below would block the correct run for four hours.
    if (workflowLoading) return;

    // Throttle per browser so we don't rescan on every page load
    const throttleKey = `qt_deadline_check_${userId}_${activeOrgId}`;
    try {
      const last = Number(localStorage.getItem(throttleKey) || 0);
      if (Date.now() - last < THROTTLE_MS) return;
      localStorage.setItem(throttleKey, String(Date.now()));
    } catch { /* localStorage unavailable → run unthrottled */ }

    (async () => {
      try {
        // Respect the user's «Дедлайни» toggle
        const prefSnap = await getDoc(doc(db, 'users', userId, 'settings', 'notifications'));
        const prefs = prefSnap.exists() ? prefSnap.data() : {};
        if ((prefs.deadline ?? true) === false) return;

        // Only the caller's own tasks, instead of every issue in the org.
        const snap = await getDocs(query(
          collection(db, 'issues'),
          where('organizationId', '==', activeOrgId),
          where('assigneeIds', 'array-contains', userId),
        ));
        const now = Date.now();
        const in24h = now + 24 * 3600 * 1000;
        const todayKey = dayKeyOf(new Date());

        const due = snap.docs.flatMap(d => {
          const iss = d.data();
          if (doneStatusIds.includes(iss.columnId || iss.status)) return [];
          const dueDate = parseDueDate(iss.dueDate);
          if (!dueDate) return [];
          const dueMs = dueDate.getTime();
          if (dueMs < now) {
            return [{
              issue: iss,
              id: d.id,
              dedupeKey: `overdue_${d.id}_${userId}_${todayKey}`,
              title: `${iss.issueKey || 'Завдання'}: дедлайн прострочено`,
            }];
          }
          if (dueMs <= in24h) {
            return [{
              issue: iss,
              id: d.id,
              dedupeKey: `deadline_${d.id}_${userId}_${dayKeyOf(dueDate)}`,
              title: `${iss.issueKey || 'Завдання'}: дедлайн ${dueDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`,
            }];
          }
          return [];
        });

        // Delivered together rather than in a serial await chain, which took one
        // round-trip per task.
        await Promise.allSettled(due.map(item => sendNotification({
          userIds: [userId],
          type: 'deadline',
          title: item.title,
          body: item.issue.title || '',
          link: `/${item.issue.projectId}/issue/${item.id}`,
          issueId: item.id,
          projectId: item.issue.projectId || '',
          organizationId: activeOrgId,
          dedupeKey: item.dedupeKey,
        })));
      } catch (err) {
        console.warn('[useDeadlineReminders]', err);
      }
    })();
  }, [userId, activeOrgId, doneStatusIds, workflowLoading]);
}
