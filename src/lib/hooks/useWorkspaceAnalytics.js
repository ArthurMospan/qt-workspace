'use client';

// Loads issues and time logs only for the already-authorized project list.
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { withoutArchivedIssues } from '@/lib/utils/issueArchive.mjs';
import {
  cancelledIssuesOf,
  withoutCancelledIssues,
} from '@/lib/utils/issueCancel.mjs';
import {
  chunkProjectIds,
  flattenDocumentBuckets,
} from '@/lib/utils/projectScopedQueries.mjs';

/**
 * One subscription, three readings of it.
 *
 * `issues` is the working set — what is being worked on now. Archived tasks are
 * not in it, so boards, counts, workload and progress do not carry work nobody
 * is doing.
 *
 * `allIssues` includes them, because a task leaving the present does not leave
 * the past: hours recorded against it are still hours somebody worked, and an
 * invoice built without them would quietly bill less than was done. Anything
 * reasoning about what *happened* reads this one; anything reasoning about what
 * is *open* reads the other.
 *
 * A cancelled task is in neither. Work that is not going to happen is not part
 * of the present and did not happen in the past, so it is filtered out here
 * rather than at each of the several dozen places that would otherwise have to
 * remember. `cancelledIssues` is what «Архів» → «Скасовані» lists, and the only
 * reader that gets them.
 */
export function useWorkspaceAnalytics(projectIds = [], {
  includeLinks = true,
  includeTimeLogs = true,
} = {}) {
  const { activeOrgId, authLoading, orgLoading } = useAppContext();
  const [allIssues, setAllIssues] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const projectScope = [...new Set(projectIds.filter(Boolean))].sort().join(',');
  const queryTarget = `${activeOrgId || ''}/${projectScope}/${includeLinks ? 'links' : 'no-links'}/${includeTimeLogs ? 'time' : 'no-time'}`;
  const targetRef = useRef('');

  useEffect(() => {
    if (!activeOrgId) {
      targetRef.current = '';
      queueMicrotask(() => {
        setAllIssues([]);
        setTimeLogs([]);
        setIssueLinks([]);
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
        setAllIssues([]);
        setTimeLogs([]);
        setIssueLinks([]);
      });
    }

    const chunks = chunkProjectIds(projectScope ? projectScope.split(',') : []);
    const issueBuckets = new Map();
    const timeLogBuckets = new Map();
    const linkBuckets = new Map();
    const readyStreams = new Set();
    const expectedStreamCount = chunks.length * (
      1 + (includeLinks ? 1 : 0) + (includeTimeLogs ? 2 : 0)
    ) + (includeTimeLogs ? 1 : 0);
    const unsubs = [];
    if (expectedStreamCount === 0) {
      queueMicrotask(() => {
        setLoading(false);
      });
    }
    const markReady = key => {
      readyStreams.add(key);
      if (readyStreams.size >= expectedStreamCount) {
        setLoading(false);
      }
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
        publish: setAllIssues,
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
  }, [activeOrgId, authLoading, orgLoading, projectScope, queryTarget, includeLinks, includeTimeLogs]);

  const record = useMemo(() => withoutCancelledIssues(allIssues), [allIssues]);
  const issues = useMemo(() => withoutArchivedIssues(record), [record]);
  const cancelledIssues = useMemo(() => cancelledIssuesOf(allIssues), [allIssues]);

  return { issues, allIssues: record, cancelledIssues, timeLogs, issueLinks, loading };
}
