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

const THROTTLE_MS = 4 * 3600 * 1000;

function dayKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useDeadlineReminders(userId, activeOrgId) {
  const { doneStatusIds } = useWorkflowConfig();
  useEffect(() => {
    if (!userId || !activeOrgId) return;

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

        // Single equality filter — no composite index required
        const snap = await getDocs(query(collection(db, 'issues'), where('organizationId', '==', activeOrgId)));
        const now = Date.now();
        const in24h = now + 24 * 3600 * 1000;
        const todayKey = dayKeyOf(new Date());

        for (const d of snap.docs) {
          const iss = d.data();
          if (doneStatusIds.includes(iss.columnId)) continue;
          if (!iss.assigneeIds?.includes(userId)) continue;
          const due = iss.dueDate?.toDate ? iss.dueDate.toDate() : iss.dueDate ? new Date(iss.dueDate) : null;
          if (!due || isNaN(due.getTime())) continue;
          const dueMs = due.getTime();

          let notifId = null;
          let title = null;
          if (dueMs < now) {
            notifId = `overdue_${d.id}_${userId}_${todayKey}`;
            title = `${iss.issueKey || 'Завдання'}: дедлайн прострочено`;
          } else if (dueMs <= in24h) {
            notifId = `deadline_${d.id}_${userId}_${dayKeyOf(due)}`;
            title = `${iss.issueKey || 'Завдання'}: дедлайн ${due.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}`;
          }
          if (!notifId) continue;

          await sendNotification({
            userIds: [userId],
            type: 'deadline',
            title,
            body: iss.title || '',
            link: `/workspace/${iss.projectId}/issue/${d.id}`,
            issueId: d.id,
            projectId: iss.projectId || '',
            organizationId: activeOrgId,
            dedupeKey: notifId,
          });
        }
      } catch (err) {
        console.warn('[useDeadlineReminders]', err);
      }
    })();
  }, [userId, activeOrgId, doneStatusIds]);
}
