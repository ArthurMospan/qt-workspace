'use client';

// src/lib/hooks/useOrganization.js
// Organization = one workspace in the multi-organization membership model.
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, deleteDoc, setDoc, getDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { fetchOrganizationMembers } from '@/lib/services/members';
export function useOrganization() {
  const {
    activeOrgId
  } = useAppContext();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]); // full user profiles
  const [loading, setLoading] = useState(true);

  // Listen to org doc
  useEffect(() => {
    if (!activeOrgId) {
      queueMicrotask(() => {
        setOrg(null);
        setMembers([]);
        setLoading(false);
      });
      return;
    }
    let unsubOrg = () => {};
    let unsubMem = () => {};
    unsubOrg = onSnapshot(doc(db, 'organizations', activeOrgId), async snap => {
      if (!snap.exists()) {
        setOrg(null);
        setMembers([]);
        setLoading(false);
        return;
      }
      setOrg({
        id: snap.id,
        ...snap.data()
      });
    }, err => {
      console.error("[useOrganization.js] onSnapshot error", err);
    });
    let active = true;
    const memQ = query(collection(db, 'orgMemberships'), where('orgId', '==', activeOrgId));
    unsubMem = onSnapshot(memQ, async snap => {
      try {
        if (snap.empty) {
          if (active) setMembers([]);
        } else {
          const profiles = await fetchOrganizationMembers(activeOrgId, { force: true });
          if (active) setMembers(profiles);
        }
      } catch (error) {
        console.error('[useOrganization] member profiles:', error);
        if (active) setMembers([]);
      } finally {
        if (active) setLoading(false);
      }
    }, () => setLoading(false));
    return () => {
      active = false;
      unsubOrg();
      unsubMem();
    };
  }, [activeOrgId]);

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
  const inviteMember = useCallback(async (email, invitedBy, role = 'member') => {
    if (!activeOrgId || !auth.currentUser) throw new Error('Authentication required');
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, organizationId: activeOrgId, role, invitedBy }),
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
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Invitation acceptance failed (${response.status})`);
    const result = await response.json();
    return result.accepted > 0;
  } catch (err) {
    console.error('[acceptPendingInvitation]', err);
    return false;
  }
}
