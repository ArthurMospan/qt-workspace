'use client';
// src/lib/hooks/useIssueLinks.js — Issue dependency/relationship links
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

// Inverse relation map
const INVERSE = {
  'blocks': 'is-blocked-by',
  'is-blocked-by': 'blocks',
  'duplicates': 'duplicates',
  'relates-to': 'relates-to',
  'subtask-of': 'subtask-of',
};

export function useIssueLinks(issueId) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Keep two independent sets and merge them
  const sourceLinksRef = useRef([]);
  const targetLinksRef = useRef([]);

  const merge = useCallback(() => {
    const all = [...sourceLinksRef.current, ...targetLinksRef.current];
    // Deduplicate by id
    const seen = new Set();
    const deduped = all.filter(l => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
    setLinks(deduped);
  }, []);

  useEffect(() => {
    if (!issueId) {
      setLoading(false);
      return;
    }

    let sourceReady = false;
    let targetReady = false;

    const checkReady = () => {
      if (sourceReady && targetReady) setLoading(false);
    };

    // Query 1: links where this issue is the source
    const q1 = query(
      collection(db, 'issueLinks'),
      where('organizationId', '==', ORG_ID),
      where('sourceIssueId', '==', issueId),
    );

    const unsub1 = onSnapshot(q1, { serverTimestamps: 'estimate' }, (snap) => {
      sourceLinksRef.current = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      sourceReady = true;
      checkReady();
      merge();
    }, (err) => {
      console.error('[useIssueLinks] source query error', err);
      sourceReady = true;
      checkReady();
    });

    // Query 2: links where this issue is the target
    const q2 = query(
      collection(db, 'issueLinks'),
      where('organizationId', '==', ORG_ID),
      where('targetIssueId', '==', issueId),
    );

    const unsub2 = onSnapshot(q2, { serverTimestamps: 'estimate' }, (snap) => {
      targetLinksRef.current = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      targetReady = true;
      checkReady();
      merge();
    }, (err) => {
      console.error('[useIssueLinks] target query error', err);
      targetReady = true;
      checkReady();
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [issueId, merge]);

  // -------------------------------------------------------------------------
  // addLink — creates the primary link and an inverse link
  // -------------------------------------------------------------------------
  const addLink = useCallback(async (sourceId, targetId, relationType, userId) => {
    const base = {
      organizationId: ORG_ID,
      createdBy: userId || null,
      createdAt: serverTimestamp(),
    };

    // Primary link
    await addDoc(collection(db, 'issueLinks'), {
      ...base,
      sourceIssueId: sourceId,
      targetIssueId: targetId,
      relationType,
    });

    // Inverse link
    const inverseType = INVERSE[relationType] ?? 'relates-to';
    await addDoc(collection(db, 'issueLinks'), {
      ...base,
      sourceIssueId: targetId,
      targetIssueId: sourceId,
      relationType: inverseType,
    });
  }, []);

  // -------------------------------------------------------------------------
  // removeLink — deletes a single link document
  // -------------------------------------------------------------------------
  const removeLink = useCallback(async (linkId) => {
    await deleteDoc(doc(db, 'issueLinks', linkId));
  }, []);

  // -------------------------------------------------------------------------
  // hasBlocker — returns true if any open issue is blocking this one
  // allIssues: Issue[] from useIssues
  // -------------------------------------------------------------------------
  const hasBlocker = useCallback((targetIssueId, allIssues) => {
    const blockingLinks = links.filter(
      l => l.relationType === 'blocks' && l.targetIssueId === targetIssueId
    );
    return blockingLinks.some(l => {
      const blocker = allIssues.find(i => i.id === l.sourceIssueId);
      return blocker && blocker.status !== 'done';
    });
  }, [links]);

  return { links, loading, addLink, removeLink, hasBlocker };
}
