'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { ANALYTICS_ROLLUPS_COLLECTION } from '@/lib/utils/analyticsRollups.mjs';
import { chunkProjectIds } from '@/lib/utils/projectScopedQueries.mjs';

/**
 * A period's daily totals — one document per project per day.
 *
 * Cost is the number of days on screen, not the amount of work done in them.
 * «За 90 днів» across an active team is thousands of time logs and at most
 * ninety small documents per project; this reads the second thing.
 *
 * A single read rather than a live subscription, and deliberately so. A report
 * is a reading taken at a moment: nothing on this screen is acted on the way a
 * board card or a message is, and a figure that rewrites itself while somebody
 * is looking at it is a distraction rather than a feature. The screen says when
 * it was taken and offers to take another — see `readAt` and `refresh`.
 */
export function useAnalyticsRollups(projectIds = [], { dayRange = null } = {}) {
  const { activeOrgId, authLoading, orgLoading } = useAppContext();
  const [rollups, setRollups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readAt, setReadAt] = useState(null);
  const [nonce, setNonce] = useState(0);
  const projectScope = [...new Set(projectIds.filter(Boolean))].sort().join(',');
  const startDay = dayRange?.startDay || '';
  const endDay = dayRange?.endDay || '';
  const requestRef = useRef(0);

  const refresh = useCallback(() => setNonce(value => value + 1), []);

  useEffect(() => {
    if (!activeOrgId || !startDay || !endDay) {
      queueMicrotask(() => {
        setRollups([]);
        setReadAt(null);
        // Still resolving the organization is not the same as having read it
        // and found nothing.
        setLoading(Boolean(authLoading || orgLoading));
      });
      return undefined;
    }

    const request = requestRef.current + 1;
    requestRef.current = request;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && requestRef.current === request) setLoading(true);
    });

    const chunks = chunkProjectIds(projectScope ? projectScope.split(',') : []);
    const bounds = [
      where('day', '>=', startDay),
      where('day', '<=', endDay),
    ];
    // Team calendar time belongs to the organization rather than to a project,
    // exactly as its raw logs do, so it is its own query — and it is read even
    // when the workspace has no projects at all.
    const queries = [
      query(
        collection(db, ANALYTICS_ROLLUPS_COLLECTION),
        where('organizationId', '==', activeOrgId),
        where('projectId', '==', ''),
        ...bounds,
      ),
      ...chunks.map(chunk => query(
        collection(db, ANALYTICS_ROLLUPS_COLLECTION),
        where('organizationId', '==', activeOrgId),
        where('projectId', 'in', chunk),
        ...bounds,
      )),
    ];

    Promise.all(queries.map(sourceQuery => getDocs(sourceQuery).catch(error => {
      reportLoadError('[useAnalyticsRollups]', error);
      return { docs: [] };
    }))).then(snapshots => {
      if (cancelled || requestRef.current !== request) return;
      setRollups(snapshots.flatMap(snapshot => snapshot.docs.map(document => ({
        id: document.id,
        ...document.data(),
      }))));
      setReadAt(Date.now());
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeOrgId, authLoading, orgLoading, projectScope, startDay, endDay, nonce]);

  return { rollups, loading, readAt, refresh };
}
