'use client';

// src/lib/hooks/useOrganization.js
// Organization = the workspace team. Single org per deployment (ORG_ID).
// Schema: organizations/{ORG_ID} → { name, ownerId, members: [{uid, role, joinedAt}] }
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
export function useOrganization() {
  const {
    activeOrgId
  } = useAppContext();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]); // full user profiles
  const [loading, setLoading] = useState(true);

  // Listen to org doc
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activeOrgId) {
      queueMicrotask(() => setLoading(prev => prev ? false : prev));
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
    const memQ = query(collection(db, 'orgMemberships'), where('orgId', '==', activeOrgId));
    unsubMem = onSnapshot(memQ, async snap => {
      const memberEntries = snap.docs.map(d => d.data());
      const profiles = await Promise.all(memberEntries.map(async m => {
        const uSnap = await getDoc(doc(db, 'users', m.userId));
        return uSnap.exists() ? {
          ...uSnap.data(),
          id: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          hourlyRate: m.hourlyRate || 0,
          positionId: m.positionId || ''
        } : {
          id: m.userId,
          name: m.userId,
          role: m.role,
          hourlyRate: m.hourlyRate || 0,
          positionId: m.positionId || ''
        };
      }));
      setMembers(profiles.filter(Boolean));
      setLoading(false);
    }, () => setLoading(false));
    return () => {
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
    // Check if user with this email already exists
    const usersQ = query(collection(db, 'users'), where('email', '==', email));
    const userSnap = await getDocs(usersQ);
    if (!userSnap.empty) {
      // User exists → add them directly
      const uid = userSnap.docs[0].id;
      const membershipRef = doc(db, 'orgMemberships', `${activeOrgId}_${uid}`);
      const memSnap = await getDoc(membershipRef);
      if (memSnap.exists()) {
        throw new Error('Цей користувач вже в команді');
      }
      await setDoc(membershipRef, {
        id: `${activeOrgId}_${uid}`,
        orgId: activeOrgId,
        userId: uid,
        role,
        joinedAt: new Date().toISOString(),
        hourlyRate: 0
      });
      return {
        type: 'added_directly'
      };
    }

    // User not registered yet → create invitation
    const existingInvite = await getDocs(query(collection(db, 'invitations'), where('email', '==', email), where('organizationId', '==', activeOrgId), where('status', '==', 'pending')));
    if (!existingInvite.empty) {
      throw new Error('Запрошення вже відправлено на цей email');
    }
    await addDoc(collection(db, 'invitations'), {
      email,
      organizationId: activeOrgId,
      invitedBy,
      role,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return {
      type: 'invitation_sent'
    };
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
    const q = query(collection(db, 'invitations'), where('email', '==', email), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    if (snap.empty) return false;

    // Add user to orgs
    for (const d of snap.docs) {
      const inviteData = d.data();
      const orgId = inviteData.organizationId;
      const orgRef = doc(db, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        const membershipRef = doc(db, 'orgMemberships', `${orgId}_${uid}`);
        const memSnap = await getDoc(membershipRef);
        if (!memSnap.exists()) {
          await setDoc(membershipRef, {
            id: `${orgId}_${uid}`,
            orgId: orgId,
            userId: uid,
            role: inviteData.role || 'member',
            joinedAt: new Date().toISOString(),
            hourlyRate: 0
          });
        }
      }

      // Mark invitation as accepted
      await updateDoc(doc(db, 'invitations', d.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });
    }
    return true;
  } catch (err) {
    console.error('[acceptPendingInvitation]', err);
    return false;
  }
}