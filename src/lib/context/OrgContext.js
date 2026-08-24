'use client';
// src/lib/context/OrgContext.js
// Multi-org context: loads ALL organizations the current user belongs to,
// keeps the active org choice inside this tab, and provides switchOrg().
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs,
  doc, getDoc, onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';
import {
  organizationLoadErrorKind,
  organizationLoadRetryDelay,
  shouldRetryOrganizationLoad,
} from '@/lib/utils/organizationLoadErrors.mjs';

const TAB_STORAGE_KEY = 'qt_active_org_id';
const ORG_LOAD_RETRY_LIMIT = 3;
const OrgContext = createContext(null);

function persistTabOrganization(orgId) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TAB_STORAGE_KEY, orgId);
  // Stop legacy versions in another tab from reviving the shared selection.
  localStorage.removeItem(TAB_STORAGE_KEY);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const scoped = withNotificationOrganization(current, orgId);
  if (scoped && scoped !== current) window.history.replaceState(null, '', scoped);
}

export function OrgProvider({ user, children }) {
  const [allOrgs,     setAllOrgs]     = useState([]);    // all orgs user belongs to
  // The role this user holds in each of them, keyed by organization id.
  //
  // `orgRole` answers only for the active organization, so the switcher — which
  // draws every organization at once — had nowhere to ask and read the legacy
  // `members` array denormalized onto the organization document instead. That
  // array stopped being maintained: OneB has three members in `orgMemberships`
  // and one entry there, so the lookup missed and fell through to «member»,
  // and the owner of a workspace was shown as a plain participant in it.
  // Access is `orgMemberships` and nothing else (AGENTS.md); so is the label.
  const [orgRoles,    setOrgRoles]    = useState({});
  const [activeOrgId, setActiveOrgId] = useState(null);
  const [activeOrg,   setActiveOrg]   = useState(null);
  const [orgRole,     setOrgRole]     = useState(null);  // role inside the active org
  const [orgLoading,  setOrgLoading]  = useState(true);
  const [orgError,    setOrgError]    = useState(null);
  const [noOrg,       setNoOrg]       = useState(false); // true → show onboarding prompt

  // ── Apply an org as active (Internal helper) ─────────────────────────
  const applyOrg = useCallback(async (orgData, uid) => {
    // Persisted BEFORE the await below. The membership listener re-derives the
    // active org from this tab's storage on every snapshot, so writing it late let a
    // snapshot arriving mid-await revert the switch the user just made.
    persistTabOrganization(orgData.id);
    setActiveOrgId(orgData.id);
    setActiveOrg(orgData);

    try {
      const memSnap = await getDoc(doc(db, 'orgMemberships', `${orgData.id}_${uid}`));
      if (memSnap.exists()) {
        setOrgRole(memSnap.data().role);
      } else {
        setOrgRole(null);
      }
    } catch {
      setOrgRole(null);
    }
    
    setNoOrg(false);
    setOrgError(null);
    setOrgLoading(false);
  }, []);

  // ── Load all orgs when user changes ─────────────────────────────────────
  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setAllOrgs([]);
        setOrgRoles({});
        setActiveOrgId(null);
        setActiveOrg(null);
        setOrgRole(null);
        setOrgLoading(false);
        setNoOrg(false);
        setOrgError(null);
      });
      return;
    }

    const uid = user.id || user.uid;

    let cancelled = false;
    let retryAttempt = 0;
    let retryTimer = null;
    let unsubscribe = () => {};
    // Which membership snapshot this is. The handler below is `async`: it
    // receives a snapshot and then goes back to Firestore for the organization
    // documents, so two snapshots can be in flight at once and finish in either
    // order.
    //
    // They arrive in pairs. Firestore's persistent cache — on in production —
    // answers the listener from IndexedDB first and from the server a moment
    // later, and the two do not have to agree: a browser whose cache never held
    // one of the memberships emits that shorter list first. Whichever fetch
    // returned last used to win, so if the cached one lost the race by a
    // millisecond, the workspace it did not know about disappeared from the
    // switcher — and stayed gone, because nothing re-runs until a membership
    // changes. Reloading was a coin toss; another browser, or another account
    // with a cold cache, looked perfectly fine.
    //
    // A snapshot may only publish if nothing newer has arrived since it started.
    let snapshotSequence = 0;
    const membershipsQuery = query(
      collection(db, 'orgMemberships'),
      where('userId', '==', uid)
    );

    const applyMembershipSnapshot = async (memSnap) => {
      snapshotSequence += 1;
      const sequence = snapshotSequence;
      // True while this snapshot is still the newest one to have arrived.
      const current = () => !cancelled && sequence === snapshotSequence;
      try {
        let orgs = [];
        if (!memSnap.empty) {
          // Fetch the organization documents for these memberships
          const orgIds = [...new Set(memSnap.docs.map(d => d.data().orgId).filter(Boolean))];
          const chunks = [];
          for (let i = 0; i < orgIds.length; i += 30) chunks.push(orgIds.slice(i, i + 30));
          const snapshots = await Promise.all(chunks.map(ids => getDocs(query(
            collection(db, 'organizations'),
            where('__name__', 'in', ids)
          ))));
          orgs = snapshots.flatMap(orgSnap => orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // Legacy fallback removed to enforce strict multi-tenancy

        if (!current()) return;
        setOrgError(null);
        setAllOrgs(orgs);
        setOrgRoles(Object.fromEntries(
          memSnap.docs
            .map(document => document.data())
            .filter(membership => membership.orgId && membership.role)
            .map(membership => [membership.orgId, membership.role]),
        ));

        if (orgs.length === 0) {
          setOrgRoles({});
          setNoOrg(true);
          setActiveOrgId(null);
          setActiveOrg(null);
          setOrgRole(null);
          setOrgLoading(false);
          return;
        }

        // Pick active org: prefer this tab's choice, fallback to first.
        const stored = typeof window !== 'undefined' ? sessionStorage.getItem(TAB_STORAGE_KEY) : null;
        const preferred = stored && orgs.find(o => o.id === stored);
        const chosen = preferred || orgs[0];

        // Retrieve role from orgMemberships if we can, else fallback
        let chosenRole = null;
        if (!memSnap.empty) {
           const memData = memSnap.docs.find(d => d.data().orgId === chosen.id)?.data();
           if (memData) chosenRole = memData.role;
        }

        // Apply org (bypassing members array logic)
        setActiveOrgId(chosen.id);
        setActiveOrg(chosen);
        setOrgRole(chosenRole);
        setNoOrg(false);
        setOrgLoading(false);
        persistTabOrganization(chosen.id);
        retryAttempt = 0;
      } catch (err) {
        handleLoadError('[OrgContext] organizations', err);
      }
    };

    const handleLoadError = (scope, err) => {
      reportLoadError(scope, err);
      unsubscribe();
      unsubscribe = () => {};
      if (retryTimer) window.clearTimeout(retryTimer);
      if (!cancelled && shouldRetryOrganizationLoad(err) && retryAttempt < ORG_LOAD_RETRY_LIMIT) {
        retryAttempt += 1;
        setOrgError(null);
        setOrgLoading(true);
        // Repeating a rejected read with the credential that was rejected only
        // gets it rejected again. A denial straight after a sign-in is a token
        // that belongs to the previous session, so the retry is handed a fresh
        // one before it goes back out.
        if (organizationLoadErrorKind(err) === 'permission-denied') {
          auth.currentUser?.getIdToken(true).catch(() => {});
        }
        retryTimer = window.setTimeout(subscribe, organizationLoadRetryDelay(retryAttempt));
        return;
      }
      setOrgError(err);
      setOrgLoading(false);
    };

    const subscribe = () => {
      if (cancelled) return;
      unsubscribe();
      unsubscribe = onSnapshot(
        membershipsQuery,
        applyMembershipSnapshot,
        err => handleLoadError('[OrgContext] memberships', err),
      );
    };

    subscribe();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      unsubscribe();
    };
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
    
    // Sync organization data
    const unsubOrg = onSnapshot(doc(db, 'organizations', activeOrgId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setActiveOrg(data);
        setAllOrgs(prev => {
          const exists = prev.find(o => o.id === snap.id);
          if (exists) {
            return prev.map(o => o.id === snap.id ? data : o);
          }
          return [...prev, data];
        });
      }
    }, (err) => {
      console.warn('[OrgContext] org sync permission error (expected during logout):', err.message);
    });

    // Sync role from orgMemberships
    const uid = user?.id || user?.uid;
    let unsubMem = () => {};
    if (uid) {
      unsubMem = onSnapshot(doc(db, 'orgMemberships', `${activeOrgId}_${uid}`), (snap) => {
        setOrgRole(snap.exists() ? snap.data().role : null);
      }, (err) => {
        console.warn('[OrgContext] membership sync permission error (expected during logout):', err.message);
      });
    }

    return () => { unsubOrg(); unsubMem(); };
  }, [activeOrgId, user?.id, user?.uid]);

  return (
    <OrgContext.Provider value={{
      allOrgs, orgRoles, activeOrgId, activeOrg, orgRole,
      orgLoading, orgError, noOrg,
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
