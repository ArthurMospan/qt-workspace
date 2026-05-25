'use client';
// src/lib/context/OrgContext.js
// Manages which organization the current user belongs to.
// For v1 (single org per deployment), this reads the user's org membership
// from Firestore and exposes `activeOrgId` and `activeOrg` to all hooks.
// When we scale to true multi-tenancy, we simply add org-switcher logic here.
import { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  doc, getDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const OrgContext = createContext(null);

export function OrgProvider({ user, children }) {
  const [activeOrgId, setActiveOrgId] = useState(null);
  const [activeOrg,   setActiveOrg]   = useState(null);
  const [orgRole,     setOrgRole]     = useState(null);  // role inside the org
  const [orgLoading,  setOrgLoading]  = useState(true);
  const [noOrg,       setNoOrg]       = useState(false); // true → show onboarding

  useEffect(() => {
    if (!user) {
      setActiveOrgId(null);
      setActiveOrg(null);
      setOrgRole(null);
      setOrgLoading(false);
      setNoOrg(false);
      return;
    }

    const uid = user.id || user.uid;

    // Find all organizations where this user is a member
    const findOrg = async () => {
      try {
        // We query organizations where members array contains this uid.
        // Firestore can't query nested array-of-objects, so we use a denormalized
        // flat field `memberUids` alongside the rich `members` array.
        // FALLBACK: if memberUids doesn't exist yet, fall back to scanning all orgs (dev only).
        const q = query(
          collection(db, 'organizations'),
          where('memberUids', 'array-contains', uid)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          // Try legacy format (members array without memberUids index)
          // This is a dev-time fallback — remove in production after migration
          const legacySnap = await getDoc(doc(db, 'organizations', process.env.NEXT_PUBLIC_ORG_ID || 'quickteam'));
          if (legacySnap.exists()) {
            const data = legacySnap.data();
            const members = data.members || [];
            const membership = members.find(m => m.uid === uid);
            if (membership) {
              // Found via legacy format — use it
              setActiveOrgId(legacySnap.id);
              setActiveOrg({ id: legacySnap.id, ...data });
              setOrgRole(membership.role || 'member');
              setOrgLoading(false);
              setNoOrg(false);
              return;
            }
          }
          // Genuinely not in any org
          setNoOrg(true);
          setOrgLoading(false);
          return;
        }

        // User is in one or more orgs — pick the first (for now)
        // In the future we'll let the user switch between orgs
        const orgDoc = snap.docs[0];
        const data = orgDoc.data();
        const members = data.members || [];
        const membership = members.find(m => m.uid === uid);

        setActiveOrgId(orgDoc.id);
        setActiveOrg({ id: orgDoc.id, ...data });
        setOrgRole(membership?.role || 'member');
        setNoOrg(false);
        setOrgLoading(false);
      } catch (err) {
        console.error('[OrgContext] error finding org:', err);
        setOrgLoading(false);
      }
    };

    findOrg();
  }, [user?.id]); // eslint-disable-line

  // Live-sync the active org document once we know the orgId
  useEffect(() => {
    if (!activeOrgId) return;
    const unsub = onSnapshot(doc(db, 'organizations', activeOrgId), (snap) => {
      if (snap.exists()) {
        setActiveOrg({ id: snap.id, ...snap.data() });
        // Re-derive role for current user
        const uid = user?.id || user?.uid;
        const membership = (snap.data().members || []).find(m => m.uid === uid);
        if (membership) setOrgRole(membership.role);
      }
    });
    return () => unsub();
  }, [activeOrgId]); // eslint-disable-line

  return (
    <OrgContext.Provider value={{ activeOrgId, activeOrg, orgRole, orgLoading, noOrg, setActiveOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider');
  return ctx;
};
