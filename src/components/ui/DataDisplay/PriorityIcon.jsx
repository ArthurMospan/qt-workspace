'use client';

import { priorityPresentation } from '@/lib/utils/priorities.mjs';

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

// Match the 5px footprint of a ranked priority's centre dot. The broken line
// is deliberately quiet: it says «not ranked yet», never another priority.
const NO_PRIORITY_RADIUS = 2.1;
const NO_PRIORITY_STROKE_WIDTH = 0.8;

/**
 * Canonical priority mark: ranked priorities use one solid colour dot on a
 * 40%-opacity halo of the same colour. The system «Без пріоритету» state uses
 * a neutral dashed ring, so an intentional lack of rank does not look like a
 * missing icon.
 *
 * @param {object|string} props.priority Priority item, id, or presentation.
 * @param {object[]} props.priorities Ordered workflow priorities for custom rank.
 * @param {'sm'|'md'} props.size Compact metadata or the stronger task-card mark.
 * @param {string} props.className Placement in the parent only.
 */
export default function PriorityIcon({ priority, priorities = [], size = 'sm', className = '' }) {
  const config = priorityPresentation(priority, priorities);
  const title = `Пріоритет: ${config.label}`;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

  if (config.isNoPriority) {
    return (
      <svg
        viewBox="0 0 16 16"
        role="img"
        aria-label={title}
        title={title}
        className={`${sizeClass} shrink-0 ${className}`.trim()}
      >
        <circle
          cx="8"
          cy="8"
          r={NO_PRIORITY_RADIUS}
          fill="none"
          stroke={config.color}
          strokeWidth={NO_PRIORITY_STROKE_WIDTH}
          strokeDasharray="0.8 1.1"
          strokeLinecap="round"
          opacity="0.38"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label={title}
      title={title}
      className={`${sizeClass} shrink-0 ${className}`.trim()}
    >
      <circle cx="8" cy="8" r="5.5" fill={config.color} fillOpacity="0.4" />
      <circle cx="8" cy="8" r="2.5" fill={config.color} />
    </svg>
  );
}
