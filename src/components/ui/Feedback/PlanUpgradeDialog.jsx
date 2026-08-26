'use client';

import React from 'react';
import Dialog from '@/components/ui/Dialog';
import PlanCards from '@/components/ui/DataDisplay/PlanCards';
import { PlanCrownIcon } from '@/lib/design/icons';

/**
 * What the crown opens, and what the strip's button opens, and where a 403 from
 * a route that counted for real sends the reader.
 *
 * Its whole body is `PlanCards` — the same price list the settings screen and
 * onboarding show, off the same registry. That is the point of it being this
 * component rather than a hand-written «перейдіть на Pro» panel: a dialog that
 * quoted its own ceilings would be a fourth price list, and a fourth price list
 * is a fourth thing to forget to update.
 *
 * What it adds above the cards is the one thing the price list cannot say,
 * because the price list does not know it: which ceiling was in the way just
 * now, and how full it is. Opened from a crown with nothing refused yet —
 * something simply not in this plan — it leads with that instead.
 *
 * @param {boolean} props.isOpen Whether it is on screen.
 * @param {() => void} props.onClose Closes it: the ×, the overlay and Escape all call this.
 * @param {{title: string, hint: string, reading?: string}} props.notice What was in the way, if anything.
 * @param {string} props.currentPlanId The plan the workspace is on.
 * @param {(planId: string) => void} props.onChoose Fires with the plan whose button was pressed.
 * @param {string} props.busyPlanId The plan being switched to right now.
 */
export default function PlanUpgradeDialog({
  isOpen,
  onClose,
  notice,
  currentPlanId,
  onChoose,
  busyPlanId = '',
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      bodyPadding="spacious"
      title={notice?.title || 'Тарифні плани'}
      description={notice?.hint || 'Що входить у кожен тариф і на якому ви зараз.'}
    >
      <div className="flex flex-col gap-5">
        {notice?.reading ? (
          <p className="flex items-center gap-2 rounded-[12px] bg-plan-soft px-4 py-3 text-[13px] font-bold text-plan">
            <PlanCrownIcon size={15} className="shrink-0" aria-hidden />
            Використано {notice.reading}
          </p>
        ) : null}
        <PlanCards
          activePlanId={currentPlanId}
          activeLabel="Це ваш тариф"
          onChoose={onChoose}
          busyPlanId={busyPlanId}
        />
        <div className="flex flex-col gap-1">
          {/* The way out that costs nothing, said here rather than in the strip
              across the workspace. It is real — archiving a project takes it
              off every board, every picker and every report, and bringing it
              back is checked against the same ceiling — so it belongs on the
              screen. It just does not belong in the first sentence a workspace
              says about its own limit. */}
          {notice?.hint ? (
            <p className="text-[12px] leading-relaxed text-ink-soft">{notice.hint}</p>
          ) : null}
          <p className="text-[12px] leading-relaxed text-muted">
            Оплата ще не підключена — тариф можна перемкнути будь-коли й без карти.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
