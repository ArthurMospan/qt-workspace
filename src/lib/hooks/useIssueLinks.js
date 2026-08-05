'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { createResponseError, reportLoadError } from '@/lib/utils/errors';
import { issueLinkRequestFromPerspective } from '@/lib/utils/issueLinkPresentation.mjs';
export {
  ISSUE_LINK_OPTIONS,
  issueLinkPerspective,
} from '@/lib/utils/issueLinkPresentation.mjs';

const requestCache = new Map();

async function requestLinks(issueId, method = 'GET', body = null) {
  const cacheKey = String(issueId);
  if (method === 'GET') {
    const cached = requestCache.get(cacheKey);
    if (cached) return cached;
    const request = performRequest(issueId, method, body);
    requestCache.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (requestCache.get(cacheKey) === request) requestCache.delete(cacheKey);
    }
  }

  try {
    const result = await performRequest(issueId, method, body);
    requestCache.delete(cacheKey);
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
  const { closedStatusIds } = useWorkflowConfig();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!issueId) {
      setLinks([]);
      setError(null);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const result = await requestLinks(issueId);
      const nextLinks = result.links || [];
      setLinks(nextLinks);
      setError(null);
      return nextLinks;
    } catch (error) {
      reportLoadError('[useIssueLinks]', error);
      setLinks([]);
      setError(error);
      return null;
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
    const request = issueLinkRequestFromPerspective(sourceId, targetId, relationType);
    await requestLinks(request.sourceIssueId, 'POST', {
      targetIssueId: request.targetIssueId,
      relationType: request.relationType,
    });
    requestCache.delete(String(sourceId));
    requestCache.delete(String(targetId));
    await refresh();
  }, [refresh]);

  const removeLink = useCallback(async linkId => {
    await requestLinks(issueId, 'DELETE', { linkId });
    await refresh();
  }, [issueId, refresh]);

  const hasBlocker = useCallback((targetIssueId, allIssues) => {
    const blockingLinks = links.filter(link => link.relationType === 'blocks' && link.targetIssueId === targetIssueId);
    return blockingLinks.some(link => {
      const blocker = allIssues.find(issue => issue.id === link.sourceIssueId) || link.sourceIssue;
      return blocker && !closedStatusIds.includes(blocker.columnId ?? blocker.status);
    });
  }, [links, closedStatusIds]);

  return { links, loading, error, refresh, addLink, removeLink, hasBlocker };
}
