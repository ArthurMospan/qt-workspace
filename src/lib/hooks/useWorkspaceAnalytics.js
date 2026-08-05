'use client';

// Loads issues and time logs only for the already-authorized project list.
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import {
  chunkProjectIds,
  flattenDocumentBuckets,
} from '@/lib/utils/projectScopedQueries.mjs';

export function useWorkspaceAnalytics(projectIds = []) {
  const { activeOrgId, authLoading, orgLoading } = useAppContext();
  const [issues, setIssues] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrgId) {
      queueMicrotask(() => {
        setIssues([]);
        setTimeLogs([]);
        setIssueLinks([]);
        // Still resolving the organization is not the same as having read it
        // and found nothing — the difference is a spinner versus an empty
        // state that says the workspace has no data.
        setLoading(Boolean(authLoading || orgLoading));
      });
      return undefined;
    }

    queueMicrotask(() => {
      setLoading(true);
      setIssues([]);
      setTimeLogs([]);
      setIssueLinks([]);
    });

    const chunks = chunkProjectIds(projectIds);
    const issueBuckets = new Map();
    const timeLogBuckets = new Map();
    const linkBuckets = new Map();
    const readyStreams = new Set();
    const expectedStreamCount = (chunks.length * 4) + 1;
    const unsubs = [];
    const markReady = key => {
      readyStreams.add(key);
      if (readyStreams.size >= expectedStreamCount) setLoading(false);
    };
    const subscribe = ({
      key,
      sourceQuery,
      buckets,
      publish,
    }) => {
      const unsubscribe = onSnapshot(
        sourceQuery,
        { serverTimestamps: 'estimate' },
        snapshot => {
          buckets.set(key, snapshot.docs.map(document => ({
            id: document.id,
            ...document.data(),
          })));
          publish(flattenDocumentBuckets(buckets));
          markReady(key);
        },
        error => {
          reportLoadError(`[useWorkspaceAnalytics:${key}]`, error);
          buckets.set(key, []);
          publish(flattenDocumentBuckets(buckets));
          markReady(key);
        },
      );
      unsubs.push(unsubscribe);
    };

    // Projectless team events are organization analytics only and cannot be
    // invoiced until attached to a project.
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

      // Task and calendar logs must remain separate queries. Rules can then
      // prove that restricted calendar entries can never satisfy analytics.
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
    });

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [activeOrgId, authLoading, orgLoading, projectIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { issues, timeLogs, issueLinks, loading };
}
