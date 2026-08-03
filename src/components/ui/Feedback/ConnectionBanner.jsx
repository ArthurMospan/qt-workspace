'use client';

import { CloudOff } from 'lucide-react';

// ─── UI Kit: ConnectionBanner ────────────────────────────────────────────────
// The one place the app admits it is offline.
//
// Firestore queues writes while the connection is gone, so nothing visibly
// fails: the board still moves, the comment still appears, and the person keeps
// working on the assumption that it landed. This says otherwise, and says it
// persistently — a toast that disappears after four seconds is exactly the wrong
// shape for a condition that lasts.

/**
 * A persistent strip shown while the browser reports no connection.
 *
 * @param {boolean} props.offline Whether to show it.
 * @param {string} props.message What it says.
 */
export default function ConnectionBanner({
  offline,
  message = 'Немає звʼязку. Зміни збережуться, щойно зʼявиться інтернет.',
}) {
  return (
    <div
      // Always in the tree, so the reader is told the moment it changes rather
      // than only if it happens to change while something else re-renders.
      role="status"
      aria-live="polite"
      className={`print:hidden fixed left-1/2 top-[12px] z-[60] flex -translate-x-1/2 items-center gap-[8px] rounded-[12px] border border-[#f0c98a] bg-[#fff6e5] px-[14px] py-[8px] shadow-[0_6px_20px_-6px_rgba(0,0,0,0.25)] transition-all duration-200 ${
        offline ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-[140%] opacity-0'
      }`}
    >
      <CloudOff size={15} className="shrink-0 text-[#b26a00]" />
      <span className="text-[12px] font-semibold text-[#7a4a00]">{message}</span>
    </div>
  );
}
