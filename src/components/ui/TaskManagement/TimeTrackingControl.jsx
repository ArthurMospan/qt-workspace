'use client';

// ─── UI Kit: Time Tracking Control ───────────────────────────────────────────
// The timer half of the task attribute strip: a 22px start/stop square and the
// running total beside it, which doubles as the button that opens the log.
//
// Two hand-written controls sharing one 22px row, and the only place in the
// product where a control turns red to mean "running". That state had no
// representation in the kit, so nothing could show what a running timer looks
// like without opening a task and starting one.
//
// Moved with its classes intact, including the 1px nudge on the play triangle —
// lucide's Play is optically left-heavy at 10px, and `translate-x-[1px]` is what
// centres it in the square.

import React from 'react';
import { Play, Square as StopIcon } from 'lucide-react';

export default function TimeTrackingControl({
  running = false,
  disabled = false,
  onToggle,
  onOpen,
  spentLabel,
  estimateLabel,
}) {
  return (
    <div className="flex h-[22px] min-w-0 items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={running ? 'Зупинити таймер' : 'Запустити таймер'}
        title={running ? 'Зупинити таймер' : 'Запустити таймер'}
        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] leading-none transition-colors ${running ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-line text-ink hover:bg-[#d9d9d9]'}`}
      >
        {running ? (
          <StopIcon size={10} className="block fill-current" />
        ) : (
          <Play
            size={10}
            strokeWidth={0}
            className="block translate-x-[1px] fill-current"
          />
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 truncate text-[11px] font-bold text-ink"
        aria-label="Відкрити трекінг часу"
      >
        {spentLabel}
        {estimateLabel && <span className="font-medium text-muted max-sm:hidden"> / {estimateLabel}</span>}
      </button>
    </div>
  );
}
