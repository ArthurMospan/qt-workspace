'use client';

// ─── UI Kit: Calendar Day Cell ───────────────────────────────────────────────
// A whole day as a pressable tile — the timesheet's month grid, where one day
// summarises the hours logged against it.
//
// It is the fourth of the calendar's own shapes, beside `CalendarEntry`,
// `CalendarDayNumber` and `CalendarHourSlot`. The month view in the calendar
// itself draws its cells as plain containers because the entries inside them
// are the targets; here the day is the target, so it is a button.

import React from 'react';

const STATES = {
  default: 'border-black/[0.05] bg-white hover:border-black/10 hover:shadow-sm',
  // Today keeps a ring rather than the ink fill the date circle uses: a whole
  // tile filled with ink would out-shout the numbers inside it. The ring was
  // green, which read as a status — the timesheet already spends green on "the
  // day is full" — so today is drawn in the page's own ink instead.
  today: 'border-ink/25 bg-white ring-2 ring-ink/[0.06] hover:border-ink/40',
  // A weekend is an ordinary day with nothing expected of it, so it loses only
  // the lift on hover.
  weekend: 'border-black/[0.05] bg-white hover:border-black/10',
  // A day belonging to the month either side of the one on screen.
  outside: 'border-black/[0.03] bg-white/60 opacity-45',
};

/**
 * A day of a month grid, as a pressable tile.
 *
 * @param {'default'|'today'|'weekend'|'outside'} props.state Which day this is relative to today, the week and the month on screen.
 * @param {React.ReactNode} props.children The day's own summary — its date and whatever is counted against it.
 * @param {(event) => void} props.onClick Opens the day, or the week around it.
 * @param {string} props.className Placement in the parent only.
 */
export default function CalendarDayCell({ state = 'default', children, onClick, className = '', ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[86px] cursor-pointer flex-col items-start gap-[6px] rounded-[14px] border p-[10px] text-left transition-colors ${
        STATES[state] ?? STATES.default
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
