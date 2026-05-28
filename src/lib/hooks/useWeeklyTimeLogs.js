'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
export function useWeeklyTimeLogs(weekStartDate) {
  const {
    activeOrgId,
    currentUser
  } = useAppContext();
  const [logs, setLogs] = useState([]);
  const [issuesMap, setIssuesMap] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId || !currentUser || !weekStartDate) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    setLoading(true);
    const start = new Date(weekStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const q = query(collection(db, 'timeLogs'), where('organizationId', '==', activeOrgId), where('userId', '==', currentUser.id || currentUser.uid), where('loggedAt', '>=', Timestamp.fromDate(start)), where('loggedAt', '<', Timestamp.fromDate(end)));
    getDocs(q).then(async snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setLogs(data);
      const issueIds = [...new Set(data.map(d => d.issueId).filter(Boolean))];
      if (issueIds.length > 0) {
        // Since 'in' query has 10 item limit, we batch it or just fetch them one by one if not too many
        // For simplicity, we can fetch all and build a map
        const map = {};
        for (let i = 0; i < issueIds.length; i += 10) {
          const batch = issueIds.slice(i, i + 10);
          const iq = query(collection(db, 'issues'), where('__name__', 'in', batch));
          const iSnap = await getDocs(iq);
          iSnap.forEach(d => {
            map[d.id] = d.data();
          });
        }
        setIssuesMap(map);
      } else {
        setIssuesMap({});
      }
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching time logs', err);
      setLoading(false);
    });
  }, [activeOrgId, currentUser, weekStartDate]);
  return {
    logs,
    issuesMap,
    loading
  };
}