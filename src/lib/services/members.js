'use client';

import { auth } from '@/lib/firebase';
import { createResponseError } from '@/lib/utils/errors';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';

const memberCache = new Map();
const CACHE_MS = 10_000;
const STALE_CACHE_MS = 24 * 60 * 60 * 1000;

function memberUrl(organizationId, memberId) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`;
}

function persistentCacheKey(cacheKey) {
  return `quickteam:members:${cacheKey}`;
}

function readPersistentMembers(cacheKey) {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(persistentCacheKey(cacheKey)) || 'null');
    if (!cached || !Array.isArray(cached.members) || Date.now() - cached.createdAt > STALE_CACHE_MS) return null;
    return cached.members;
  } catch {
    return null;
  }
}

function writePersistentMembers(cacheKey, members) {
  if (typeof window === 'undefined') return;
  try {
    const publicMembers = members.map(({ hourlyRate, ...member }) => member);
    window.localStorage.setItem(persistentCacheKey(cacheKey), JSON.stringify({
      createdAt: Date.now(),
      members: publicMembers,
    }));
  } catch {
    // Storage can be unavailable in privacy mode; the in-memory cache still works.
  }
}

export async function fetchOrganizationMembers(organizationId, { force = false } = {}) {
  if (!organizationId) return [];
  await auth.authStateReady?.();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required');
  const cacheKey = `${organizationId}_${currentUser.uid}`;
  const cached = memberCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.createdAt < CACHE_MS) return cached.promise;

  const requestMembers = async forceRefresh => {
    const token = await currentUser.getIdToken(forceRefresh);
    return fetch(`/api/organizations/${encodeURIComponent(organizationId)}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  };

  const promise = requestMembers(false)
    .then(response => (response.status === 401 ? requestMembers(true) : response))
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw createResponseError(response, result, 'Failed to load organization members');
      const members = result.members || [];
      writePersistentMembers(cacheKey, members);
      return members;
    })
    .catch(error => {
      memberCache.delete(cacheKey);
      const staleMembers = readPersistentMembers(cacheKey);
      if (staleMembers) return staleMembers;
      throw error;
    });
  memberCache.set(cacheKey, { createdAt: Date.now(), promise });
  return promise;
}

export function invalidateOrganizationMembers(organizationId) {
  for (const key of memberCache.keys()) {
    if (key.startsWith(`${organizationId}_`)) memberCache.delete(key);
  }
}

export async function fetchMemberRemovalImpact(organizationId, memberId) {
  return authenticatedRequest(
    memberUrl(organizationId, memberId),
    { cache: 'no-store' },
    'Не вдалося перевірити доступ учасника',
  );
}

export async function updateOrganizationMember(organizationId, memberId, update) {
  const result = await authenticatedRequest(
    memberUrl(organizationId, memberId),
    { method: 'PATCH', body: JSON.stringify(update) },
    'Не вдалося оновити учасника',
  );
  invalidateOrganizationMembers(organizationId);
  return result;
}

export async function removeOrganizationMember(organizationId, memberId) {
  const result = await authenticatedRequest(
    memberUrl(organizationId, memberId),
    { method: 'DELETE' },
    'Не вдалося видалити учасника',
  );
  invalidateOrganizationMembers(organizationId);
  return result;
}
