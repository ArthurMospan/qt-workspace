'use client';

// Loads issues and time logs only for the already-authorized project list.
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import {
  chunkProjectIds,
  flattenDocumentBuckets,
} from '@/lib/utils/projectScopedQueries.mjs';
import { ANALYTICS_QUERY_PAGE_SIZE, nextQueryLimit } from '@/lib/utils/queryPagination.mjs';

export function useWorkspaceAnalytics(projectIds = [], {
  includeLinks = true,
  includeTimeLogs = true,
} = {}) {
  const { activeOrgId, authLoading, orgLoading } = useAppContext();
  const [issues, setIssues] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const projectScope = [...new Set(projectIds.filter(Boolean))].sort().join(',');
  const queryTarget = `${activeOrgId || ''}/${projectScope}/${includeLinks ? 'links' : 'no-links'}/${includeTimeLogs ? 'time' : 'no-time'}`;
  const [pagination, setPagination] = useState({ target: '', limit: ANALYTICS_QUERY_PAGE_SIZE });
  const targetRef = useRef('');
  const queryLimit = pagination.target === queryTarget
    ? pagination.limit
    : ANALYTICS_QUERY_PAGE_SIZE;
  const loadMore = useCallback(() => {
    if (!activeOrgId || loadingMore) return;
    setLoadingMore(true);
    setPagination(current => ({
      target: queryTarget,
      limit: nextQueryLimit(
        current.target === queryTarget ? current.limit : ANALYTICS_QUERY_PAGE_SIZE,
        ANALYTICS_QUERY_PAGE_SIZE,
      ),
    }));
  }, [activeOrgId, loadingMore, queryTarget]);

  useEffect(() => {
    if (!activeOrgId) {
      targetRef.current = '';
      queueMicrotask(() => {
        setIssues([]);
        setTimeLogs([]);
        setIssueLinks([]);
        setHasMore(false);
        setLoadingMore(false);
        // Still resolving the organization is not the same as having read it
        // and found nothing — the difference is a spinner versus an empty
        // state that says the workspace has no data.
        setLoading(Boolean(authLoading || orgLoading));
      });
      return undefined;
    }

    const targetChanged = targetRef.current !== queryTarget;
    targetRef.current = queryTarget;
    if (targetChanged) {
      queueMicrotask(() => {
        setLoading(true);
        setIssues([]);
        setTimeLogs([]);
        setIssueLinks([]);
        setHasMore(false);
      });
    }

    const chunks = chunkProjectIds(projectScope ? projectScope.split(',') : []);
    const issueBuckets = new Map();
    const timeLogBuckets = new Map();
    const linkBuckets = new Map();
    const readyStreams = new Set();
    const moreByStream = new Map();
    const expectedStreamCount = chunks.length * (
      1 + (includeLinks ? 1 : 0) + (includeTimeLogs ? 2 : 0)
    ) + (includeTimeLogs ? 1 : 0);
    const unsubs = [];
    if (expectedStreamCount === 0) {
      queueMicrotask(() => {
        setLoading(false);
        setLoadingMore(false);
        setHasMore(false);
      });
    }
    const markReady = key => {
      readyStreams.add(key);
      if (readyStreams.size >= expectedStreamCount) {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    const publishHasMore = () => setHasMore([...moreByStream.values()].some(Boolean));
    const subscribe = ({
      key,
      sourceQuery,
      buckets,
      publish,
    }) => {
      const unsubscribe = onSnapshot(
        query(sourceQuery, limit(queryLimit + 1)),
        { serverTimestamps: 'estimate' },
        snapshot => {
          buckets.set(key, snapshot.docs.slice(0, queryLimit).map(document => ({
            id: document.id,
            ...document.data(),
          })));
          moreByStream.set(key, snapshot.docs.length > queryLimit);
          publishHasMore();
          publish(flattenDocumentBuckets(buckets));
          markReady(key);
        },
        error => {
          reportLoadError(`[useWorkspaceAnalytics:${key}]`, error);
          buckets.set(key, []);
          moreByStream.set(key, false);
          publishHasMore();
          publish(flattenDocumentBuckets(buckets));
          markReady(key);
        },
      );
      unsubs.push(unsubscribe);
    };

    // Projectless team events are organization analytics only and cannot be
    // invoiced until attached to a project.
    if (includeTimeLogs) {
      subscribe({
        key: 'calendar:organization',
        buckets: timeLogBuckets,
        publish: setTimeLogs,
        sourceQuery: query(
          collection(db, 'timeLogs'),
          where('organizationId', '==', activeOrgId),
          where('projectId', '==', ''),
          where('sourceType', '==', 'calendar_event'),
          where('eventVisibility', '==', 'team'),
        ),
      });
    }

    chunks.forEach((chunk, chunkIndex) => {
      subscribe({
        key: `issues:${chunkIndex}`,
        buckets: issueBuckets,
        publish: setIssues,
        sourceQuery: query(
          collection(db, 'issues'),
          where('organizationId', '==', activeOrgId),
          where('projectId', 'in', chunk),
        ),
      });

      // Links must be scoped to the same authorized project list. An
      // organization-wide link query is rejected outright, because Firestore
      // evaluates the rule per document and one unreachable project fails all.
      if (includeLinks) {
        subscribe({
          key: `links:${chunkIndex}`,
          buckets: linkBuckets,
          publish: setIssueLinks,
          sourceQuery: query(
            collection(db, 'issueLinks'),
            where('organizationId', '==', activeOrgId),
            where('projectId', 'in', chunk),
          ),
        });
      }

      // Task and calendar logs must remain separate queries. Rules can then
      // prove that restricted calendar entries can never satisfy analytics.
      if (includeTimeLogs) {
        subscribe({
          key: `time:task:${chunkIndex}`,
          buckets: timeLogBuckets,
          publish: setTimeLogs,
          sourceQuery: query(
            collection(db, 'timeLogs'),
            where('organizationId', '==', activeOrgId),
            where('projectId', 'in', chunk),
            where('issueId', '!=', ''),
          ),
        });
        subscribe({
          key: `time:calendar:${chunkIndex}`,
          buckets: timeLogBuckets,
          publish: setTimeLogs,
          sourceQuery: query(
            collection(db, 'timeLogs'),
            where('organizationId', '==', activeOrgId),
            where('projectId', 'in', chunk),
            where('sourceType', '==', 'calendar_event'),
            where('eventVisibility', '==', 'team'),
          ),
        });
      }
    });

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [activeOrgId, authLoading, orgLoading, projectScope, queryLimit, queryTarget, includeLinks, includeTimeLogs]);

  return { issues, timeLogs, issueLinks, loading, loadingMore, hasMore, loadMore };
}
