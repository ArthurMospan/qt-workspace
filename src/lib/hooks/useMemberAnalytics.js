'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export function useMemberAnalytics(uid) {
  const { activeOrgId } = useAppContext();
  const [stats, setStats] = useState({
    tasksDone: 0,
    messages: 0,
    files: 0,
    loading: true
  });

  useEffect(() => {
    if (!uid || !activeOrgId) {
      setStats(s => ({ ...s, loading: false }));
      return;
    }

    let isMounted = true;

    async function fetchStats() {
      try {
        let tasksDoneCount = 0;
        let filesCount = 0;

        // Fetch done tasks for this user
        try {
          const issuesRef = collection(db, 'issues');
          const qTasks = query(
            issuesRef,
            where('organizationId', '==', activeOrgId),
            where('assigneeIds', 'array-contains', uid),
            where('status', '==', 'done')
          );
          const tasksSnap = await getCountFromServer(qTasks);
          tasksDoneCount = tasksSnap.data().count;
        } catch (err) {
          console.warn('[useMemberAnalytics] Could not fetch tasks (might need index):', err);
          // Fallback if composite index is missing: just get all issues for org (might be heavy if many) or ignore.
          // For now, we will leave it as 0 if index is missing, and log the link.
        }

        if (isMounted) {
          setStats({
            tasksDone: tasksDoneCount,
            messages: 0, // Messages require deep channel traversal or cloud functions, leaving 0 for now
            files: 0,    // Files require similar traversal, leaving 0 for now
            loading: false
          });
        }
      } catch (err) {
        console.error('[useMemberAnalytics] Error fetching stats:', err);
        if (isMounted) {
          setStats(s => ({ ...s, loading: false }));
        }
      }
    }

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [uid, activeOrgId]);

  return stats;
}
