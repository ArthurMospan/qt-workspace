'use client';

// src/lib/hooks/useProjects.js — Real-time projects for authenticated user
// Filters by organizationId for multi-tenancy.
// Project visibility:
//   - 'internal' → only visible in qt-workspace (team only)
//   - 'shared'   → visible in both qt (client portal) and qt-workspace
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';
export function useProjects(userId, activeOrgId) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  // Start as loading=true so callers don't flash an empty state
  // while auth/org context is still resolving.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Undefined means auth is still resolving; keep the loading state so the
    // projects page does not briefly render an empty state.
    if (userId === undefined) {
      queueMicrotask(() => setLoading(true));
      return;
    }
    // Null means auth resolved without a user.
    if (userId === null) {
      queueMicrotask(() => {
        setProjects([]);
        setError(null);
        setLoading(false);
      });
      return;
    }
    if (!activeOrgId) {
      // userId exists but orgId not yet resolved — keep loading
      return;
    }
    queueMicrotask(() => setLoading(true));
    const q = query(collection(db, 'projects'), where('organizationId', '==', activeOrgId));
    const unsub = onSnapshot(q, {
      includeMetadataChanges: true,
    }, snap => {
      // Do not turn an unresolved empty cache into an empty workspace. A real
      // empty result is only authoritative when it came from the server.
      if (snap.empty && snap.metadata.fromCache) {
        setError(null);
        setLoading(true);
        return;
      }
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' })
      }));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setProjects(docs);
      setError(null);
      setLoading(false);
    }, err => {
      reportLoadError('[useProjects]', err);
      setError(err);
      setLoading(false);
    });
    return () => unsub();
  }, [userId, activeOrgId]);
  return {
    projects,
    loading,
    error
  };
}

// Helper to check if a project should be visible in qt-workspace.
// Everything the team owns is visible here; undefined visibility is treated as
// 'internal', so it still shows in the workspace.
export function isWorkspaceProject(project) {
  return !project.visibility || project.visibility === 'internal' || project.visibility === 'shared';
}

// Helper to check if a project should be visible in the client portal (qt).
// Only an explicit 'shared' visibility exposes a project to the client — an
// undefined/legacy value is treated as 'internal' (never leaked to the portal).
export function isClientProject(project) {
  return project.visibility === 'shared';
}
