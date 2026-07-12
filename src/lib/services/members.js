'use client';

import { auth } from '@/lib/firebase';

const memberCache = new Map();
const CACHE_MS = 10_000;

export async function fetchOrganizationMembers(organizationId, { force = false } = {}) {
  if (!organizationId) return [];
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required');
  const cacheKey = `${organizationId}_${currentUser.uid}`;
  const cached = memberCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.createdAt < CACHE_MS) return cached.promise;
  const token = await currentUser.getIdToken();

  const promise = fetch(`/api/organizations/${encodeURIComponent(organizationId)}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load organization members');
      return result.members || [];
    })
    .catch(error => {
      memberCache.delete(cacheKey);
      throw error;
    });
  memberCache.set(cacheKey, { createdAt: Date.now(), promise });
  return promise;
}
