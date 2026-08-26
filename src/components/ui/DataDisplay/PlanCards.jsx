'use client';

import React from 'react';
import { Check } from 'lucide-react';
import Card from '@/components/ui/Layout/Card';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/DataDisplay/Pill';
import {
  PLANS,
  planAddedCapabilities,
  planInheritanceLabel,
  planLimitRows,
} from '@/lib/utils/plans.mjs';

/**
 * The price list. One of them, and only one.
 *
 * There used to be two, and they disagreed about the product: onboarding drew
 * three hand-built cards at $0/$9/$19 with four invented bullet points each and
 * a different accent colour per plan, while the settings screen drew the
 * registry. A person met the first on the day they signed up and the second the
 * first time they went looking for the bill, and nothing kept the two in step —
 * the prices had already drifted apart from what the product charges.
 *
 * So the price list is a component and the plans are data. Both screens pass
 * the same three things: which plan is already chosen, what to call it on its
 * own button, and what to do when another one is picked.
 *
 * ── Why the columns line up ──────────────────────────────────────────────
 *
 * `grid-rows-subgrid`. The card is not a stack of blocks that happen to be the
 * same height; it is five bands — name, price, ceilings, button, what the plan
 * adds — and every band is one row of the outer grid, so its height is the
 * tallest of the three across the row. That is what puts the three prices on
 * one line and the three buttons on another, whatever any card holds. A column
 * of stacked blocks cannot do it: a tagline that wraps to two lines in one card
 * pushes that card's price down and nothing else's, which is the drift that was
 * there before — every card correct on its own and the row a staircase.
 *
 * Below `lg` there is one column and nothing to align, so the card is a plain
 * flex stack.
 *
 * @param {string} props.activePlanId The plan already in force, or already picked.
 * @param {string} props.activeLabel What its own button says — «Це ваш тариф», «Обрано».
 * @param {(planId: string) => void} props.onChoose Fires with the plan whose button was pressed.
 * @param {string} props.busyPlanId The plan being switched to right now; its button spins.
 * @param {string} props.className Placement in the parent only.
 */
export default function PlanCards({
  activePlanId,
  activeLabel = 'Це ваш тариф',
  onChoose,
  busyPlanId = '',
  className = '',
}) {
  const busy = Boolean(busyPlanId);

  return (
    <div
      className={`grid gap-x-5 gap-y-5 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_auto] lg:gap-y-0 ${className}`}
    >
      {PLANS.map(plan => {
        const isActive = plan.id === activePlanId;
        const added = planAddedCapabilities(plan.id);
        return (
          <Card
            key={plan.id}
            preset="bordered"
            padding="none"
            className={`flex flex-col overflow-hidden lg:grid lg:grid-rows-subgrid lg:row-span-5 ${
              isActive ? 'border-ink' : ''
            }`}
          >
            {/* Name, and who the plan is for. The badge sits beside the name
                rather than straddling the top edge, and it is the only mark the
                most popular plan gets: a card in a second colour tells somebody
                which one we would like them to buy, not which one fits. */}
            <div className="flex items-start justify-between gap-3 px-7 pt-7 pb-6">
              <div className="min-w-0">
                <h3 className="ui-type-detail-title text-ink">{plan.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{plan.tagline}</p>
              </div>
              {plan.recommended && (
                <Pill size="md" tone="ink-subtle" className="mt-[3px]">Популярний</Pill>
              )}
            </div>

            <p className="flex items-baseline gap-2 px-7 pb-6">
              <span className="text-[36px] font-black leading-none tracking-tight text-ink">
                {plan.priceLabel}
              </span>
              <span className="text-[13px] font-medium text-muted">{plan.currencyLabel}</span>
            </p>

            {/* The ceilings. Label left, figure right, so the three cards read
                as one table across the row. */}
            <ul className="flex flex-col gap-[10px] px-7 pb-6">
              {planLimitRows(plan.id).map(limit => (
                <li key={limit.id} className="flex items-baseline justify-between gap-4 text-[13px]">
                  <span className={`min-w-0 ${limit.absent ? 'text-faint' : 'text-muted'}`}>
                    {limit.label}
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${limit.absent ? 'text-faint' : 'text-ink'}`}>
                    {limit.value}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 px-7 pb-7">
              <Button
                onClick={() => onChoose?.(plan.id)}
                style={isActive ? 'secondary' : plan.recommended ? 'primary' : 'secondary'}
                size="lg"
                disabled={isActive || busy}
                loading={busyPlanId === plan.id}
                className="w-full"
              >
                {isActive ? activeLabel : plan.ctaLabel}
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-faint">{plan.ctaNote}</p>
            </div>

            {/* Only what this plan adds. The heading says where the rest of it
                came from. The tick is the product's own ink: a green one is a
                colour the workspace uses to mean «done», spent here on «this
                line is in this plan», which it is not. */}
            <div className="flex flex-col gap-3 border-t border-line px-7 py-6">
              <p className="ui-type-eyebrow">{planInheritanceLabel(plan.id)}</p>
              <ul className="flex flex-col gap-[10px]">
                {added.map(capability => (
                  <li key={capability.id} className="flex gap-2.5">
                    <Check size={15} className="mt-[2px] shrink-0 text-ink" />
                    <span className="min-w-0 text-[13px] leading-snug text-ink">{capability.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
