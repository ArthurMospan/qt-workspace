'use client';
// src/app/workspace/page.js — Projects overview with archive support + portal link
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ExternalLink, Archive, ArchiveRestore, Plus, Folder, Clock, Users } from 'lucide-react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const STATUS_BADGE = {
  active:   { label: 'Активний',   cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  paused:   { label: 'Пауза',      cls: 'bg-yellow-50  text-yellow-600  border-yellow-200'  },
  archived: { label: 'Архів',      cls: 'bg-[#f7f7f7]  text-[#9a9a9a]   border-[#e9e9e9]'  },
};

export default function WorkspacePage() {
  const { projects } = useAppContext();
  const [showArchived, setShowArchived] = useState(false);

  const visible = (projects || []).filter(p =>
    showArchived ? p.status === 'archived' : p.status !== 'archived'
  );

  const archive   = (id) => updateDoc(doc(db, 'projects', id), { status: 'archived' });
  const unarchive = (id) => updateDoc(doc(db, 'projects', id), { status: 'active' });

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f7f7]">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-[#1f1f1f]">Проєкти</h1>
            <p className="text-[13px] text-[#9a9a9a] mt-1">
              {(projects || []).filter(p => p.status !== 'archived').length} активних
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle archived */}
            <button
              onClick={() => setShowArchived(s => !s)}
              className={`flex items-center gap-2 px-4 py-[8px] rounded-[10px] text-[12px] font-semibold border transition-all ${
                showArchived
                  ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                  : 'bg-white text-[#9a9a9a] border-[#e9e9e9] hover:border-[#9a9a9a]'
              }`}
            >
              <Archive size={13} />
              {showArchived ? 'Показати активні' : 'Архів'}
            </button>

            {/* New project → portal */}
            <a
              href={`${PORTAL_URL}/projects/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-[8px] rounded-[10px] text-[12px] font-bold bg-[#1f1f1f] text-white hover:bg-[#303030] transition-all"
            >
              <Plus size={13} /> Новий проєкт
              <ExternalLink size={11} className="opacity-50" />
            </a>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-8 pb-8">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Folder size={40} className="text-[#e9e9e9] mb-4" />
            <p className="text-[14px] font-semibold text-[#9a9a9a]">
              {showArchived ? 'Немає архівних проєктів' : 'Немає активних проєктів'}
            </p>
            {!showArchived && (
              <a href={`${PORTAL_URL}/projects/new`} target="_blank" rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-[#1f1f1f] text-white rounded-[10px] text-[12px] font-bold hover:bg-[#303030] transition-all">
                Створити перший проєкт →
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(p => {
              const badge = STATUS_BADGE[p.status] || STATUS_BADGE.active;
              const teamCount = Array.isArray(p.team) ? p.team.length : 0;
              const budget = p.totalBudgetHours;
              const spent  = p.spentMinutes ? Math.round(p.spentMinutes / 60) : 0;
              const burnPct = budget && spent ? Math.min(Math.round((spent / budget) * 100), 100) : 0;

              return (
                <div key={p.id}
                  className="bg-white border border-[#e9e9e9] rounded-[16px] p-5 hover:border-[#cfcfcf] hover:shadow-sm transition-all group">

                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/workspace/${p.id}`}
                      className="flex-1 min-w-0 mr-3">
                      <h3 className="text-[14px] font-bold text-[#1f1f1f] group-hover:text-[#6366f1] transition-colors truncate">
                        {p.name}
                      </h3>
                    </Link>
                    <span className={`text-[10px] font-bold px-2 py-[3px] rounded-full border shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-[11px] text-[#9a9a9a] mb-4">
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {teamCount} осіб
                    </span>
                    {budget > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {spent}г / {budget}г
                      </span>
                    )}
                  </div>

                  {/* Burn rate */}
                  {budget > 0 && (
                    <div className="mb-4">
                      <div className="h-[4px] bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${burnPct >= 90 ? 'bg-red-500' : burnPct >= 70 ? 'bg-yellow-400' : 'bg-[#10b981]'}`}
                          style={{ width: `${burnPct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#9a9a9a] mt-1">{burnPct}% бюджету використано</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-[#f7f7f7]">
                    <Link href={`/workspace/${p.id}`}
                      className="flex-1 text-center py-[6px] bg-[#f7f7f7] hover:bg-[#1f1f1f] hover:text-white text-[#1f1f1f] rounded-[8px] text-[11px] font-bold transition-all">
                      Відкрити
                    </Link>

                    {p.status !== 'archived' ? (
                      <button onClick={() => archive(p.id)} title="Архівувати"
                        className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-all">
                        <Archive size={14} />
                      </button>
                    ) : (
                      <button onClick={() => unarchive(p.id)} title="Розархівувати"
                        className="p-[6px] text-[#9a9a9a] hover:text-[#10b981] hover:bg-emerald-50 rounded-[8px] transition-all">
                        <ArchiveRestore size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
