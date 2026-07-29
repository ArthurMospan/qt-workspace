'use client';

import { auth } from '@/lib/firebase';

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
