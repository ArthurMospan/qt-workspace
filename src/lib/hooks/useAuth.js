'use client';
// src/lib/hooks/useAuth.js — Auth hook (copied & adapted from qt/)
import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    let intervalId;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (intervalId) clearInterval(intervalId);

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          await setDoc(userRef, {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Користувач',
            email: firebaseUser.email,
            avatar: firebaseUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
            role: 'user',
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
          });
        } else {
          await setDoc(userRef, { 
            lastActive: new Date().toISOString(),
            name: firebaseUser.displayName || snap.data().name || 'Користувач',
            avatar: firebaseUser.photoURL || snap.data().avatar || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
          }, { merge: true });
        }

        const profile = snap.exists()
          ? {
              ...snap.data(),
              id: firebaseUser.uid,
              name: firebaseUser.displayName || snap.data().name || 'Користувач',
              email: firebaseUser.email,
              avatar: firebaseUser.photoURL || snap.data().avatar || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
            }
          : {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Користувач',
              email: firebaseUser.email,
              avatar: firebaseUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
            };

        setUser(profile);
        setLoading(false);

        const unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUser(prev => ({ ...prev, ...docSnap.data() }));
        });

        intervalId = setInterval(() => {
          setDoc(userRef, { lastActive: new Date().toISOString() }, { merge: true }).catch(console.error);
        }, 30000);

        return () => { unsubProfile(); clearInterval(intervalId); };
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => { unsubscribe(); if (intervalId) clearInterval(intervalId); };
  }, []);

  const signInWithGoogle = async () => {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
        const e = new Error('POPUP_BLOCKED');
        e.code = 'custom/popup-blocked';
        throw e;
      }
      throw error;
    }
  };

  const signOut = async () => {
    if (user?.id) {
      await setDoc(doc(db, 'users', user.id), {
        lastActive: new Date(Date.now() - 300000).toISOString()
      }, { merge: true }).catch(console.error);
    }
    return firebaseSignOut(auth);
  };

  return { user, loading, signInWithGoogle, signOut };
}
