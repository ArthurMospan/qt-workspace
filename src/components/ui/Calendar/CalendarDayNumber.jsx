'use client';

// ─── UI Kit: Calendar Day Number ─────────────────────────────────────────────
// The date in the corner of a day cell, which is also the control that opens
// that day. Part of the calendar's own vocabulary, beside `CalendarEntry` and
// `CalendarHourSlot`.

import React from 'react';

const STATES = {
  today: 'bg-ink text-white',
  default: 'text-ink hover:bg-canvas',
  // A day belonging to the month either side of the one on screen.
  outside: 'text-faint',
};

/**
 * The date in the corner of a day cell, and the control that opens that day.
 *
 * @param {'today'|'default'|'outside'} props.state Which day this is relative to today and to the month on screen.
 * @param {React.ReactNode} props.children The date itself.
 * @param {(event) => void} props.onClick Opens the day.
 * @param {string} props.className Placement in the parent only.
 */
export default function CalendarDayNumber({ state = 'default', children, onClick, className = '', ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 w-7 rounded-full text-[11px] font-bold ${STATES[state] ?? STATES.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
