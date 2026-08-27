'use client';

// src/lib/hooks/useProjectActivity.js
// The last few things that happened in one project.
//
// ── Why this is a hook and not a filter ──────────────────────────────────
//
// The home screen draws three activity lines on its featured project card, and
// it used to get them by subscribing to every task of every project the account
// can open and sorting the lot in memory. Three lines, seven hundred documents.
// That subscription was the widest read in the product and it was on the screen
// a sign-in lands on (docs/ARCHITECTURE.md → «Вартість читання»).
//
// Firestore can answer the question that was actually being asked: the three
// most recently touched tasks of one project, ordered and limited by the
// database rather than by the browser. Three documents, and the listener stays
// live so the card keeps updating the way it did.
//
// ── What it deliberately does not do ─────────────────────────────────────
//
// It is not a task reader. Nothing may use this to draw a list, a count or a
// board: it returns whatever few documents the limit allows, in one order, and
// a screen that needs the tasks needs `useOrganizationIssues`.
//
// `orderBy('lastActivityAt')` excludes tasks that carry no activity stamp at
// all. That is the right exclusion — this card says what somebody did, and a
// task nobody has touched has nothing to say — and it matches what the old
// in-memory version filtered out anyway.

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';

const EMPTY = Object.freeze([]);

/**
 * @param {string} organizationId Active organization.
 * @param {string} projectId The one project to watch. Nothing is read without it.
 * @param {number} count How many documents to keep. Always passed to `limit()`.
 */
export function useProjectActivity(organizationId, projectId, count = 3) {
  const [issues, setIssues] = useState(EMPTY);

  useEffect(() => {
    // `queueMicrotask` rather than a bare call: setting state synchronously in
    // an effect body is a cascading render, and eslint's react-hooks rules
    // refuse it. The same shape as every other listener hook here.
    if (!organizationId || !projectId || count <= 0) {
      queueMicrotask(() => setIssues(EMPTY));
      return undefined;
    }
    const activityQuery = query(
      collection(db, 'issues'),
      where('organizationId', '==', organizationId),
      where('projectId', '==', projectId),
      orderBy('lastActivityAt', 'desc'),
      limit(count),
    );
    const unsubscribe = onSnapshot(
      activityQuery,
      { serverTimestamps: 'estimate' },
      snapshot => setIssues(snapshot.docs.map(document => ({
        ...document.data(),
        id: document.id,
      }))),
      error => {
        reportLoadError('[useProjectActivity]', error);
        setIssues(EMPTY);
      },
    );
    return unsubscribe;
  }, [organizationId, projectId, count]);

  return issues;
}
