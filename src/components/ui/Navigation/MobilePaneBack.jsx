'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * The way back to the list on a phone. `SidebarLayout` shows one pane at a
 * time below `md`, and the pane it shows has to offer a way out — this is it,
 * and it hides itself at `md` and up where both panes are on screen anyway.
 *
 * Team and Settings each drew it, identically apart from the space beneath it.
 * That space is the gap to whatever follows, which is placement, so it stays at
 * the call site; everything else — the arrow, the type, the colour, the
 * `md:hidden` — belongs here.
 *
 * @param {string} props.label Where it goes back to, in words: «До списку команди».
 * @param {() => void} props.onClick Goes there.
 * @param {string} props.className Placement in the parent only — the gap under it.
 */
export default function MobilePaneBack({ label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`md:hidden flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-ink transition-colors ${className}`}
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}
