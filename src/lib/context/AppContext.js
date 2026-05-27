'use client';
// src/lib/context/AppContext.js
import { createContext, useContext, useEffect } from 'react';
import { useAuth }         from '@/lib/hooks/useAuth';
import { useProjects }     from '@/lib/hooks/useProjects';
import { acceptPendingInvitation } from '@/lib/hooks/useOrganization';
import { OrgProvider, useOrg } from '@/lib/context/OrgContext';
import { runMigrations } from '@/lib/migrations/runMigrations';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AppContext = createContext(null);

// ─── Inner provider (has access to OrgContext) ────────────────────────────
function AppProviderInner({ user, authLoading, signInWithGoogle, signOut, children }) {
  const { allOrgs, activeOrgId, activeOrg, orgRole, orgLoading, noOrg, switchOrg, setActiveOrgId } = useOrg();
  const { projects, loading: projectsLoading } = useProjects(user?.id, activeOrgId);

  // When user signs in: init org if needed + accept pending invitations
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const uid   = user.id || user.uid;
        const email = user.email;

        // Check pending invitations across all orgs
        if (email) {
          await acceptPendingInvitation(uid, email);
        }

        // Run one-time migrations (idempotent — safe to call every login)
        await runMigrations();
      } catch (err) {
        console.error('[AppContext] init error:', err);
      }
    })();
  }, [user?.id]); // eslint-disable-line

  // Update presence
  useEffect(() => {
    if (!user) return;
    const uid = user.id || user.uid;
    const updatePresence = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await setDoc(doc(db, 'presence', uid), {
            online: true,
            lastSeen: serverTimestamp(),
            email: user.email,
          }, { merge: true });
        } catch {}
      }
    };
    updatePresence();
    document.addEventListener('visibilitychange', updatePresence);
    return () => document.removeEventListener('visibilitychange', updatePresence);
  }, [user]);

  const value = {
    authLoading,
    projectsLoading,
    orgLoading,
    signInWithGoogle,
    signOut,
    currentUser: user,
    projects,
    // Org-related
    activeOrgId,
    activeOrg,
    orgRole,
    noOrg,
    allOrgs,
    switchOrg,
    setActiveOrgId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Outer provider: sets up auth, wraps OrgProvider ─────────────────────
export function AppProvider({ children }) {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  return (
    <OrgProvider user={user}>
      <AppProviderInner
        user={user}
        authLoading={authLoading}
        signInWithGoogle={signInWithGoogle}
        signOut={signOut}
      >
        {children}
      </AppProviderInner>
    </OrgProvider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  // During SSG prerender, AppProvider is not present — return safe defaults
  if (!ctx) {
    return {
      authLoading: true,
      projectsLoading: true,
      orgLoading: true,
      signInWithGoogle: async () => {},
      signOut: async () => {},
      currentUser: null,
      projects: [],
      activeOrgId: null,
      activeOrg: null,
      orgRole: null,
      noOrg: false,
      allOrgs: [],
      switchOrg: () => {},
      setActiveOrgId: () => {},
    };
  }
  return ctx;
};
