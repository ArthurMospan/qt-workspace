'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { Tooltip } from '@/components/ui/Navigation/Tooltip';

/**
 * A filled black star beside something the current plan does not include.
 *
 * It belongs next to the control, not on the price list. A price list already
 * says what a plan has by listing it; the useful place for this mark is the
 * moment somebody reaches for a switch and finds it will not move — that is
 * where «чому» is being asked, and a greyed control with no reason beside it is
 * indistinguishable from a broken one.
 *
 * Deliberately small and quiet. It reports a fact about the plan, it is not an
 * advertisement, and a workspace that pins a bright badge to every locked
 * control reads as a demo of itself.
 *
 * @param {string} props.label What the plan is missing — becomes the tooltip.
 * @param {string} props.className Placement in the parent only.
 */
export default function PlanMark({ label, className = '' }) {
  if (!label) return null;
  return (
    <Tooltip content={label} className={`relative inline-flex shrink-0 ${className}`}>
      <Star
        size={12}
        aria-label={label}
        role="img"
        className="fill-ink text-ink"
      />
    </Tooltip>
  );
}
