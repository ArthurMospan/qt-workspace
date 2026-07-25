'use client';
import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { canAccessStage, stageStatusMeta } from '@/lib/portal/qtplusStageModel.mjs';

const TONE_DOT = { muted: 'bg-faint', active: 'bg-ink', done: 'bg-[#10b981]' };

export default function StageStepper({ stages, activeId, onSelect }) {
  const scrollRef = useRef(null);
  const itemRefs = useRef({});

  // Автоскрол до активного кроку. Ефект нічого не сетить — лише скролить,
  // тож react-hooks/set-state-in-effect тут не застосовне.
  useEffect(() => {
    const el = itemRefs.current[activeId];
    const box = scrollRef.current;
    if (!el || !box) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [activeId]);

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto border-b border-line">
      <div className="flex w-full min-w-max items-center">
        {stages.map((s) => {
          const meta = stageStatusMeta(s.status);
          const accessible = canAccessStage(s);
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              ref={(el) => { itemRefs.current[s.id] = el; }}
              onClick={() => accessible && onSelect(s.id)}
              disabled={!accessible}
              aria-current={active ? 'step' : undefined}
              aria-disabled={!accessible}
              title={accessible ? meta.label : 'Етап ще не розпочато'}
              className={`flex min-w-[140px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 pb-2 pt-1 text-[13px] border-b-2 transition-colors ${
                active ? 'border-ink text-ink font-semibold' : 'border-transparent text-muted'
              } ${accessible ? 'hover:text-ink cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
            >
              <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${TONE_DOT[meta.tone] || 'bg-faint'}`} />
              {s.label || 'Без назви'}
              {!accessible && <Lock size={11} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
