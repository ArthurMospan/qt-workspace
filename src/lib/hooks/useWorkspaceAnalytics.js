'use client';

// Loads issues and time logs only for the already-authorized project list.
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';

// Firestore `in` accepts at most 30 values; ten keeps query/index fan-out tame.
function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function flattenBuckets(buckets) {
  const byId = {};
  buckets.forEach(documents => {
    documents.forEach(document => {
      byId[document.id] = document;
    });
  });
  return Object.values(byId);
}

export function useWorkspaceAnalytics(projectIds = []) {
  const { activeOrgId } = useAppContext();
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
        setLoading(false);
      });
      return undefined;
    }

    queueMicrotask(() => {
      setLoading(true);
      setIssues([]);
      setTimeLogs([]);
      setIssueLinks([]);
    });

    const chunks = chunkArray([...new Set(projectIds.filter(Boolean))], 10);
    const issueBuckets = new Map();
    const timeLogBuckets = new Map();
    const readyStreams = new Set();
    const expectedStreamCount = chunks.length + (chunks.length * 2) + 2;
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
          publish(flattenBuckets(buckets));
          markReady(key);
        },
        error => {
          reportLoadError(`[useWorkspaceAnalytics:${key}]`, error);
          buckets.set(key, []);
          publish(flattenBuckets(buckets));
          markReady(key);
        },
      );
      unsubs.push(unsubscribe);
    };

    const linksKey = 'links';
    const linksQuery = query(
      collection(db, 'issueLinks'),
      where('organizationId', '==', activeOrgId),
    );
    unsubs.push(onSnapshot(
      linksQuery,
      { serverTimestamps: 'estimate' },
      snapshot => {
        setIssueLinks(snapshot.docs.map(document => ({
          id: document.id,
          ...document.data(),
        })));
        markReady(linksKey);
      },
      error => {
        reportLoadError('[useWorkspaceAnalytics:links]', error);
        setIssueLinks([]);
        markReady(linksKey);
      },
    ));

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
  }, [activeOrgId, projectIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { issues, timeLogs, issueLinks, loading };
}
