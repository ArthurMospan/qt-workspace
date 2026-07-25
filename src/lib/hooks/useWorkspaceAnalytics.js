'use client';

// src/lib/hooks/useWorkspaceAnalytics.js
// Loads project issues plus every organization time log. Calendar events may
// intentionally have no project, but they still belong in team analytics.
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

// Firestore 'in' supports up to 30 items; chunk to be safe
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
export function useWorkspaceAnalytics(projectIds = []) {
  const {
    activeOrgId
  } = useAppContext();
  const [issues, setIssues] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId) {
      queueMicrotask(() => {
        setIssues([]);
        setTimeLogs([]);
        setIssueLinks([]);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setIssues([]);
      setTimeLogs([]);
      setIssueLinks([]);
      setLoading(true);
    });
    const chunks = chunkArray(projectIds, 10);
    const allIssues = {};
    const allTimeLogs = {};
    const allIssueLinks = {};
    let pendingIssues = chunks.length;
    let pendingTimeLogs = 1;
    let pendingLinks = 1; // Not partitioned by project, just one query per org
    const unsubs = [];
    const checkDone = () => {
      if (pendingIssues === 0 && pendingTimeLogs === 0 && pendingLinks === 0) setLoading(false);
    };
    const flushIssues = () => setIssues(Object.values(allIssues));
    const flushLogs = () => setTimeLogs(Object.values(allTimeLogs));
    const flushLinks = () => setIssueLinks(Object.values(allIssueLinks));
    
    // Fetch all links for the org (usually small enough)
    const lq = query(collection(db, 'issueLinks'), where('organizationId', '==', activeOrgId));
    const unsubLinks = onSnapshot(lq, { serverTimestamps: 'estimate' }, snap => {
      snap.docs.forEach(d => { allIssueLinks[d.id] = { id: d.id, ...d.data() }; });
      if (pendingLinks > 0) pendingLinks--;
      flushLinks();
      checkDone();
    }, () => {
      if (pendingLinks > 0) pendingLinks--;
      checkDone();
    });
    unsubs.push(unsubLinks);

    const tq = query(collection(db, 'timeLogs'), where('organizationId', '==', activeOrgId));
    const unsubTimeLogs = onSnapshot(tq, {
      serverTimestamps: 'estimate'
    }, snap => {
      const currentIds = new Set(snap.docs.map(d => d.id));
      Object.keys(allTimeLogs).forEach(id => {
        if (!currentIds.has(id)) delete allTimeLogs[id];
      });
      snap.docs.forEach(d => {
        allTimeLogs[d.id] = {
          id: d.id,
          ...d.data()
        };
      });
      if (pendingTimeLogs > 0) pendingTimeLogs--;
      flushLogs();
      checkDone();
    }, () => {
      if (pendingTimeLogs > 0) pendingTimeLogs--;
      checkDone();
    });
    unsubs.push(unsubTimeLogs);

    chunks.forEach(chunk => {
      // Issues query
      const iq = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId), where('projectId', 'in', chunk));
      const unsub1 = onSnapshot(iq, {
        serverTimestamps: 'estimate'
      }, snap => {
        snap.docs.forEach(d => {
          allIssues[d.id] = {
            id: d.id,
            ...d.data()
          };
        });
        // Also remove any deleted docs
        const chunkIssueIds = new Set(snap.docs.map(d => d.id));
        // keep only issues from other chunks
        Object.keys(allIssues).forEach(id => {
          if (!chunkIssueIds.has(id) && chunk.includes(allIssues[id]?.projectId)) {
            delete allIssues[id];
          }
        });
        if (pendingIssues > 0) pendingIssues--;
        flushIssues();
        checkDone();
      }, () => {
        if (pendingIssues > 0) pendingIssues--;
        checkDone();
      });
      unsubs.push(unsub1);
    });
    return () => unsubs.forEach(u => u());
  }, [activeOrgId, projectIds.join(',')]); // eslint-disable-line

  return {
    issues,
    timeLogs,
    issueLinks,
    loading
  };
}
