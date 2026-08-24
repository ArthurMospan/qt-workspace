'use client';

// Loads issues and time logs only for the already-authorized project list.
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { withoutArchivedIssues } from '@/lib/utils/issueArchive.mjs';
import {
  cancelledIssuesOf,
  withoutCancelledIssues,
} from '@/lib/utils/issueCancel.mjs';
import {
  isTimeLogWindow,
  timeLogWindowKey,
} from '@/lib/utils/analyticsWindow.mjs';
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
 *
 * ── Вікно часу ───────────────────────────────────────────────────────────
 *
 * Tasks are a bounded set: one document per piece of work, and a workspace has
 * as many as it has work. Time logs are not. One is written every time somebody
 * stops a timer — daily, per person, forever — and the screen that said «за 30
 * днів» used to read all of them and drop the rest in the browser.
 *
 * So `timeLogWindow` is not optional when time logs are wanted: the caller says
 * which period it is about to draw, and that period becomes a bound in the
 * query. Without one this hook reads no logs at all and reports the misuse,
 * rather than quietly falling back to the whole history — that fallback is
 * precisely the bug this exists to prevent.
 *
 * The tasks and the logs are two effects rather than one, because they move on
 * different clocks. The task set changes when the project scope changes; the
 * log window changes whenever somebody picks another period or pages the
 * timesheet back a week. Sharing one effect meant every period change tore down
 * and re-read every task in the organization to answer a question about hours.
 */
