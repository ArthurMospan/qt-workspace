'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { createResponseError, reportLoadError } from '@/lib/utils/errors';

const GET_CACHE_MS = 5_000;
const requestCache = new Map();

async function requestLinks(issueId, method = 'GET', body = null) {
  const cacheKey = String(issueId);
  if (method === 'GET') {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < GET_CACHE_MS) return cached.promise;
  }

  const promise = performRequest(issueId, method, body);
  if (method === 'GET') requestCache.set(cacheKey, { createdAt: Date.now(), promise });

  try {
    const result = await promise;
    if (method !== 'GET') requestCache.delete(cacheKey);
    return result;
  } catch (error) {
    requestCache.delete(cacheKey);
    throw error;
  }
}

async function performRequest(issueId, method, body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}/links`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw createResponseError(response, result, 'Issue links request failed');
  return result;
}

export function useIssueLinks(issueId) {
  const { doneStatusIds } = useWorkflowConfig();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!issueId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await requestLinks(issueId);
      setLinks(result.links || []);
    } catch (error) {
      reportLoadError('[useIssueLinks]', error);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const addLink = useCallback(async (sourceId, targetId, relationType) => {
    await requestLinks(sourceId, 'POST', { targetIssueId: targetId, relationType });
    await refresh();
  }, [refresh]);

  const removeLink = useCallback(async linkId => {
    await requestLinks(issueId, 'DELETE', { linkId });
    await refresh();
  }, [issueId, refresh]);

  const hasBlocker = useCallback((targetIssueId, allIssues) => {
    const blockingLinks = links.filter(link => link.relationType === 'blocks' && link.targetIssueId === targetIssueId);
    return blockingLinks.some(link => {
      const blocker = allIssues.find(issue => issue.id === link.sourceIssueId);
      return blocker && !doneStatusIds.includes(blocker.columnId ?? blocker.status);
    });
  }, [links, doneStatusIds]);

  return { links, loading, addLink, removeLink, hasBlocker };
}
