'use client';

// src/lib/hooks/useOrganization.js
// Organization = one workspace in the multi-organization membership model.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { doc, onSnapshot, updateDoc, deleteDoc, setDoc, getDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { fetchOrganizationMembers } from '@/lib/services/members';
import { reportLoadError } from '@/lib/utils/errors';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';

const ORGANIZATION_SERVER_SNAPSHOT = Object.freeze({
  org: null,
  members: [],
  loading: true,
  error: null,
});

const EMPTY_ORGANIZATION_SNAPSHOT = Object.freeze({
  ...ORGANIZATION_SERVER_SNAPSHOT,
  loading: false,
});

const organizationStores = new Map();

function createOrganizationStore(organizationId) {
  let snapshot = ORGANIZATION_SERVER_SNAPSHOT;
  let unsubscribeOrg = null;
  let unsubscribeMembers = null;
  let stopTimer = null;
  let requestVersion = 0;
  const listeners = new Set();

  const emit = next => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };

  const start = () => {
    if (unsubscribeOrg || unsubscribeMembers) return;

    unsubscribeOrg = onSnapshot(doc(db, 'organizations', organizationId), orgSnap => {
      if (!orgSnap.exists()) {
        emit({ org: null, members: [], loading: false, error: null });
        return;
      }
      emit({ ...snapshot, org: { id: orgSnap.id, ...orgSnap.data() }, error: null });
    }, error => {
      reportLoadError('[useOrganization] organization', error);
      emit({ ...snapshot, loading: false, error });
    });

    const membershipsQuery = query(collection(db, 'orgMemberships'), where('orgId', '==', organizationId));
    unsubscribeMembers = onSnapshot(membershipsQuery, async membershipsSnap => {
      const version = ++requestVersion;
      if (membershipsSnap.empty) {
        emit({ ...snapshot, members: [], loading: false, error: null });
        return;
      }

      try {
        const members = await fetchOrganizationMembers(organizationId, { force: true });
        if (version === requestVersion) {
          emit({ ...snapshot, members, loading: false, error: null });
        }
      } catch (error) {
        if (version !== requestVersion) return;
        reportLoadError('[useOrganization] member profiles', error);
        emit({ ...snapshot, members: [], loading: false, error });
      }
    }, error => {
      reportLoadError('[useOrganization] memberships', error);
      emit({ ...snapshot, loading: false, error });
    });
  };

  const subscribe = listener => {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    listeners.add(listener);
    start();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stopTimer = setTimeout(() => {
          requestVersion += 1;
          unsubscribeOrg?.();
          unsubscribeMembers?.();
          unsubscribeOrg = null;
          unsubscribeMembers = null;
          stopTimer = null;
        }, 1000);
      }
    };
  };

  return {
    subscribe,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => ORGANIZATION_SERVER_SNAPSHOT,
  };
}

const emptyOrganizationStore = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY_ORGANIZATION_SNAPSHOT,
  getServerSnapshot: () => EMPTY_ORGANIZATION_SNAPSHOT,
};

function getOrganizationStore(organizationId) {
  if (!organizationId) return emptyOrganizationStore;
  if (!organizationStores.has(organizationId)) {
    organizationStores.set(organizationId, createOrganizationStore(organizationId));
  }
  return organizationStores.get(organizationId);
}

export function useOrganization() {
  const { activeOrgId } = useAppContext();
  const store = useMemo(() => getOrganizationStore(activeOrgId), [activeOrgId]);
  const { org, members, loading, error } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // Ensure org exists (called by owner on first load)
  const initOrg = useCallback(async (ownerId, ownerName) => {
    if (!activeOrgId) return;
    const ref = doc(db, 'organizations', activeOrgId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: activeOrgId,
        name: 'QuickTeam',
        ownerId,
        createdAt: serverTimestamp()
      });
    }

    // Ensure owner is in orgMemberships
    const membershipRef = doc(db, 'orgMemberships', `${activeOrgId}_${ownerId}`);
    const memSnap = await getDoc(membershipRef);
    if (!memSnap.exists()) {
      await setDoc(membershipRef, {
        id: `${activeOrgId}_${ownerId}`,
        orgId: activeOrgId,
        userId: ownerId,
        role: 'owner',
        joinedAt: new Date().toISOString(),
        hourlyRate: 0
      });
    }
  }, [activeOrgId]);

  // Invite by email
  // `projectIds` scopes the invitation to projects the invitee joins the moment
  // they accept, so inviting from the project form does not need a second trip
  // through project settings once the person shows up in the organization.
  const inviteMember = useCallback(async (email, invitedBy, role = 'member', projectIds = []) => {
    if (!activeOrgId || !auth.currentUser) throw new Error('Authentication required');
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, organizationId: activeOrgId, role, invitedBy, projectIds }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не вдалося запросити користувача');
    return result;
  }, [activeOrgId]);

  // Change role
  const changeMemberRole = useCallback(async (uid, newRole) => {
    if (!activeOrgId) return;
    const membershipRef = doc(db, 'orgMemberships', `${activeOrgId}_${uid}`);
    await updateDoc(membershipRef, {
      role: newRole
    });
  }, [activeOrgId]);

  // Change hourly rate
  const setMemberRate = useCallback(async (uid, rate) => {
    if (!activeOrgId) return;
    const membershipRef = doc(db, 'orgMemberships', `${activeOrgId}_${uid}`);
    await updateDoc(membershipRef, {
      hourlyRate: Number(rate)
    });
  }, [activeOrgId]);

  // Change position
  const setMemberPosition = useCallback(async (uid, positionId) => {
    if (!activeOrgId) return;
    const membershipRef = doc(db, 'orgMemberships', `${activeOrgId}_${uid}`);
    await updateDoc(membershipRef, {
      positionId: positionId || ''
    });
  }, [activeOrgId]);

  // Remove member
  const removeMember = useCallback(async uid => {
    if (!activeOrgId) return;
    const membershipRef = doc(db, 'orgMemberships', `${activeOrgId}_${uid}`);
    await deleteDoc(membershipRef);
  }, [activeOrgId]);
  return {
    org,
    members,
    loading,
    error,
    initOrg,
    inviteMember,
    changeMemberRole,
    setMemberRate,
    setMemberPosition,
    removeMember
  };
}

// Called when a user signs in — checks if they have a pending invitation
// across all organizations in the multi-org environment.
export async function acceptPendingInvitation(uid, email) {
  try {
    if (!uid || !email || !auth.currentUser) return false;
    const result = await authenticatedRequest('/api/invitations/accept', {
      method: 'POST',
    }, 'Не вдалося прийняти запрошення');
    return result.accepted > 0;
  } catch (err) {
    // This is a best-effort check after sign-in. A missing/expired session is
    // already handled by the auth flow and must not surface as a console error.
    if (err?.status !== 401) reportLoadError('[acceptPendingInvitation]', err);
    return false;
  }
}
