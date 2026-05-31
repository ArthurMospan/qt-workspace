'use client';
// src/components/ClientProjectViewer.jsx — Read-only view of client project materials
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const ICONS = { image: '🖼', link: '🔗', note: '📝', audio: '🎵', file: '📄', video: '🎬', poll: '📊', checklist: '✅' };

export default function ClientProjectViewer({ projectId, stageId, stages }) {
  const [selectedId, setSelectedId] = useState(stageId || null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId && stages?.length > 0) setSelectedId(stages[0].id);
  }, [stages, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    const q = query(collection(db, 'stages', selectedId, 'materials'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [selectedId]);

  return (
    <div className="flex flex-col h-full">
      {/* Open in portal link */}
      {projectId && (
        <a
          href={`${PORTAL_URL}/project/${projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[7px] text-white/30 hover:text-white/60 text-[11px] font-medium mb-[14px] transition-colors w-fit"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Відкрити в порталі клієнта
        </a>
      )}

      {/* Stage tabs */}
      {stages?.length > 0 && (
        <div className="flex gap-[6px] flex-wrap mb-[14px]">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => setSelectedId(stage.id)}
              className={`text-[10px] font-medium px-[9px] py-[4px] rounded-full border transition-all ${
                selectedId === stage.id
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/15'
              }`}
            >
              {stage.label?.replace(/^\d+\.\s*/, '') || 'Етап'}
            </button>
          ))}
        </div>
      )}

      {/* Materials */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-[40px]">
            <div className="w-[22px] h-[22px] border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[40px] text-center">
            <div className="text-[28px] mb-[8px]">📂</div>
            <p className="text-white/25 text-[12px]">Матеріалів немає</p>
          </div>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {materials.map(m => (
              <div key={m.id} className="flex items-start gap-[10px] bg-white/[0.04] border border-white/[0.06] rounded-[12px] px-[12px] py-[10px]">
                <span className="text-[16px] shrink-0 mt-[1px]">{ICONS[m.type] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-[12px] font-semibold truncate">{m.title || m.type}</p>
                  {m.text && <p className="text-white/40 text-[11px] mt-[2px] line-clamp-2 leading-relaxed">{m.text}</p>}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-blue-400/60 text-[11px] mt-[2px] hover:text-blue-400 truncate block transition-colors">
                      {m.url}
                    </a>
                  )}
                  {m.type === 'image' && m.url && (
                    <img src={m.url} alt={m.title} className="mt-[8px] rounded-[8px] max-h-[100px] object-cover w-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
