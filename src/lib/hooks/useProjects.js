'use client';

// src/lib/hooks/useProjects.js — Real-time projects for authenticated user
// Filters by organizationId for multi-tenancy.
// Project visibility:
//   - 'internal' → only visible in qt-workspace (team only)
//   - 'shared'   → visible in both qt (client portal) and qt-workspace
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
export function useProjects(userId, activeOrgId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId || !activeOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      queueMicrotask(() => setProjects(prev => prev.length > 0 ? [] : prev));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      queueMicrotask(() => setLoading(prev => prev ? false : prev));
      return;
    }
    const q = query(collection(db, 'projects'), where('organizationId', '==', activeOrgId));
    const unsub = onSnapshot(q, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setProjects(docs);
      setLoading(false);
    }, err => {
      console.error('[useProjects]', err);
      setLoading(false);
    });
    return () => unsub();
  }, [userId, activeOrgId]);
  return {
    projects,
    loading
  };
}

// Helper to check if a project should be visible in qt-workspace
// 'internal' and 'shared' are both visible; undefined defaults to 'shared' (backward compat)
export function isWorkspaceProject(project) {
  return !project.visibility || project.visibility === 'internal' || project.visibility === 'shared';
}

// Helper to check if a project should be visible in the client portal (qt)
export function isClientProject(project) {
  return !project.visibility || project.visibility === 'shared';
}