'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import { PlanCrownIcon } from '@/lib/design/icons';

/**
 * The strip that says a ceiling has been met, across the top of the workspace.
 *
 * A crown beside a control answers «чому» to somebody already reaching for that
 * control. It cannot answer the other question — «чому нічого не створюється» —
 * because the person asking it is not looking at any particular control, and on
 * a workspace that has quietly filled up, everything they reach for next will
 * refuse them one at a time. That is the case this exists for: said once, at
 * the top, before anything is pressed.
 *
 * Deliberately not a toast and not a dialog. A toast leaves, and a full
 * workspace is a condition rather than an event; a dialog would have to be
 * dismissed on every screen. This sits in the layout and goes when the
 * condition does.
 *
 * It is gold, not red. Nothing has broken and nothing was lost — the workspace
 * is doing exactly what the plan says it does, which is a different thing from
 * a failure and should not be dressed as one.
 *
 * @param {{title: string, hint: string}} props.notice What ran out; from `planLimitNotice`.
 * @param {number} props.extra How many further ceilings are also met, named in one clause.
 * @param {() => void} props.onOpen Opens the price list on that ceiling.
 * @param {string} props.className Placement in the parent only.
 */
export default function PlanLimitBanner({ notice, extra = 0, onOpen, className = '' }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      // Full-bleed on a phone, where the page itself is edge to edge, and a
      // floating strip on the desktop, where every panel around it floats.
      className={`print:hidden flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-plan/25 bg-plan-soft px-4 py-[10px] sm:px-6 md:mb-[12px] md:rounded-[16px] md:border ${className}`}
    >
      <PlanCrownIcon size={15} className="shrink-0 text-plan" aria-hidden />
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-plan-ink">
        <span className="font-bold">{notice.title}</span>
        {notice.reading ? <span className="font-bold"> · {notice.reading}</span> : null}
        <span className="hidden sm:inline"> {notice.hint}</span>
        {extra > 0 ? <span> Ще {extra} обмеження на цьому тарифі.</span> : null}
      </p>
      <Button onClick={onOpen} style="primary" size="md" className="shrink-0">
        Тарифні плани
      </Button>
    </div>
  );
}
