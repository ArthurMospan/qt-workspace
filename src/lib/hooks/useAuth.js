'use client';

// src/lib/hooks/useAuth.js — Auth hook (copied & adapted from qt/)
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, setPersistence, browserLocalPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let intervalId;
    let unsubscribeProfile = () => {};
    let unsubscribeAuth = () => {};

    const handleAuthChange = async firebaseUser => {
      try {
      if (intervalId) clearInterval(intervalId);
      unsubscribeProfile();
      unsubscribeProfile = () => {};
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        const sessionResponse = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!sessionResponse.ok) throw new Error('Failed to establish server session');
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
            lastActive: new Date().toISOString()
          });
        } else {
          await setDoc(userRef, {
            lastActive: new Date().toISOString(),
            name: firebaseUser.displayName || snap.data().name || 'Користувач',
            avatar: firebaseUser.photoURL || snap.data().avatar || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`
          }, {
            merge: true
          });
        }
        const profile = snap.exists() ? {
          ...snap.data(),
          id: firebaseUser.uid,
          name: firebaseUser.displayName || snap.data().name || 'Користувач',
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL || snap.data().avatar || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`
        } : {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Користувач',
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`
        };
        setUser(profile);
        setLoading(false);
        unsubscribeProfile = onSnapshot(userRef, docSnap => {
          if (docSnap.exists()) setUser(prev => ({
            ...prev,
            ...docSnap.data()
          }));
        }, err => {
          console.error("[useAuth.js] onSnapshot error", err);
        });
        intervalId = setInterval(() => {
          setDoc(userRef, {
            lastActive: new Date().toISOString()
          }, {
            merge: true
          }).catch(console.error);
        }, 30000);
      } else {
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        setUser(null);
        setLoading(false);
      }
      } catch (error) {
        console.error('[useAuth] Authentication initialization failed:', error);
        setUser(null);
        setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.error('[useAuth] Failed to configure persistence:', error);
      }
      if (cancelled) return;
      unsubscribeAuth = onAuthStateChanged(auth, handleAuthChange);
    };

    initializeAuth();
    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubscribeProfile();
      if (intervalId) clearInterval(intervalId);
    };
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
      }, {
        merge: true
      }).catch(console.error);
    }
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    return firebaseSignOut(auth);
  };
  const signInWithEmail = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };
  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signOut
  };
}
