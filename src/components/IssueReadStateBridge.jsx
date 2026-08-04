'use client';

import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAppContext } from '@/lib/context/AppContext';
import { db } from '@/lib/firebase';
import { timestampMillis } from '@/lib/utils/issueReadState.mjs';
import { reportLoadError } from '@/lib/utils/errors';
import useWorkspaceStore from '@/store/useWorkspaceStore';

// One organization-wide cursor stream feeds every issue card. Keeping this at
// the workspace boundary avoids one Firestore listener per card or per board.
export default function IssueReadStateBridge() {
  const { activeOrgId, currentUser } = useAppContext();
  const userId = currentUser?.uid || currentUser?.id || null;
  const setIssueReadState = useWorkspaceStore(state => state.setIssueReadState);

  useEffect(() => {
    if (!activeOrgId || !userId) {
      queueMicrotask(() => setIssueReadState({}));
      return undefined;
    }

    queueMicrotask(() => setIssueReadState({}));

    const readStateQuery = query(
      collection(db, 'organizations', activeOrgId, 'issueReadState'),
      where('userId', '==', userId),
    );
    const unsubscribe = onSnapshot(readStateQuery, snapshot => {
      const state = {};
      snapshot.forEach(cursorDocument => {
        const cursor = cursorDocument.data();
        if (cursor.issueId) state[cursor.issueId] = timestampMillis(cursor.lastSeenAt);
      });
      setIssueReadState(state);
    }, error => {
      reportLoadError('[IssueReadStateBridge]', error);
    });

    return () => unsubscribe();
  }, [activeOrgId, setIssueReadState, userId]);

  useEffect(() => () => setIssueReadState({}), [setIssueReadState]);

  return null;
}
