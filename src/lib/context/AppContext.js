'use client';
// src/lib/context/AppContext.js
import { createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProjects } from '@/lib/hooks/useProjects';
import { acceptPendingInvitation } from '@/lib/hooks/useOrganization';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { projects, loading: projectsLoading } = useProjects(user?.id);

  // When user signs in: init org if needed + accept pending invitations
  useEffect(() => {
    if (!user) return;

    const uid   = user.id || user.uid;
    const email = user.email;

    (async () => {
      try {
        const orgRef  = doc(db, 'organizations', ORG_ID);
        const orgSnap = await getDoc(orgRef);

        if (!orgSnap.exists()) {
          // First user ever → becomes owner
          await setDoc(orgRef, {
            id: ORG_ID,
            name: 'QuickTeam',
            ownerId: uid,
            members: [{ uid, role: 'owner', joinedAt: new Date().toISOString() }],
            createdAt: new Date().toISOString(),
          });
        } else {
          const members = orgSnap.data().members || [];
          const isAlreadyMember = members.some(m => m.uid === uid);

          if (!isAlreadyMember) {
            // Check pending invitations
            const accepted = await acceptPendingInvitation(uid, email);
            if (!accepted) {
              // Not invited → still add as member (open workspace)
              // Remove this line if you want strict invite-only access
              await updateDoc(orgRef, {
                members: arrayUnion({ uid, role: 'member', joinedAt: new Date().toISOString() }),
              });
            }
          }
        }
      } catch (err) {
        console.error('[AppContext] org init error:', err);
      }
    })();
  }, [user?.id]); // eslint-disable-line

  const value = {
    authLoading,
    projectsLoading,
    signInWithGoogle,
    signOut,
    currentUser: user,
    projects,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};

