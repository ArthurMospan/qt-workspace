'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';

async function requestLinks(issueId, method = 'GET', body = null) {
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
  if (!response.ok) throw new Error(result.error || 'Issue links request failed');
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
      console.error('[useIssueLinks]', error);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    queueMicrotask(refresh);
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
