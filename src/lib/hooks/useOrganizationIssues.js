'use client';

// src/lib/hooks/useOrganizationIssues.js
// Every task of every project this account can open, read once and kept.
//
// What this replaces, and why it is worth a module.
//
// The projects screen is the workspace's front door: it is where a sign-in
// lands, where the logo goes, where switching organization goes, and where you
// come back to between every other screen. It is also the widest read in the
// product — the per-project figures on the cards are computed from the tasks
// themselves, so drawing it means reading every task in the organization.
//
// That subscription lived inside the screen's own component, so it was torn
// down on the way out and built again on the way back, and a rebuilt listener
// is a fresh query. Ten visits to the front door was ten reads of the whole
// task set, from a project running on Firestore's free daily quota. Nothing in
// the product measured that, which is exactly how a day's allowance went
// missing without anybody being able to say to what.
//
// A listener does not have to be torn down when a screen is. This one is
// refcounted and keyed by what it reads, so a second reader shares it rather
// than opening a second copy, and leaving the screen only starts a timer:
// coming back inside GRACE_MS finds it still attached, still current, and
// costing nothing. Firestore charges for documents delivered, not for a
// listener sitting still.
//
// The grace window is generous on purpose. It is not a cache — the listener is
// live the whole time, so what it holds is never stale — it is only the answer
// to "how long is somebody likely to be away before coming back here", and for
// the front door of a workspace that is minutes, not seconds.

import { useMemo, useSyncExternalStore } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';
import {
  chunkProjectIds,
  flattenDocumentBuckets,
} from '@/lib/utils/projectScopedQueries.mjs';
import { withoutArchivedIssues } from '@/lib/utils/issueArchive.mjs';
import { withoutCancelledIssues } from '@/lib/utils/issueCancel.mjs';

const GRACE_MS = 5 * 60 * 1000;

const EMPTY_SNAPSHOT = Object.freeze({ issues: [], error: null, loading: true });
const stores = new Map();

function createOrganizationIssuesStore(organizationId, projectIds) {
  const listeners = new Set();
  let snapshot = EMPTY_SNAPSHOT;
  let unsubscribes = [];
  let stopTimer = null;

  const emit = next => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const start = () => {
    if (unsubscribes.length) return;
    const buckets = new Map();
    unsubscribes = chunkProjectIds(projectIds).map((chunk, chunkIndex) => onSnapshot(
      query(
        collection(db, 'issues'),
        where('organizationId', '==', organizationId),
        where('projectId', 'in', chunk),
      ),
      { includeMetadataChanges: true },
      documentSnapshot => {
        buckets.set(chunkIndex, documentSnapshot.docs.map(document => ({
          ...document.data({ serverTimestamps: 'estimate' }),
          id: document.id,
        })));
        // Archived work has left the present and cancelled work was never in
        // it, so neither belongs in a count of what a project still owes. The
        // filter is applied here rather than in the query because Firestore
        // cannot ask for a field that is absent, and `archivedAt` is absent
        // until something archives the task — see docs/ROADMAP.md.
        emit({
          issues: withoutCancelledIssues(withoutArchivedIssues(flattenDocumentBuckets(buckets))),
          error: null,
          loading: false,
        });
      },
      error => {
        reportLoadError('[useOrganizationIssues]', error);
        emit({ ...snapshot, error, loading: false });
      },
    ));
  };

  const stop = () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
    unsubscribes = [];
    snapshot = EMPTY_SNAPSHOT;
  };

  const store = {
    subscribe: listener => {
      if (stopTimer) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stopTimer = window.setTimeout(() => {
          stopTimer = null;
          stop();
          // Dropped rather than kept empty: the key carries the project list,
          // so a workspace that gains or loses a project would otherwise leave
          // a dead store behind for every arrangement it ever had.
          for (const [key, candidate] of stores) {
            if (candidate === store) stores.delete(key);
          }
        }, GRACE_MS);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY_SNAPSHOT,
  };

  return store;
}

const emptyStore = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY_SNAPSHOT,
  getServerSnapshot: () => EMPTY_SNAPSHOT,
};

/**
 * @param {string} organizationId Active organization.
 * @param {string[]} projectIds Projects this account can open. The read is
 *   scoped to them because Firestore applies the read rule to every candidate
 *   row: one unreachable project rejects a query over the whole organization.
 * @returns {{issues: object[], error: Error|null, loading: boolean}} The
 *   working set — archived and cancelled tasks already removed.
 */
export function useOrganizationIssues(organizationId, projectIds = []) {
  // The key is the read, so two callers asking for the same thing get the same
  // listener and a caller whose scope changed gets a different one.
  const scope = useMemo(
    () => [...new Set((projectIds || []).filter(Boolean))].sort().join(','),
    [projectIds],
  );
  const store = useMemo(() => {
    if (!organizationId || !scope) return emptyStore;
    const key = `${organizationId}|${scope}`;
    if (!stores.has(key)) {
      stores.set(key, createOrganizationIssuesStore(organizationId, scope.split(',')));
    }
    return stores.get(key);
  }, [organizationId, scope]);

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
