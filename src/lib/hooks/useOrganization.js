'use client';
// src/lib/hooks/useOrganization.js
// Organization = the workspace team. Single org per deployment (ORG_ID).
// Schema: organizations/{ORG_ID} → { name, ownerId, members: [{uid, role, joinedAt}] }
import { useState, useEffect, useCallback } from 'react';
import {
  doc, onSnapshot, updateDoc, arrayUnion, arrayRemove,
  setDoc, getDoc, collection, addDoc, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

export function useOrganization() {
  const [org,     setOrg]     = useState(null);
  const [members, setMembers] = useState([]);   // full user profiles
  const [loading, setLoading] = useState(true);

  // Listen to org doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'organizations', ORG_ID), async (snap) => {
      if (!snap.exists()) {
        setOrg(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      const data = { id: snap.id, ...snap.data() };
      setOrg(data);

      // Load full profiles for all members
      const memberEntries = data.members || [];
      const profiles = await Promise.all(
        memberEntries.map(async (m) => {
          const uSnap = await getDoc(doc(db, 'users', m.uid));
          return uSnap.exists()
            ? { ...uSnap.data(), id: m.uid, role: m.role, joinedAt: m.joinedAt }
            : { id: m.uid, name: m.uid, role: m.role };
        })
      );
      setMembers(profiles.filter(Boolean));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, []);

  // Ensure org exists (called by owner on first load)
  const initOrg = useCallback(async (ownerId, ownerName) => {
    const ref = doc(db, 'organizations', ORG_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: ORG_ID,
        name: 'QuickTeam',
        ownerId,
        members: [{ uid: ownerId, role: 'owner', joinedAt: new Date().toISOString() }],
        createdAt: serverTimestamp(),
      });
    } else {
      // Ensure owner is in members list
      const existing = snap.data().members || [];
      if (!existing.find(m => m.uid === ownerId)) {
        await updateDoc(ref, {
          members: arrayUnion({ uid: ownerId, role: 'owner', joinedAt: new Date().toISOString() }),
        });
      }
    }
  }, []);

  // Invite by email
  const inviteMember = useCallback(async (email, invitedBy, role = 'member') => {
    // Check if user with this email already exists
    const usersQ = query(collection(db, 'users'), where('email', '==', email));
    const userSnap = await getDocs(usersQ);

    if (!userSnap.empty) {
      // User exists → add them directly
      const uid = userSnap.docs[0].id;
      const orgRef = doc(db, 'organizations', ORG_ID);
      const orgSnap = await getDoc(orgRef);
      const existing = orgSnap.data()?.members || [];
      if (existing.find(m => m.uid === uid)) {
        throw new Error('Цей користувач вже в команді');
      }
      await updateDoc(orgRef, {
        members: arrayUnion({ uid, role, joinedAt: new Date().toISOString() }),
      });
      return { type: 'added_directly' };
    }

    // User not registered yet → create invitation
    const existingInvite = await getDocs(
      query(collection(db, 'invitations'),
        where('email', '==', email),
        where('organizationId', '==', ORG_ID),
        where('status', '==', 'pending'),
      )
    );
    if (!existingInvite.empty) {
      throw new Error('Запрошення вже відправлено на цей email');
    }

    await addDoc(collection(db, 'invitations'), {
      email,
      organizationId: ORG_ID,
      invitedBy,
      role,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return { type: 'invitation_sent' };
  }, []);

  // Change role
  const changeMemberRole = useCallback(async (uid, newRole) => {
    const orgRef  = doc(db, 'organizations', ORG_ID);
    const orgSnap = await getDoc(orgRef);
    const members = (orgSnap.data()?.members || []).map(m =>
      m.uid === uid ? { ...m, role: newRole } : m
    );
    await updateDoc(orgRef, { members });
  }, []);

  // Remove member
  const removeMember = useCallback(async (uid) => {
    const orgRef  = doc(db, 'organizations', ORG_ID);
    const orgSnap = await getDoc(orgRef);
    const members = (orgSnap.data()?.members || []).filter(m => m.uid !== uid);
    await updateDoc(orgRef, { members });
  }, []);

  return { org, members, loading, initOrg, inviteMember, changeMemberRole, removeMember };
}

// Called when a user signs in — checks if they have a pending invitation
export async function acceptPendingInvitation(uid, email) {
  try {
    const q = query(
      collection(db, 'invitations'),
      where('email', '==', email),
      where('organizationId', '==', ORG_ID),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return false;

    // Add user to org
    const orgRef = doc(db, 'organizations', ORG_ID);
    const orgSnap = await getDoc(orgRef);
    const existing = orgSnap.data()?.members || [];
    if (!existing.find(m => m.uid === uid)) {
      await updateDoc(orgRef, {
        members: arrayUnion({ uid, role: snap.docs[0].data().role || 'member', joinedAt: new Date().toISOString() }),
      });
    }

    // Mark invitations as accepted
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'invitations', d.id), { status: 'accepted', acceptedAt: serverTimestamp() });
    }
    return true;
  } catch (err) {
    console.error('[acceptPendingInvitation]', err);
    return false;
  }
}
