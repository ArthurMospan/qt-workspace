'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Layers3 } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Pill from '@/components/ui/DataDisplay/Pill';

/**
 * Chooses the exact project status after a card was dropped on a shared
 * category in «Мої завдання». Each option is drawn as a tiny board column so
 * the choice preserves the mental model of the drag that opened it.
 *
 * @param {boolean} props.isOpen Whether the picker is visible.
 * @param {object} props.issue Task being moved.
 * @param {object} props.project Task's project.
 * @param {object[]} props.statuses Visible statuses in the destination category.
 * @param {string} props.categoryLabel Shared category the card was dropped on.
 * @param {(statusId: string) => void} props.onSelect Commits the exact status.
 * @param {() => void} props.onClose Cancels the pending move.
 * @param {boolean} props.busy A transition is being saved.
 */
export default function StatusTransitionPicker({
  isOpen,
  issue,
  project,
  statuses = [],
  categoryLabel = '',
  onSelect,
  onClose,
  busy = false,
}) {
  const [activeStatusId, setActiveStatusId] = useState(statuses[0]?.id || '');
  const reduceMotion = useReducedMotion();

  const activeStatus = statuses.find(status => status.id === activeStatusId) || statuses[0];
  const issueKey = issue?.issueKey || 'Завдання';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? undefined : onClose}
      title={`Куди летить ${issueKey}?`}
      size="md"
      bodyPadding="flush"
    >
      <div className="overflow-hidden">
        <div className="flex items-start gap-3 px-5 pb-4 pt-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-ink text-white">
            <Layers3 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-relaxed text-ink">
              У категорії «{categoryLabel}» проєкт має кілька колонок.
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              Оберіть точний статус для «{issue?.title || 'Без назви'}» у проєкті {project?.name || 'Без назви'}.
            </p>
          </div>
        </div>

        <div className="border-y border-line bg-canvas px-4 py-4">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(statuses.length, 1), 4)}, minmax(0, 1fr))` }}
          >
            {statuses.map(status => {
              const active = status.id === activeStatus?.id;
              const color = status.color || '#9a9a9a';
              return (
                <button
                  key={status.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={active}
                  onMouseEnter={() => setActiveStatusId(status.id)}
                  onFocus={() => setActiveStatusId(status.id)}
                  onClick={() => onSelect?.(status.id)}
                  className={`group relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-[14px] border bg-white p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-wait disabled:opacity-60 ${
                    active
                      ? 'border-ink/20 shadow-[0_12px_32px_rgba(0,0,0,0.10)] -translate-y-1'
                      : 'border-line hover:border-ink/15 hover:-translate-y-0.5'
                  }`}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex min-w-0 items-start gap-2 pt-1">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-ink">
                      {status.label}
                    </span>
                    {active ? <Check size={13} className="shrink-0 text-ink" /> : null}
                  </span>

                  <span className="mt-auto block min-h-[58px] pt-4">
                    {active ? (
                      <motion.span
                        layoutId="status-transition-task"
                        initial={reduceMotion ? false : { opacity: 0, y: 10, rotate: -2 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 30 }}
                        className="block rounded-[10px] border border-black/[0.06] bg-white px-2 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.10)]"
                      >
                        <span className="block truncate font-mono text-[9px] font-bold uppercase tracking-wide text-muted">
                          {issueKey}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-semibold text-ink">
                          {issue?.title || 'Без назви'}
                        </span>
                      </motion.span>
                    ) : (
                      <span className="block h-[45px] rounded-[10px] border border-dashed border-line/80 bg-canvas/60" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted">Точний маршрут</p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <Pill tone="neutral" size="sm" weight="medium">{categoryLabel}</Pill>
              <ArrowRight size={12} className="shrink-0 text-faint" />
              <span className="truncate text-[12px] font-bold text-ink">
                {activeStatus?.label || 'Оберіть статус'}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="shrink-0 rounded-[10px] px-3 py-2 text-[12px] font-semibold text-muted transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
          >
            Скасувати
          </button>
        </div>
      </div>
    </Dialog>
  );
}
