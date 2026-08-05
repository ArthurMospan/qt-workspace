'use client';

import { auth } from '@/lib/firebase';
import { sendNotification } from '@/lib/hooks/useNotifications';

async function authenticatedIssueRequest(url, options, fallbackMessage) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || fallbackMessage);
    error.status = response.status;
    error.code = result.code || null;
    Object.entries(result).forEach(([key, value]) => {
      if (!['error', 'code'].includes(key)) error[key] = value;
    });
    throw error;
  }
  return result;
}

export async function createIssueViaApi({ organizationId, projectId, data }) {
  return authenticatedIssueRequest('/api/issues', {
    method: 'POST',
    body: JSON.stringify({ organizationId, projectId, data }),
  }, 'Не вдалося створити задачу');
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
    link: `/${projectId}/issue/${issueId}`,
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
