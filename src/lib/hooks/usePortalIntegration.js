'use client';
// src/lib/hooks/usePortalIntegration.js
// Reads data from portal collections (stages/materials + project messages)
// CLIENT-FACING data — read only from workspace side
import { useState, useEffect } from 'react';
import {
  collection, doc, query, orderBy, limit,
  onSnapshot, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Fetch single material by (stageId, materialId) or just stageId ────────────
export function usePortalMaterial(linkedId) {
  const [material, setMaterial] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!linkedId) { setLoading(false); return; }

    // linkedId can be stageId OR stageId/materialId
    const parts = linkedId.split('/');
    let ref;
    if (parts.length === 2) {
      ref = doc(db, 'stages', parts[0], 'materials', parts[1]);
    } else {
      ref = doc(db, 'stages', linkedId);
    }

    getDoc(ref).then(snap => {
      setMaterial(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [linkedId]);

  return { material, loading };
}

// ── Stream last 50 messages from portal project chat ─────────────────────────
export function usePortalChat(projectId) {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }

    const q = query(
      collection(db, 'projects', projectId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse(); // oldest first
      setMessages(msgs);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [projectId]);

  return { messages, loading };
}

// ── Stage (client project) info ───────────────────────────────────────────────
export function usePortalStage(stageId) {
  const [stage,   setStage]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stageId) { setLoading(false); return; }
    getDoc(doc(db, 'stages', stageId)).then(snap => {
      setStage(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [stageId]);

  return { stage, loading };
}
