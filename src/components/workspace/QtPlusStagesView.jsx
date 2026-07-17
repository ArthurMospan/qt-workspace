'use client';
import { useState } from 'react';
import {
  ChevronRight, FileText, Image as ImageIcon, Music, Link2, ListChecks,
  BarChart3, StickyNote, File, Check,
} from 'lucide-react';
import { usePortalStages } from '@/lib/portal/usePortalStages';
import { usePortalStageMaterials } from '@/lib/portal/usePortalStageMaterials';
import { toMaterialView, stageProgress, stageStatusMeta } from '@/lib/portal/qtplusMaterialView.mjs';

const MATERIAL_ICON = {
  file: FileText, image: ImageIcon, audio: Music, link: Link2,
  checklist: ListChecks, poll: BarChart3, note: StickyNote, unknown: File,
};

const STATUS_DOT = { muted: 'bg-faint', active: 'bg-[#6366f1]', done: 'bg-[#10b981]' };

function Spinner() {
  return <div className="w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin" />;
}

function MaterialCard({ material }) {
  const v = toMaterialView(material);
  const Icon = MATERIAL_ICON[v.icon] || File;

  const head = (
    <div className="flex items-start gap-2">
      <Icon size={15} className="text-muted shrink-0 mt-[1px]" />
      <div className="min-w-0">
        <p className="text-[13px] text-ink font-medium truncate">{v.title}</p>
        {v.subtitle && <p className="text-[12px] text-muted truncate">{v.subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="rounded-[10px] border border-line px-3 py-2 bg-white">
      {v.href ? (
        <a href={v.href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80">
          {head}
        </a>
      ) : head}

      {v.checklist && (
        <ul className="mt-2 flex flex-col gap-1 pl-[23px]">
          {v.checklist.items.map((item, i) => {
            const checked = v.checklist.checkedItems.includes(i);
            return (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center shrink-0 ${checked ? 'bg-[#10b981] border-[#10b981]' : 'border-line bg-white'}`}>
                  {checked && <Check size={10} className="text-white" />}
                </span>
                <span className={checked ? 'text-muted line-through' : 'text-ink'}>{item}</span>
              </li>
            );
          })}
        </ul>
      )}

      {v.poll && (
        <div className="mt-2 flex flex-col gap-1 pl-[23px]">
          {v.poll.options.map((opt, i) => {
            const count = v.poll.votes[i] || 0;
            const pct = v.poll.total ? Math.round((count / v.poll.total) * 100) : 0;
            return (
              <div key={i} className="text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-ink truncate">{opt}</span>
                  <span className="text-muted shrink-0">{count}</span>
                </div>
                <div className="mt-[2px] h-[4px] rounded-full bg-canvas overflow-hidden">
                  <div className="h-full bg-[#6366f1]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {v.note && (
        <div className="mt-2 pl-[23px]">
          <p className="text-[12px] text-ink whitespace-pre-wrap">{v.note.content}</p>
          {v.note.source && <p className="text-[11px] text-muted mt-1">{v.note.source}</p>}
        </div>
      )}
    </div>
  );
}

function StageMaterials({ stageId }) {
  const { materials, loading, error } = usePortalStageMaterials(stageId);
  if (loading) return <div className="py-2 pl-1"><Spinner /></div>;
  if (error) return <p className="text-[12px] text-muted py-2 pl-1">Немає доступу до матеріалів.</p>;
  if (materials.length === 0) return <p className="text-[12px] text-muted py-2 pl-1">Ще немає матеріалів.</p>;
  return (
    <div className="flex flex-col gap-2 py-2">
      {materials.map((m) => <MaterialCard key={m.id} material={m} />)}
    </div>
  );
}

export default function QtPlusStagesView({ qtProjectId }) {
  const { stages, loading, error } = usePortalStages(qtProjectId);
  const [expanded, setExpanded] = useState(null);

  if (loading) return <div className="py-3"><Spinner /></div>;
  if (error) return <p className="text-[13px] text-muted py-3">Немає доступу до цього проєкту QuickTeam+ вашим акаунтом.</p>;
  if (stages.length === 0) return <p className="text-[13px] text-muted py-3">Ще немає етапів.</p>;

  const { done, total, percent } = stageProgress(stages);

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink font-semibold">Етапи</span>
        <span className="text-[12px] text-muted">Прогрес: {percent}% ({done}/{total})</span>
      </div>

      <div className="flex flex-col gap-1">
        {stages.map((s) => {
          const meta = stageStatusMeta(s.status);
          const open = expanded === s.id;
          return (
            <div key={s.id} className="rounded-[10px] border border-line overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : s.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-canvas text-left"
              >
                <ChevronRight size={14} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                <span className="text-[13px] text-ink font-medium truncate flex-1">{s.label}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className={`w-[6px] h-[6px] rounded-full ${STATUS_DOT[meta.tone] || 'bg-faint'}`} />
                  <span className="text-[11px] text-muted">{meta.label}</span>
                </span>
              </button>
              {open && (
                <div className="px-3 pb-1 border-t border-line">
                  <StageMaterials stageId={s.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
