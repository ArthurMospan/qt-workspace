'use client';
import { useState, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (queryText, orgId, scope = 'all') => {
    if (!queryText.trim() || !orgId) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const q = queryText.toLowerCase();

      // Fetch all issues for the org (we'll filter client-side)
      const issuesQuery = query(
        collection(db, 'issues'),
        where('organizationId', '==', orgId),
        limit(500) // Cap to prevent huge loads
      );

      const snap = await getDocs(issuesQuery);
      const issues = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Client-side filtering - search across multiple fields
      const filtered = issues.filter(issue => {
        const issueKey = (issue.issueKey || '').toLowerCase();
        const title = (issue.title || '').toLowerCase();
        const description = (issue.description || '').toLowerCase();
        const projectId = (issue.projectId || '').toLowerCase();

        // Pошук по ID, назві, описанню
        return (
          issueKey.includes(q) ||
          title.includes(q) ||
          description.includes(q) ||
          projectId.includes(q)
        );
      });

      // Sort: ID matches first, then title, then description
      filtered.sort((a, b) => {
        const aKey = (a.issueKey || '').toLowerCase();
        const bKey = (b.issueKey || '').toLowerCase();
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();

        // Exact key match scores highest
        if (aKey === q && bKey !== q) return -1;
        if (bKey === q && aKey !== q) return 1;

        // Then key starts with query
        if (aKey.startsWith(q) && !bKey.startsWith(q)) return -1;
        if (bKey.startsWith(q) && !aKey.startsWith(q)) return 1;

        // Then title starts with query
        if (aTitle.startsWith(q) && !bTitle.startsWith(q)) return -1;
        if (bTitle.startsWith(q) && !aTitle.startsWith(q)) return 1;

        // Default: by creation date
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      setResults(filtered.slice(0, 50)); // Limit display results
    } catch (err) {
      console.error('[useSearch]', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}
