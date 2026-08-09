'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Pill from '@/components/ui/DataDisplay/Pill';

/**
 * Chooses the exact project status after a card was dropped on a shared
 * category in «Мої завдання». The choices deliberately reuse the board-column
 * composition so this feels like finishing the drag, not learning a new UI.
 *
 * @param {boolean} props.isOpen Whether the dialog is visible.
 * @param {object} props.issue Task being moved.
 * @param {object} props.project Project that owns the task and its statuses.
 * @param {object[]} props.statuses Exact status columns available at the destination.
 * @param {string} props.categoryLabel Shared category selected on the personal board.
 * @param {(statusId: string) => void} props.onSelect Confirms the exact destination status.
 * @param {() => void} props.onClose Cancels the pending move.
 * @param {boolean} props.busy Whether the status update is being saved.
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
      presentation="dialog"
      titleContext="dialog"
      title={`Оберіть колонку для ${issueKey}`}
      description={`«${categoryLabel}» у проєкті ${project?.name || 'Без назви'}`}
      size="lg"
      bodyPadding="flush"
      footer={(
        <>
          <Button style="secondary" size="md" disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button
            style="primary"
            size="md"
            loading={busy}
            disabled={!activeStatus}
            onClick={() => activeStatus && onSelect?.(activeStatus.id)}
          >
            Перенести в «{activeStatus?.label || 'статус'}»
          </Button>
        </>
      )}
    >
      <div className="px-5 py-5 sm:px-6">
        <p className="mb-4 text-[12px] leading-relaxed text-muted">
          У цій категорії є кілька статусів. Оберіть точну колонку — завдання переміститься після підтвердження.
        </p>

        <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-1">
          {statuses.map(status => {
            const active = status.id === activeStatus?.id;
            const color = status.color || '#9a9a9a';

            return (
              <button
                key={status.id}
                type="button"
                disabled={busy}
                aria-pressed={active}
                onClick={() => setActiveStatusId(status.id)}
                className={`group flex min-h-[184px] w-[220px] shrink-0 snap-center flex-col overflow-hidden rounded-[16px] bg-canvas text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-wait disabled:opacity-60 sm:w-[224px] ${
                  active ? 'ring-2 ring-ink' : 'hover:bg-[#f0f0f2]'
                }`}
              >
                <span className="flex w-full items-center justify-between px-4 pb-3 pt-4">
                  <span className="flex min-w-0 items-center gap-[6px]">
                    <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: color }} />
                    <span className="ui-type-column-title truncate uppercase tracking-wide text-ink">
                      {status.label}
                    </span>
                    <Pill tone="count" size="md" className="ml-1">{active ? 1 : 0}</Pill>
                  </span>
                  {active ? <Check size={14} className="shrink-0 text-ink" /> : null}
                </span>

                <span className="flex flex-1 flex-col p-[8px] pt-0">
                  {active ? (
                    <motion.span
                      layoutId="status-transition-task"
                      initial={reduceMotion ? false : { opacity: 0, y: 12, rotate: -1.5 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 30 }}
                      className="block rounded-[16px] bg-white px-3 py-3 shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
                    >
                      <span className="block truncate font-mono text-[10px] font-bold uppercase tracking-wide text-muted">
                        {issueKey}
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold leading-snug text-ink">
                        {issue?.title || 'Без назви'}
                      </span>
                    </motion.span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
