'use client';

import { sendNotification } from '@/lib/hooks/useNotifications';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';
import { issuePath } from '@/lib/utils/issueKeys.mjs';

async function authenticatedIssueRequest(url, options, fallbackMessage) {
  return authenticatedRequest(url, options, fallbackMessage);
}

export async function createIssueViaApi({ organizationId, projectId, data }) {
  return authenticatedIssueRequest('/api/issues', {
    method: 'POST',
    body: JSON.stringify({ organizationId, projectId, data }),
  }, 'Не вдалося створити задачу');
}

export async function bulkIssuesViaApi({ organizationId, issueIds, action, value }) {
  return authenticatedIssueRequest('/api/issues/bulk', {
    method: 'POST',
    body: JSON.stringify({ organizationId, issueIds, action, value }),
  }, 'Не вдалося виконати масову дію');
}

/**
 * Tell whoever was just given a task. Being assigned is the same event wherever
 * the task was created from, so both composers say it the same way — the one on
 * «Мої завдання» used to say nothing at all, and a task created there reached
 * its assignee only if they happened to look at the board.
 *
 * Best-effort: a task that exists must not appear to have failed because a
 * notification did not go out. The actor is excluded server-side too.
 */
export function notifyIssueAssigned({
  issueId,
  issueKey,
  title,
  assigneeIds = [],
  actorId,
  actorName,
  projectId,
  organizationId,
}) {
  const recipients = [...new Set(assigneeIds)].filter(uid => uid && uid !== actorId);
  if (!recipients.length || !issueId || !projectId) return Promise.resolve(null);
  return sendNotification({
    userIds: recipients,
    type: 'assigned',
    title: `${actorName || 'Колега'} призначив вам нове завдання`,
    body: title || '',
    link: issuePath({ id: issueId, issueKey }, projectId),
    issueId,
    projectId,
    organizationId,
  }).catch(() => null);
}

export async function transitionIssueStatusViaApi({
  issueId,
  status,
  order,
  orderUpdates,
}) {
  if (!issueId) throw new Error('Issue is required');
  return authenticatedIssueRequest(
    `/api/issues/${encodeURIComponent(issueId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(order !== undefined ? { order } : {}),
        ...(Array.isArray(orderUpdates) ? { orderUpdates } : {}),
      }),
    },
    'Не вдалося змінити статус задачі',
  );
}

/**
 * Puts a task in the archive, or takes it back out. Reversible and with no
 * clock on it — deletion is the other thing, and it lands in «Нещодавно
 * видалене» instead. See src/lib/utils/issueArchive.mjs.
 */
export async function setIssueArchived(issueId, archived) {
  return authenticatedRequest(
    `/api/issues/${encodeURIComponent(issueId)}/archive`,
    { method: 'PATCH', body: JSON.stringify({ archived }) },
    'Не вдалося змінити стан архіву завдання',
  );
}

/** Deleted tasks that can still be restored (a 24-hour window). */
export async function fetchDeletedIssues(organizationId) {
  const result = await authenticatedRequest(
    `/api/issues/trash?organizationId=${encodeURIComponent(organizationId)}`,
    { cache: 'no-store' },
    'Не вдалося прочитати нещодавно видалені завдання',
  );
  return result.items || [];
}

export async function restoreDeletedIssue(issueId, organizationId) {
  return authenticatedRequest(
    `/api/issues/${encodeURIComponent(issueId)}/restore`,
    { method: 'POST', body: JSON.stringify({ organizationId }) },
    'Не вдалося відновити завдання',
  );
}
