'use client';

// src/lib/hooks/useTeamMembers.js — Fetch user profiles for a list of UIDs
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
export function useTeamMembers(teamUids) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = teamUids?.join(',') ?? '';
  useEffect(() => {
    if (!teamUids || teamUids.length === 0) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    setLoading(true);
    Promise.all(teamUids.map(uid => getDoc(doc(db, 'users', uid)).then(snap => snap.exists() ? {
      id: snap.id,
      ...snap.data()
    } : null))).then(results => setMembers(results.filter(Boolean))).catch(console.error).finally(() => setLoading(false));
  }, [key]);
  return {
    members,
    loading
  };
}