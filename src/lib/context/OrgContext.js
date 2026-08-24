'use client';
// src/lib/context/OrgContext.js
// Multi-org context: loads ALL organizations the current user belongs to,
// keeps the active org choice inside this tab, and provides switchOrg().
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs, getDocsFromServer,
  doc, onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';
import { reportLoadError } from '@/lib/utils/errors';
import {
  buildOrganizationList,
  createMembershipSnapshotGate,
  organizationMembershipSignature,
  parseOrganizationDirectory,
} from '@/lib/utils/organizationList.mjs';
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
  const applyOrg = useCallback((orgData, role) => {
    // The list listener already read the membership and published its role.
    // Reading the same document again here used the cache-preferred `getDoc`,
    // which could turn a role we had just verified into null in the one browser
    // whose cache did not contain that membership.
    persistTabOrganization(orgData.id);
    setActiveOrgId(orgData.id);
    setActiveOrg(orgData);
    setOrgRole(role ?? null);
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
    // The browser listener is a provisional, cache-backed view. The Admin SDK
    // directory is the verified view. Both reads are asynchronous, so their
    // publication order must preserve that source hierarchy rather than merely
    // trusting whichever callback happened to finish last.
    //
    // Firestore often emits the listener first from IndexedDB and then after a
    // remote sync. Those snapshots do not have to agree, and the remote-marked
    // one still shares the browser SDK's persistent target state. Neither is
    // allowed to overrule the independent directory response.
    //
    // A browser snapshot may publish as a fast provisional answer, but it can
    // never supersede the verified directory. Sequence alone is not enough: an
    // old callback can start after verification and would otherwise become
    // "newer" merely by arriving later.
    const membershipSnapshotGate = createMembershipSnapshotGate();
    let hasVerifiedDirectory = false;
    let directoryRequest = 0;
    let directoryRetryAttempt = 0;
    let directoryRetryTimer = null;
    let directoryAbortController = null;
    let lastLiveMembershipSignature = null;
    // The list this listener last put on screen. A workspace whose organization
    // document a read failed to return keeps the name it already had instead of
    // going blank while the document is fetched again.
    let publishedOrgs = [];
    const membershipsQuery = query(
      collection(db, 'orgMemberships'),
      where('userId', '==', uid)
    );

    const readOrganizationsById = async (orgIds, fromServer) => {
      const chunks = [];
      for (let i = 0; i < orgIds.length; i += 30) chunks.push(orgIds.slice(i, i + 30));
      const snapshots = await Promise.all(chunks.map(ids => {
        const request = query(collection(db, 'organizations'), where('__name__', 'in', ids));
        return fromServer ? getDocsFromServer(request) : getDocs(request);
      }));
      return snapshots.flatMap(orgSnap => orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    // `getDocs` answers from the local cache whenever the SDK believes it is
    // offline, and a cache that never held one of these documents answers short
    // rather than failing — there is no error to catch and nothing to retry. A
    // membership is proof the workspace is there, so a smaller answer than the
    // memberships describe is asked again, of the server this time. If that is
    // unreachable the entry survives anyway, marked pending by the builder.
    const readOrganizationDocuments = async (orgIds) => {
      let documents = [];
      try {
        documents = await readOrganizationsById(orgIds, false);
      } catch {
        // The membership still proves the entry. The server-specific read below
        // gets one more chance to decorate it; failing that, it remains pending.
      }
      const found = new Set(documents.map(document => document.id));
      const missing = orgIds.filter(orgId => !found.has(orgId));
      if (missing.length === 0) return documents;
      try {
        return documents.concat(await readOrganizationsById(missing, true));
      } catch {
        return documents;
      }
    };

    const applyMembershipDocuments = async (
      memberships,
      authoritative,
      suppliedOrganizationDocuments = null,
    ) => {
      // Once a server answer has started, no cache-only answer may shorten it,
      // even if the cache callback itself happens to arrive later.
      const snapshotTicket = membershipSnapshotGate.begin(authoritative);
      if (!snapshotTicket) return;
      const current = () => !cancelled && snapshotTicket.isCurrent();
      try {
        const orgIds = [...new Set(memberships.map(membership => membership.orgId).filter(Boolean))];
        const documents = suppliedOrganizationDocuments
          ?? (orgIds.length > 0 ? await readOrganizationDocuments(orgIds) : []);

        const { organizations, roles } = buildOrganizationList(memberships, documents, publishedOrgs);

        if (!current()) return;
        if (authoritative) hasVerifiedDirectory = true;
        publishedOrgs = organizations;
        setOrgError(null);
        setAllOrgs(organizations);
        setOrgRoles(roles);

        // Nobody has a workspace only when nobody has a membership. It used to
        // be the organization documents that decided this, so a read that came
        // back empty sent a person who owns two workspaces to «створіть
        // організацію».
        if (organizations.length === 0) {
          // An empty cache proves only that this browser has never cached a
          // membership. Redirecting from that answer creates a fake "new
          // organization" flow for an existing owner. Only the server may say
          // that the account genuinely has no workspace.
          if (!authoritative) {
            setNoOrg(false);
            setOrgLoading(true);
            return;
          }
          setNoOrg(true);
          setActiveOrgId(null);
          setActiveOrg(null);
          setOrgRole(null);
          setOrgLoading(false);
          return;
        }

        // Pick active org: prefer this tab's choice, fallback to first.
        const stored = typeof window !== 'undefined' ? sessionStorage.getItem(TAB_STORAGE_KEY) : null;
        const preferred = stored && organizations.find(o => o.id === stored);
        const chosen = preferred || organizations[0];

        // Apply org (bypassing members array logic)
        setActiveOrgId(chosen.id);
        setActiveOrg(chosen);
        setOrgRole(roles[chosen.id] ?? null);
        setNoOrg(false);
        setOrgLoading(false);
        // A partial cache must not replace a stored choice it did not know
        // about. The forced server read can then restore that exact workspace,
        // rather than merely put it back somewhere in the switcher.
        if (authoritative || preferred || !stored) persistTabOrganization(chosen.id);
        retryAttempt = 0;
      } catch (err) {
        handleLoadError('[OrgContext] organizations', err);
      }
    };

    const applyMembershipSnapshot = memSnap => {
      const memberships = memSnap.docs.map(document => document.data());

      // Even a snapshot marked `fromCache: false` still travels through the
      // browser SDK, its persistent target state and its existing listener. It
      // can complete without an error while that local target is incomplete, so
      // it is a useful fast/live hint but never the authority that may shorten
      // the directory.
      //
      // A changed live snapshot asks the independent Admin SDK route to verify
      // the directory. The snapshot itself remains provisional; after the
      // first verified directory the gate refuses every browser-only result.
      if (!memSnap.metadata?.fromCache) {
        const signature = organizationMembershipSignature(memberships);
        if (signature !== lastLiveMembershipSignature) {
          lastLiveMembershipSignature = signature;
          if (hasVerifiedDirectory) {
            directoryRetryAttempt = 0;
            refreshOrganizationDirectory();
          }
        }
      }

      return applyMembershipDocuments(memberships, false);
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

    const refreshOrganizationDirectory = async () => {
      const request = ++directoryRequest;
      if (directoryRetryTimer) {
        window.clearTimeout(directoryRetryTimer);
        directoryRetryTimer = null;
      }
      directoryAbortController?.abort();
      const controller = new AbortController();
      directoryAbortController = controller;
      try {
        // The Admin SDK route is deliberately the primary read, not a fallback
        // after `getDocsFromServer`. The browser SDK can return a successful but
        // short query from a poisoned persistent target; waiting for it to throw
        // meant this recovery route was never called in exactly the browser it
        // existed to repair.
        const directory = await authenticatedRequest(
          '/api/organizations',
          { cache: 'no-store', signal: controller.signal },
          'Не вдалося перевірити список організацій',
        );
        if (cancelled || request !== directoryRequest) return;
        const verified = parseOrganizationDirectory(directory);
        directoryRetryAttempt = 0;
        await applyMembershipDocuments(
          verified.memberships,
          true,
          verified.organizations,
        );
      } catch (err) {
        if (cancelled || request !== directoryRequest) return;
        reportLoadError('[OrgContext] memberships server refresh', err);
        if (
          (
            shouldRetryOrganizationLoad(err)
            || Number(err?.status) >= 500
          )
          && directoryRetryAttempt < ORG_LOAD_RETRY_LIMIT
        ) {
          directoryRetryAttempt += 1;
          directoryRetryTimer = window.setTimeout(
            refreshOrganizationDirectory,
            organizationLoadRetryDelay(directoryRetryAttempt),
          );
          return;
        }
        // A cache-only empty list is not permission to create a replacement
        // organization. If the server cannot verify it after retries, show the
        // recoverable load error instead of silently claiming there is no org.
        if (!hasVerifiedDirectory && publishedOrgs.length === 0) {
          setOrgError(err);
          setOrgLoading(false);
        }
      }
    };

    const subscribe = () => {
      if (cancelled) return;
      unsubscribe();
      unsubscribe = onSnapshot(
        membershipsQuery,
        { includeMetadataChanges: true },
        applyMembershipSnapshot,
        err => handleLoadError('[OrgContext] memberships', err),
      );
    };

    subscribe();
    refreshOrganizationDirectory();
    const refreshOnFocus = () => {
      directoryRetryAttempt = 0;
      refreshOrganizationDirectory();
    };
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('online', refreshOnFocus);
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (directoryRetryTimer) window.clearTimeout(directoryRetryTimer);
      directoryAbortController?.abort();
      directoryRequest += 1;
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('online', refreshOnFocus);
      unsubscribe();
    };
  }, [user?.id, applyOrg]); // eslint-disable-line

  // ── Org switcher: called from UI ─────────────────────────────────────────
  const switchOrg = useCallback((orgId) => {
    const target = allOrgs.find(o => o.id === orgId);
    if (!target || !user) return;
    // Set loading briefly so project data refreshes cleanly
    setOrgLoading(true);
    applyOrg(target, orgRoles[orgId]);
  }, [allOrgs, orgRoles, user, applyOrg]);

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
        if (snap.exists()) setOrgRole(snap.data().role);
        else if (!snap.metadata.fromCache) setOrgRole(null);
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
