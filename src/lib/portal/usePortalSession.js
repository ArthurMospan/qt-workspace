'use client';
import { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getPortalAuth } from '@/lib/portal/firebase';

/**
 * Signs into the QuickTeam+ (portal) Firebase project as the connected user,
 * using a short-lived custom token fetched from our own session route. Touches
 * only the portal auth instance — never the primary workspace auth.
 */
export function usePortalSession() {
  const [portalUser, setPortalUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const portalAuth = getPortalAuth();
      if (!portalAuth) { if (!cancelled) setLoading(false); return; } // integration not configured

      try {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) { if (!cancelled) setLoading(false); return; }

        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/api/integrations/qtplus/session', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.status === 404) { if (!cancelled) { setLoading(false); setError('not_connected'); } return; }
        if (res.status === 409) { if (!cancelled) { setLoading(false); setError('grant_invalid'); } return; }
        if (!res.ok) { if (!cancelled) { setLoading(false); setError('upstream'); } return; }

        const { customToken } = await res.json();
        const cred = await signInWithCustomToken(portalAuth, customToken);
        if (!cancelled) { setPortalUser(cred.user); setLoading(false); }
      } catch (err) {
        console.error('[qtplus] portal session failed:', err);
        if (!cancelled) { setError('upstream'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { portalUser, loading, error };
}
