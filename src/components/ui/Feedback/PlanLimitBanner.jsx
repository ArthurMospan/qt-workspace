'use client';

import React from 'react';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconAction from '@/components/ui/IconAction';

/**
 * The strip that says a ceiling has run out, across the top of the workspace.
 *
 * A crown beside a control answers «чому» to somebody already reaching for that
 * control. It cannot answer the other question — «чому нічого не створюється» —
 * because the person asking it is not looking at any particular control, and on
 * a workspace that has quietly filled up, everything they reach for next will
 * refuse them one at a time. That is the case this exists for: said once, at
 * the top, before anything is pressed.
 *
 * ── Two things it deliberately is not ───────────────────────────────────
 *
 * It is not violet, and it does not carry a crown. The violet means «this is on
 * another plan» — a fact about the plan, which is what the crown marks. This is
 * a fact about *now*: something that was working has filled up. Grey, a step
 * darker than the canvas it sits on, is what a condition looks like; painting
 * it in the upgrade colour would make the workspace's own state read as an
 * advertisement.
 *
 * It is also not shown for something the plan never had. A workspace on Free
 * has no call analysis at all, and a strip announcing that on an empty new
 * workspace is not news — it is a line of the price list, permanently pinned to
 * the top of every screen. `planLimitNotices` filters those out; the crown on
 * the control says it at the moment it matters.
 *
 * And it says what ran out, not how to get around it. The way that costs no
 * money — archive a project, deactivate a seat — is real and is still offered,
 * inside the dialog, after somebody has seen what the plans cost. Leading with
 * it here would make the first thing the workspace says about its own ceiling a
 * tip for not paying.
 *
 * @param {{title: string, reading?: string}} props.notice What ran out; from `planLimitNotice`.
 * @param {number} props.extra How many further ceilings are also full, named in one clause.
 * @param {() => void} props.onOpen Opens the price list on that ceiling.
 * @param {() => void} props.onDismiss Puts it away; absent means it cannot be dismissed.
 * @param {string} props.className Placement in the parent only.
 */
export default function PlanLimitBanner({ notice, extra = 0, onOpen, onDismiss, className = '' }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      // Full-bleed on a phone, where the page itself is edge to edge, and a
      // floating strip on the desktop, where every panel around it floats.
      className={`print:hidden flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-strong bg-line px-4 py-[10px] sm:px-6 md:mb-[12px] md:rounded-[16px] md:border ${className}`}
    >
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
        <span className="font-bold">{notice.title}</span>
        {notice.reading ? <span className="font-bold"> · {notice.reading}</span> : null}
        {extra > 0 ? <span className="text-ink-soft"> Ще {extra} стеля цього тарифу вичерпана.</span> : null}
      </p>
      <Button onClick={onOpen} style="primary" size="md" className="shrink-0">
        Тарифні плани
      </Button>
      {onDismiss ? (
        <IconAction label="Приховати на тиждень" icon={X} size="sm" appearance="quiet" onClick={onDismiss} />
      ) : null}
    </div>
  );
}
