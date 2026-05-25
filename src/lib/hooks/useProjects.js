'use client';
// src/lib/hooks/useProjects.js — Real-time projects for authenticated user
// Filters by organizationId for multi-tenancy.
// Project visibility:
//   - 'internal' → only visible in qt-workspace (team only)
//   - 'shared'   → visible in both qt (client portal) and qt-workspace
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useProjects(userId, activeOrgId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !activeOrgId) { setLoading(false); return; }

    // Primary query: by organizationId (works after migration)
    const q = query(
      collection(db, 'projects'),
      where('organizationId', '==', activeOrgId)
    );

    const unsub = onSnapshot(q, { serverTimestamps: 'estimate' }, (snap) => {
      const byOrg = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('[useProjects] onSnapshot fired. byOrg count:', byOrg.length);

      const legacyQ = query(
        collection(db, 'projects'),
        where('team', 'array-contains', userId),
      );

      import('firebase/firestore').then(({ getDocs }) => {
        getDocs(legacyQ).then(legacySnap => {
          const legacyDocs = legacySnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => !p.organizationId);

          const merged = [...byOrg];
          legacyDocs.forEach(lp => {
            if (!merged.find(p => p.id === lp.id)) merged.push(lp);
          });

          merged.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
          });

          // DEBUG LOG - to trace if it's working
          try {
            addDoc(collection(db, 'debug_logs'), {
              msg: 'useProjects success',
              userId,
              activeOrgId,
              byOrgCount: byOrg.length,
              legacyCount: legacyDocs.length,
              totalCount: merged.length,
              time: new Date().toISOString()
            });
          } catch(e) {}

          setProjects(merged);
          setLoading(false);
        }).catch((err) => {
          byOrg.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
          });
          
          try {
            addDoc(collection(db, 'debug_logs'), {
              msg: 'useProjects catch',
              error: err.message,
              byOrgCount: byOrg.length,
              time: new Date().toISOString()
            });
          } catch(e) {}

          setProjects(byOrg);
          setLoading(false);
        });
      });
    }, (err) => {
      console.error('[useProjects]', err);
      // Fallback to team-based query if org query fails (pre-migration)
      const fallbackQ = query(
        collection(db, 'projects'),
        where('team', 'array-contains', userId)
      );
      onSnapshot(fallbackQ, { serverTimestamps: 'estimate' }, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setProjects(docs);
        setLoading(false);
      });
    });

    return () => unsub();
  }, [userId, activeOrgId]);

  return { projects, loading };
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
