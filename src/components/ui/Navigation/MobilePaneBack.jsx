'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * The way back to the list on a phone. `SidebarLayout` shows one pane at a
 * time below `md`, and the pane it shows has to offer a way out — this is it,
 * and it hides itself at `md` and up where both panes are on screen anyway.
 *
 * It used to be a labelled text button on a line of its own («Всі
 * налаштування»), which cost a row of screen and, worse, stacked: a settings
 * section with its own way back — «Усі інтеграції» — put two of them one above
 * the other, each returning somewhere different. An arrow beside the title is
 * one control in the one place a phone looks for it, so there is only ever room
 * for one and it always means "one level up".
 *
 * Chat had already arrived at exactly this arrow and drew its own, with a note
 * saying it should become shared the moment Settings and Team adopted it. They
 * have; this is it. A 26px box — an 18px glyph with 4px around it — which is
 * deliberately not on the `IconAction` scale: this control sits in a title row
 * and has to align with type, not with a toolbar.
 *
 * The words are still here, as the accessible name and the tooltip. «До списку
 * команди» is what the arrow does; it just no longer takes a line to say so.
 *
 * @param {string} props.label Where it goes back to, in words. Read by screen readers, shown as the tooltip.
 * @param {() => void} props.onClick Goes there.
 * @param {string} props.className Placement in the parent only.
 */
export default function MobilePaneBack({ label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`md:hidden -ml-1 shrink-0 p-1 text-muted transition-colors hover:text-ink ${className}`}
    >
      <ArrowLeft size={18} />
    </button>
  );
}
