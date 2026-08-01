'use client';

// ─── UI Kit: Time Log Row ────────────────────────────────────────────────────
// One entry in a task's time journal: who logged it, how much, when, and the
// author's edit/delete pair.
//
// The task detail appeared to draw this list twice, in two different designs.
// It did not: the second copy sat behind `{false && …}`, so half the styling
// anybody might have matched against was markup that had not rendered in a long
// time. That block is gone, and this is the design that actually ships.
//
// Presentational only: the amount and the date arrive already formatted, so the
// kit carries no localization and no time maths.

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Pill from '@/components/ui/DataDisplay/Pill';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';

export default function TimeLogRow({
  member,
  spentLabel,
  dateLabel,
  description,
  canEdit = false,
  onEdit,
  onDelete,
}) {
  return (
    <div data-ui-surface="local" className="group flex items-start gap-3 rounded-[10px] bg-canvas px-3 py-2.5">
      <UserAvatar user={member} size="sm" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-ink">{member?.name || 'Невідомий'}</span>
          <Pill tone="surface-ink" size="md" shape="badge">{spentLabel}</Pill>
          <span className="text-[10px] text-muted">{dateLabel}</span>
        </div>
        {description && <p className="mt-1 break-words text-[12px] leading-5 text-muted">{description}</p>}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100">
          <button type="button" onClick={onEdit} className="rounded-[6px] p-1.5 text-muted hover:bg-white hover:text-ink" aria-label="Редагувати запис"><Pencil size={13} /></button>
          <button type="button" onClick={onDelete} className="rounded-[6px] p-1.5 text-muted hover:bg-red-50 hover:text-red-500" aria-label="Видалити запис"><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  );
}
