'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import { PlanCrownIcon } from '@/lib/design/icons';
import { usePlanLimits } from '@/lib/hooks/usePlanLimits';
import { capabilityAvailability, capabilityById } from '@/lib/utils/plans.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';

/**
 * A whole screen the plan does not include, and what stands there instead.
 *
 * The crown is the mark for a control that will not move. This is for the case
 * one size up: not a switch inside a screen but the screen itself — «Інтеграції»,
 * «Перенесення даних», the invoice tab. Those were open on every plan while the
 * price list sold them, which is the failure this whole registry exists to stop,
 * and there was nowhere to put a 12px crown because there was no control to put
 * it beside.
 *
 * What it draws is deliberately not an advertisement. It names the thing, says
 * in one line what it does and which plans have it, and offers one button. A
 * blurred screenshot of the feature behind a paywall — the pattern that shows
 * what somebody is missing — makes the product look like it is taunting them,
 * and it is also a lie: the blurred pixels are of somebody else's data.
 *
 * The wording is the registry's, so a screen cannot describe a capability
 * differently from the price list that sells it.
 *
 * @param {string} props.capabilityId One of `PLAN_CAPABILITIES`.
 * @param {React.ReactNode} props.children What the plan is allowed to see.
 * @param {string} props.className Placement in the parent only.
 */
export default function PlanGate({ capabilityId, children, className = '' }) {
  const { allows } = usePlanLimits();
  const openPlanUpgrade = useWorkspaceStore(state => state.openPlanUpgrade);
  const capability = capabilityById(capabilityId);

  if (allows(capabilityId) || !capability) return children;

  return (
    <div className={`flex flex-col items-center rounded-[16px] bg-plan-soft px-6 py-10 text-center ${className}`}>
      <PlanCrownIcon size={28} className="mb-4 text-plan" aria-hidden />
      <h3 className="ui-type-feature-title text-ink">{capability.label}</h3>
      {capability.detail ? (
        <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-ink-soft">{capability.detail}</p>
      ) : null}
      <p className="mt-1 text-[13px] font-bold text-plan">
        Доступно {capabilityAvailability(capabilityId)}
      </p>
      <Button
        onClick={() => openPlanUpgrade({ capabilityId, reason: capability.label })}
        style="primary"
        size="lg"
        className="mt-6"
      >
        Тарифні плани
      </Button>
    </div>
  );
}