export function useWorkspaceAnalytics(projectIds = [], {
  includeLinks = true,
  includeTimeLogs = true,
  timeLogWindow = null,
} = {}) {
  const { activeOrgId, authLoading, orgLoading } = useAppContext();
  const [allIssues, setAllIssues] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [timeLogsLoading, setTimeLogsLoading] = useState(true);
  const projectScope = [...new Set(projectIds.filter(Boolean))].sort().join(',');
  const windowedTimeLogs = includeTimeLogs && isTimeLogWindow(timeLogWindow);
  const sinceMillis = windowedTimeLogs ? timeLogWindow.sinceMillis : null;
  const untilMillis = windowedTimeLogs && Number.isFinite(timeLogWindow.untilMillis)
    ? timeLogWindow.untilMillis
    : null;
  const issueTarget = `${activeOrgId || ''}/${projectScope}/${includeLinks ? 'links' : 'no-links'}`;
  const timeTarget = `${activeOrgId || ''}/${projectScope}/${windowedTimeLogs ? timeLogWindowKey(timeLogWindow) : 'no-time'}`;
  const issueTargetRef = useRef('');
  const timeTargetRef = useRef('');

  useEffect(() => {
    if (includeTimeLogs && !windowedTimeLogs) {
      reportLoadError(
        '[useWorkspaceAnalytics]',
        new Error('timeLogWindow is required whenever includeTimeLogs is on'),
      );
    }
  }, [includeTimeLogs, windowedTimeLogs]);

  // ── Tasks and links ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeOrgId) {
      issueTargetRef.current = '';
      queueMicrotask(() => {
        setAllIssues([]);
        setIssueLinks([]);
        // Still resolving the organization is not the same as having read it
        // and found nothing — the difference is a spinner versus an empty
        // state that says the workspace has no data.
        setIssuesLoading(Boolean(authLoading || orgLoading));
      });
      return undefined;
    }

    if (issueTargetRef.current !== issueTarget) {
      issueTargetRef.current = issueTarget;
      queueMicrotask(() => {
        setIssuesLoading(true);
        setAllIssues([]);
        setIssueLinks([]);
      });
    }

    const chunks = chunkProjectIds(projectScope ? projectScope.split(',') : []);
    const issueBuckets = new Map();
    const linkBuckets = new Map();
    const readyStreams = new Set();
    const expectedStreamCount = chunks.length * (1 + (includeLinks ? 1 : 0));
    const unsubs = [];
    if (expectedStreamCount === 0) {
      queueMicrotask(() => setIssuesLoading(false));
    }
    const subscribe = options => unsubs.push(subscribeToBucket({
      ...options,
      readyStreams,
      expectedStreamCount,
      onReady: () => setIssuesLoading(false),
    }));

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
    });

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [activeOrgId, authLoading, orgLoading, projectScope, issueTarget, includeLinks]);

  // ── Time logs, inside the window the caller is drawing ──────────────────
  useEffect(() => {
    if (!activeOrgId || !windowedTimeLogs) {
      timeTargetRef.current = '';
      queueMicrotask(() => {
        setTimeLogs([]);
        setTimeLogsLoading(!activeOrgId && Boolean(authLoading || orgLoading));
      });
      return undefined;
    }

    if (timeTargetRef.current !== timeTarget) {
      timeTargetRef.current = timeTarget;
      queueMicrotask(() => {
        setTimeLogsLoading(true);
        setTimeLogs([]);
      });
    }

    // The window, as Firestore bounds rather than as a browser predicate. The
    // component that draws the period re-applies the same edges to what comes
    // back; the query is what decides how much comes back at all.
    const windowBounds = [
      where('loggedAt', '>=', Timestamp.fromMillis(sinceMillis)),
      ...(untilMillis === null
        ? []
        : [where('loggedAt', '<', Timestamp.fromMillis(untilMillis))]),
    ];

    const chunks = chunkProjectIds(projectScope ? projectScope.split(',') : []);
    const timeLogBuckets = new Map();
    const readyStreams = new Set();
    const expectedStreamCount = chunks.length * 2 + 1;
    const unsubs = [];
    const subscribe = options => unsubs.push(subscribeToBucket({
      ...options,
      buckets: timeLogBuckets,
      publish: setTimeLogs,
      readyStreams,
      expectedStreamCount,
      onReady: () => setTimeLogsLoading(false),
    }));

    // Projectless team events are organization analytics only and cannot be
    // invoiced until attached to a project.
    subscribe({
      key: 'calendar:organization',
      sourceQuery: query(
        collection(db, 'timeLogs'),
        where('organizationId', '==', activeOrgId),
        where('projectId', '==', ''),
        where('sourceType', '==', 'calendar_event'),
        where('eventVisibility', '==', 'team'),
        ...windowBounds,
      ),
    });

    // Task and calendar logs must remain separate queries. Rules can then
    // prove that restricted calendar entries can never satisfy analytics.
    chunks.forEach((chunk, chunkIndex) => {
      subscribe({
        key: `time:task:${chunkIndex}`,
        sourceQuery: query(
          collection(db, 'timeLogs'),
          where('organizationId', '==', activeOrgId),
          where('projectId', 'in', chunk),
          where('issueId', '!=', ''),
          ...windowBounds,
        ),
      });
      subscribe({
        key: `time:calendar:${chunkIndex}`,
        sourceQuery: query(
          collection(db, 'timeLogs'),
          where('organizationId', '==', activeOrgId),
          where('projectId', 'in', chunk),
          where('sourceType', '==', 'calendar_event'),
          where('eventVisibility', '==', 'team'),
          ...windowBounds,
        ),
      });
    });

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [
    activeOrgId,
    authLoading,
    orgLoading,
    projectScope,
    timeTarget,
    windowedTimeLogs,
    sinceMillis,
    untilMillis,
  ]);

  const record = useMemo(() => withoutCancelledIssues(allIssues), [allIssues]);
  const issues = useMemo(() => withoutArchivedIssues(record), [record]);
  const cancelledIssues = useMemo(() => cancelledIssuesOf(allIssues), [allIssues]);
  // The hours follow the task out. Time logs arrive on their own subscription
  // and are read straight — the timesheet and the period totals do not join
  // them back to the issue list — so a cancelled task's hours would go on being
  // counted while the task itself had left every chart above them. Calendar
  // logs carry no `issueId` and are untouched.
  const cancelledIssueIds = useMemo(
    () => new Set(cancelledIssues.map(issue => issue.id)),
    [cancelledIssues],
  );
  const recordTimeLogs = useMemo(
    () => (cancelledIssueIds.size
      ? timeLogs.filter(log => !log?.issueId || !cancelledIssueIds.has(log.issueId))
      : timeLogs),
    [cancelledIssueIds, timeLogs],
  );

  return {
    issues,
    allIssues: record,
    cancelledIssues,
    timeLogs: recordTimeLogs,
    issueLinks,
    loading: issuesLoading || (windowedTimeLogs && timeLogsLoading),
  };
}

function subscribeToBucket({
  key,
  sourceQuery,
  buckets,
  publish,
  readyStreams,
  expectedStreamCount,
  onReady,
}) {
  const markReady = () => {
    readyStreams.add(key);
    if (readyStreams.size >= expectedStreamCount) onReady();
  };
  return onSnapshot(
    sourceQuery,
    { serverTimestamps: 'estimate' },
    snapshot => {
      buckets.set(key, snapshot.docs.map(document => ({
        id: document.id,
        ...document.data(),
      })));
      publish(flattenDocumentBuckets(buckets));
      markReady();
    },
    error => {
      reportLoadError(`[useWorkspaceAnalytics:${key}]`, error);
      buckets.set(key, []);
      publish(flattenDocumentBuckets(buckets));
      markReady();
    },
  );
}
