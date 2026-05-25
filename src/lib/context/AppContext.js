'use client';
// src/lib/context/AppContext.js
import { createContext, useContext, useEffect } from 'react';
import { useAuth }         from '@/lib/hooks/useAuth';
import { useProjects }     from '@/lib/hooks/useProjects';
import { acceptPendingInvitation } from '@/lib/hooks/useOrganization';
import { OrgProvider, useOrg } from '@/lib/context/OrgContext';
import { runMigrations } from '@/lib/migrations/runMigrations';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AppContext = createContext(null);

// ─── Inner provider (has access to OrgContext) ────────────────────────────
function AppProviderInner({ user, authLoading, signInWithGoogle, signOut, children }) {
  const { activeOrgId, activeOrg, orgRole, orgLoading, noOrg } = useOrg();
  const { projects, loading: projectsLoading } = useProjects(user?.id, activeOrgId);

  // When user signs in: init org if needed + accept pending invitations
  useEffect(() => {
    if (!user) return;

    const uid   = user.id || user.uid;
    const email = user.email;

    (async () => {
      try {
        // If the user has no org yet, check for pending invitations
        // and auto-create org if they're the very first user
        const defaultOrgId = process.env.NEXT_PUBLIC_ORG_ID || 'quickteam';
        const orgRef  = doc(db, 'organizations', defaultOrgId);
        const orgSnap = await getDoc(orgRef);

        if (!orgSnap.exists()) {
          // Very first user → becomes owner and creates the org
          await setDoc(orgRef, {
            id: defaultOrgId,
            name: 'QuickTeam',
            ownerId: uid,
            memberUids: [uid],
            members: [{ uid, role: 'owner', joinedAt: new Date().toISOString() }],
            createdAt: new Date().toISOString(),
          });
        } else {
          const orgData = orgSnap.data();
          const members = orgData.members || [];
          const isAlreadyMember = members.some(m => m.uid === uid);

          if (!isAlreadyMember) {
            // Check pending invitations
            const accepted = await acceptPendingInvitation(uid, email);
            if (!accepted) {
              // Not invited → do NOT auto-add (strict multi-tenant boundary)
              console.warn('[AppContext] User not invited to any org. Showing onboarding.');
            }
          }
        }

        // Run one-time migrations (idempotent — safe to call every login)
        await runMigrations();
      } catch (err) {
        console.error('[AppContext] org init error:', err);
      }
    })();
  }, [user?.id]); // eslint-disable-line

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
    };
  }
  return ctx;
};
