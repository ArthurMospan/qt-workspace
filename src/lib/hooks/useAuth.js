'use client';

// src/lib/hooks/useAuth.js — Auth hook (copied & adapted from qt/)
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, setPersistence, browserLocalPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { claimActivityHeartbeat } from '@/lib/utils/activity';

const ACTIVITY_HEARTBEAT_MS = 60_000;

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionUserRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let intervalId;
    let removeVisibilityListener = () => {};
    let unsubscribeProfile = () => {};
    let unsubscribeAuth = () => {};
    let profileSignature = '';

    const handleAuthChange = async firebaseUser => {
      if (intervalId) clearInterval(intervalId);
      removeVisibilityListener();
      removeVisibilityListener = () => {};
      unsubscribeProfile();
      unsubscribeProfile = () => {};

      if (!firebaseUser) {
        const hadServerSession = Boolean(sessionUserRef.current);
        sessionUserRef.current = null;
        if (hadServerSession) fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const fallbackProfile = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Користувач',
        email: firebaseUser.email,
        avatar: firebaseUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
      };

      try {
        const idToken = await firebaseUser.getIdToken();
        try {
          const sessionResponse = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!sessionResponse.ok) throw new Error('Failed to establish server session');
          sessionUserRef.current = firebaseUser.uid;
        } catch (sessionError) {
          // Workspace/API authentication uses the Firebase ID token directly.
          // A transient cookie-sync failure must not sign out a valid user.
          console.warn('[useAuth] Server session synchronization failed:', sessionError);
        }
        if (cancelled) return;

        setUser(fallbackProfile);
        setLoading(false);

        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const snap = await getDoc(userRef);
          if (cancelled) return;
          const storedProfile = snap.exists() ? snap.data() : null;

          const syncLastActive = () => {
            if (!claimActivityHeartbeat(`profile:${firebaseUser.uid}`, ACTIVITY_HEARTBEAT_MS)) return;
            setDoc(userRef, { lastActive: new Date().toISOString() }, { merge: true }).catch(() => {});
          };

          const resolvedName = firebaseUser.displayName || storedProfile?.name || 'Користувач';
          const resolvedAvatar = firebaseUser.photoURL || storedProfile?.avatar || fallbackProfile.avatar;
          let reactiveProfile;
          if (snap.exists()) {
            const profileUpdates = {};
            if (storedProfile.name !== resolvedName) profileUpdates.name = resolvedName;
            if (storedProfile.avatar !== resolvedAvatar) profileUpdates.avatar = resolvedAvatar;
            if (Object.keys(profileUpdates).length > 0) {
              await setDoc(userRef, profileUpdates, { merge: true });
            }
            reactiveProfile = { ...storedProfile, ...profileUpdates };
          } else {
            reactiveProfile = {
              ...fallbackProfile,
              role: 'user',
              createdAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
            };
            await setDoc(userRef, reactiveProfile, { merge: true });
          }

          if (cancelled) return;
          setUser({
            ...fallbackProfile,
            ...(storedProfile || {}),
            id: firebaseUser.uid,
            name: resolvedName,
            email: firebaseUser.email,
            avatar: resolvedAvatar,
          });

          const profileWithoutActivity = { ...reactiveProfile };
          delete profileWithoutActivity.lastActive;
          profileSignature = JSON.stringify(profileWithoutActivity);

          unsubscribeProfile = onSnapshot(userRef, docSnap => {
            if (cancelled || !docSnap.exists()) return;
            const profile = { ...docSnap.data() };
            delete profile.lastActive;
            const nextSignature = JSON.stringify(profile);
            if (nextSignature === profileSignature) return;
            profileSignature = nextSignature;
            setUser(previous => ({ ...previous, ...profile, id: firebaseUser.uid }));
          }, error => {
            // Authentication is still valid when the optional profile document
            // is unavailable; keep the Firebase Auth fallback without raising a
            // Next.js error overlay.
            console.warn('[useAuth] profile subscription unavailable:', error);
          });
          syncLastActive();
          intervalId = setInterval(syncLastActive, ACTIVITY_HEARTBEAT_MS);
          const handleVisibilityChange = () => syncLastActive();
          document.addEventListener('visibilitychange', handleVisibilityChange);
          removeVisibilityListener = () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        } catch (profileError) {
          // A profile permission/read error must not invalidate a valid Firebase session.
          console.warn('[useAuth] profile synchronization unavailable:', profileError);
        }
      } catch (error) {
        console.error('[useAuth] Authentication initialization failed:', error);
        sessionUserRef.current = null;
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
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
      removeVisibilityListener();
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
    sessionUserRef.current = null;
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
