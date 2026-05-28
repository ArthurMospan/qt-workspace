'use client';
// src/lib/context/OrgContext.js
// Multi-org context: loads ALL organizations the current user belongs to,
// persists the active org choice to localStorage, and provides switchOrg().
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs,
  doc, getDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const LS_KEY = 'qt_active_org_id';
const OrgContext = createContext(null);

export function OrgProvider({ user, children }) {
  const [allOrgs,     setAllOrgs]     = useState([]);    // all orgs user belongs to
  const [activeOrgId, setActiveOrgId] = useState(null);
  const [activeOrg,   setActiveOrg]   = useState(null);
  const [orgRole,     setOrgRole]     = useState(null);  // role inside the active org
  const [orgLoading,  setOrgLoading]  = useState(true);
  const [noOrg,       setNoOrg]       = useState(false); // true → show onboarding prompt

  // ── Apply an org as active (Internal helper) ─────────────────────────
  const applyOrg = useCallback(async (orgData, uid) => {
    setActiveOrgId(orgData.id);
    setActiveOrg(orgData);
    
    try {
      const memSnap = await getDoc(doc(db, 'orgMemberships', `${orgData.id}_${uid}`));
      if (memSnap.exists()) {
        setOrgRole(memSnap.data().role);
      } else {
        const legacyMember = (orgData.members || []).find(m => m.uid === uid);
        setOrgRole(legacyMember?.role || 'member');
      }
    } catch {
      setOrgRole('member');
    }
    
    setNoOrg(false);
    setOrgLoading(false);
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, orgData.id);
  }, []);

  // ── Load all orgs when user changes ─────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setAllOrgs([]);
      setActiveOrgId(null);
      setActiveOrg(null);
      setOrgRole(null);
      setOrgLoading(false);
      setNoOrg(false);
      return;
    }

    const uid = user.id || user.uid;

    const findOrgs = async () => {
      try {
        // Query orgMemberships for this user
        const q = query(
          collection(db, 'orgMemberships'),
          where('userId', '==', uid)
        );
        const memSnap = await getDocs(q);

        let orgs = [];
        if (!memSnap.empty) {
          // Fetch the organization documents for these memberships
          const orgIds = memSnap.docs.map(d => d.data().orgId);
          // To avoid firestore "in" limit of 10, chunk if necessary, but assume < 10 orgs for now
          const orgsQ = query(
            collection(db, 'organizations'),
            where('__name__', 'in', orgIds.slice(0, 10))
          );
          const orgSnap = await getDocs(orgsQ);
          orgs = orgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (orgs.length === 0) {
          // Fallback: check legacy org doc if migration hasn't run yet
          const legacyId = process.env.NEXT_PUBLIC_ORG_ID || 'quickteam';
          const legacySnap = await getDoc(doc(db, 'organizations', legacyId));
          if (legacySnap.exists()) {
            const data = legacySnap.data();
            const membership = (data.members || []).find(m => m.uid === uid);
            if (membership) {
              orgs = [{ id: legacySnap.id, ...data }];
            }
          }
        }

        setAllOrgs(orgs);

        if (orgs.length === 0) {
          setNoOrg(true);
          setOrgLoading(false);
          return;
        }

        // Pick active org: prefer localStorage, fallback to first
        const stored = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
        const preferred = stored && orgs.find(o => o.id === stored);
        const chosen = preferred || orgs[0];

        // Retrieve role from orgMemberships if we can, else fallback
        let chosenRole = 'member';
        if (!memSnap.empty) {
           const memData = memSnap.docs.find(d => d.data().orgId === chosen.id)?.data();
           if (memData) chosenRole = memData.role;
        } else {
           const legacyMember = (chosen.members || []).find(m => m.uid === uid);
           if (legacyMember) chosenRole = legacyMember.role;
        }

        // Apply org (bypassing members array logic)
        setActiveOrgId(chosen.id);
        setActiveOrg(chosen);
        setOrgRole(chosenRole || 'member');
        setNoOrg(false);
        setOrgLoading(false);
        if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, chosen.id);
      } catch (err) {
        console.error('[OrgContext] error finding orgs:', err);
        setOrgLoading(false);
      }
    };

    findOrgs();
  }, [user?.id, applyOrg]); // eslint-disable-line

  // ── Org switcher: called from UI ─────────────────────────────────────────
  const switchOrg = useCallback((orgId) => {
    const target = allOrgs.find(o => o.id === orgId);
    if (!target || !user) return;
    const uid = user.id || user.uid;
    // Set loading briefly so project data refreshes cleanly
    setOrgLoading(true);
    applyOrg(target, uid);
  }, [allOrgs, user, applyOrg]);

  // ── Live-sync the active org document and membership ──────────────────
  useEffect(() => {
    if (!activeOrgId) return;
    
    // Once an org is active, we are no longer in "noOrg" state
    setNoOrg(false);
    
    // Sync organization data
    const unsubOrg = onSnapshot(doc(db, 'organizations', activeOrgId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setActiveOrg(data);
        setAllOrgs(prev => prev.map(o => o.id === snap.id ? data : o));
      }
    });

    // Sync role from orgMemberships
    const uid = user?.id || user?.uid;
    let unsubMem = () => {};
    if (uid) {
      unsubMem = onSnapshot(doc(db, 'orgMemberships', `${activeOrgId}_${uid}`), (snap) => {
        if (snap.exists()) {
          setOrgRole(snap.data().role);
        }
      });
    }

    return () => { unsubOrg(); unsubMem(); };
  }, [activeOrgId, user?.id, user?.uid]);

  return (
    <OrgContext.Provider value={{
      allOrgs, activeOrgId, activeOrg, orgRole,
      orgLoading, noOrg,
      setActiveOrgId, switchOrg,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider');
  return ctx;
};
