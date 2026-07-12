'use client';

import { auth } from '@/lib/firebase';

export async function createIssueViaApi({ organizationId, projectId, data }) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch('/api/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ organizationId, projectId, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не вдалося створити задачу');
  return result;
}
