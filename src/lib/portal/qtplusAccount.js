'use client';

// src/lib/portal/qtplusAccount.js
// Linking and unlinking the signed-in user's QuickTeam+ account.
//
// This used to live inline in a settings tab of its own, which meant the one
// place the connection is actually needed — a project's QuickTeam+ tab — could
// only tell people to go elsewhere. The flow is here so the project can own it.

import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getPortalAuth } from '@/lib/portal/firebase';

// The authorize URL is built server-side: only the server can set the httpOnly
// cookie holding the CSRF nonce that the callback checks. `returnTo` comes back
// through the callback, so the round-trip ends where it started.
export function startQtPlusConnect(returnTo = '') {
  const query = returnTo ? `?r=${encodeURIComponent(returnTo)}` : '';
  window.location.href = `/api/integrations/qtplus/connect${query}`;
}

export async function disconnectQtPlusAccount() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error('NOT_SIGNED_IN');

  const idToken = await firebaseUser.getIdToken(true);
  const response = await fetch('/api/integrations/qtplus', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) throw new Error('DISCONNECT_FAILED');

  // Best effort: drop the named portal Firebase session too, so the browser is
  // not left auto-refreshing a live portal login after the link is gone. Must
  // never throw out of the disconnect itself.
  const portalAuth = getPortalAuth();
  if (portalAuth) {
    try {
      await firebaseSignOut(portalAuth);
    } catch {
      /* best-effort: portal sign-out must not block disconnect */
    }
  }
}
