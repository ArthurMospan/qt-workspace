'use client';

// src/lib/hooks/useSprints.js — CRUD for sprints
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  conflictingActiveSprint,
  isOrganizationSprint,
} from '@/lib/utils/sprintScope.mjs';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { reportLoadError } from '@/lib/utils/errors';
export function useSprints() {
  const {
    activeOrgId, currentUser
  } = useAppContext();
  const { closedStatusIds } = useWorkflowConfig();
  // uid, not the object: a new `currentUser` identity (any write to the user
  // document produces one) used to re-subscribe and re-read every sprint.
  const currentUserId = currentUser?.id || currentUser?.uid || null;
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId || !currentUserId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const q = query(
      collection(db, 'sprints'),
      where('organizationId', '==', activeOrgId),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort by createdAt ascending (oldest first)
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setSprints(docs);
      setLoading(false);
    }, err => {
      reportLoadError('[useSprints]', err);
      setLoading(false);
    });
    return () => unsub();
  }, [activeOrgId, currentUserId]);
  const createSprint = useCallback(async data => {
    if (!activeOrgId) return;

    // Auto-generate name if not provided
    const usedNumbers = new Set(sprints.map(s => Number(s.name?.match(/^Спринт (\d+)$/)?.[1])).filter(Boolean));
    let sprintNumber = 1;
    while (usedNumbers.has(sprintNumber)) sprintNumber += 1;
    const name = data.name || `Спринт ${sprintNumber}`;
    // An empty scope is the whole organization — the shape every sprint written
    // before project scope existed already has. See sprintScope.mjs.
    const projectIds = [...new Set(
      (Array.isArray(data.projectIds) ? data.projectIds : [])
        .filter(id => typeof id === 'string' && id.trim()),
    )].slice(0, 50);
    await addDoc(collection(db, 'sprints'), {
      organizationId: activeOrgId,
      name,
      projectIds,
      goal: data.goal || '',
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: 'planned',
      // planned, active, completed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [activeOrgId, sprints]);
  const updateSprint = useCallback(async (sprintId, data) => {
    await updateDoc(doc(db, 'sprints', sprintId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, []);
  const deleteSprint = useCallback(async sprintId => {
    if (!activeOrgId) return;
    // Remove sprintId only from issues in the active organization.
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId), where('sprintId', '==', sprintId));
    const snap = await getDocs(q);
    for (let offset = 0; offset < snap.docs.length; offset += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(offset, offset + 400).forEach(d => {
        batch.update(d.ref, { sprintId: null, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
    await deleteDoc(doc(db, 'sprints', sprintId));
  }, [activeOrgId]);
  const startSprint = useCallback(async sprintId => {
    // Several sprints may run at once — that is the point of scoping them to
    // projects. Two of them may not claim the same project, because inside one
    // project «зараз у роботі» has to name one sprint.
    const sprint = sprints.find(item => item.id === sprintId);
    const conflict = conflictingActiveSprint(sprints, sprint);
    if (conflict) {
      throw new Error(
        isOrganizationSprint(conflict) || isOrganizationSprint(sprint)
          ? `Спринт «${conflict.name}» уже активний і охоплює всі проєкти — завершіть його або звузьте до конкретних проєктів`
          : `Спринт «${conflict.name}» уже активний у тих самих проєктах`,
      );
    }
    const batch = writeBatch(db);
    batch.update(doc(db, 'sprints', sprintId), {
      status: 'active',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  }, [sprints]);
  const completeSprint = useCallback(async (sprintId, moveToSprintId = null) => {
    if (!activeOrgId) return;
    if (moveToSprintId) {
      const destination = sprints.find(s => s.id === moveToSprintId);
      if (!destination || destination.id === sprintId || destination.status === 'completed') {
        throw new Error('Некоректний спринт призначення');
      }
    }

    const issuesQuery = query(
      collection(db, 'issues'),
      where('organizationId', '==', activeOrgId),
      where('sprintId', '==', sprintId),
    );
    const issueSnap = await getDocs(issuesQuery);
    const incomplete = issueSnap.docs.filter(issueDoc => {
      const issue = issueDoc.data();
      return !closedStatusIds.includes(issue.columnId || issue.status);
    });

    for (let offset = 0; offset < incomplete.length; offset += 400) {
      const batch = writeBatch(db);
      incomplete.slice(offset, offset + 400).forEach(issueDoc => {
        batch.update(issueDoc.ref, { sprintId: moveToSprintId, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }

    await updateDoc(doc(db, 'sprints', sprintId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [activeOrgId, sprints, closedStatusIds]);
  return {
    sprints,
    loading,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint
  };
}
