'use client';

import PriorityIcon from './PriorityIcon';
import { priorityPresentation } from '@/lib/utils/priorities.mjs';

/**
 * Priority mark plus its configured name. Geometry is shared; colour, label and
 * ring intensity come from the organization's ordered workflow priorities.
 *
 * @param {object|string} props.priority Priority item or id.
 * @param {object[]} props.priorities Ordered workflow priorities.
 * @param {string} props.className Placement in the parent only.
 */
export default function PriorityBadge({ priority = 'none', priorities = [], className = '' }) {
  const config = priorityPresentation(priority, priorities);
  const background = config.isNoPriority ? '#9a9a9a12' : `${config.color}14`;
  const textColor = config.isNoPriority ? '#737373' : config.color;

  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-[6px] px-[8px] py-[3px] text-[11px] font-medium backdrop-blur-[2px] ${className}`.trim()}
      style={{ background, color: textColor }}
    >
      <PriorityIcon priority={config} priorities={priorities} />
      {config.label}
    </span>
  );
}
