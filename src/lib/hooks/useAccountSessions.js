'use client';

// The «Безпека» panel's data: how this account can be signed into, when it last
// was, and which devices it is signed in on.
//
// The sign-in methods and the last sign-in come from the Firebase Auth user
// already in memory — no read at all. The device list is one document, fetched
// when the panel asks for it rather than subscribed, because nothing on this
// screen changes while somebody is looking at it.

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';
import { activityHeartbeatDue, markActivityHeartbeat } from '@/lib/utils/activity';
import { reportLoadError } from '@/lib/utils/errors';
import { listSessions } from '@/lib/utils/accountSessions.mjs';

const SESSION_ID_KEY = 'qt:session-id';
// A browser that is open all day writes this twice. The row's value is "which
// devices", not "to the minute".
const RECORD_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** This browser's own id, minted once and kept for as long as its storage lives. */
export function deviceSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const minted = crypto.randomUUID();
    window.localStorage.setItem(SESSION_ID_KEY, minted);
    return minted;
  } catch {
    // Private mode: the session is real, it just will not be recognised again.
    return null;
  }
}

/**
 * Records this device against the signed-in account. Mounted once, high in the
 * authenticated tree — the panel must be able to show a device without the
 * reader having to open the panel first.
 */
export function useRecordAccountSession(userId) {
  useEffect(() => {
    if (!userId) return undefined;
    const sessionId = deviceSessionId();
    if (!sessionId) return undefined;
    const key = `account-session:${userId}`;
    if (!activityHeartbeatDue(key, RECORD_INTERVAL_MS)) return undefined;

    let cancelled = false;
    // Deliberately not `claimActivityHeartbeat`: that one refuses a tab that is
    // not visible, and it books the interval before the request is sent. Both
    // are wrong here. A workspace restored into a background tab is still a
    // sign-in worth recording, and a failed write must not leave the panel
    // empty for twelve hours — the mark is made only once the write lands, so
    // the next mount tries again.
    authenticatedRequest('/api/account/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }, 'Не вдалося зберегти сеанс')
      .then(() => { if (!cancelled) markActivityHeartbeat(key); })
      .catch(() => {
        // A security panel that is one device short is worth less than a
        // workspace that refuses to open, so this stays silent.
      });
    return () => { cancelled = true; };
  }, [userId]);
}

export function useAccountSessions(userId) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // Minted once for this browser and never again; a lazy initializer keeps the
  // storage read off every render.
  const [currentSessionId] = useState(deviceSessionId);

  useEffect(() => {
    let cancelled = false;
    const publish = update => { if (!cancelled) update(); };
    if (!userId) {
      queueMicrotask(() => publish(() => { setSessions([]); setLoading(false); }));
      return () => { cancelled = true; };
    }
    queueMicrotask(() => publish(() => setLoading(true)));
    getDoc(doc(db, 'users', userId, 'settings', 'sessions'))
      .then(snapshot => publish(() => {
        setSessions(listSessions(snapshot.data(), { currentSessionId }));
        setLoading(false);
      }))
      .catch(error => {
        reportLoadError('[useAccountSessions]', error);
        publish(() => { setSessions([]); setLoading(false); });
      });
    return () => { cancelled = true; };
  }, [currentSessionId, userId]);

  const endSession = useCallback(async sessionId => {
    setBusyId(sessionId);
    try {
      await authenticatedRequest(
        `/api/account/sessions?sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
        'Не вдалося завершити сеанс',
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const signInUser = auth.currentUser;
  return {
    sessions,
    loading,
    busyId,
    endSession,
    currentSessionId,
    providerData: signInUser?.providerData || [],
    lastSignInAt: signInUser?.metadata?.lastSignInTime || null,
    createdAt: signInUser?.metadata?.creationTime || null,
  };
}
