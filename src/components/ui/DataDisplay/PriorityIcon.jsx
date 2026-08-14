'use client';

import { priorityPresentation } from '@/lib/utils/priorities.mjs';

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

const RING_STROKE_WIDTH = 1.4;

/**
 * Canonical priority mark, using the exact 16px geometry from the supplied
 * SVGs: two concentric rings and a centre circle. Low fades both rings, medium
 * activates the inner ring, and high activates both. Critical uses the supplied
 * filled ring with an exclamation mark; no priority remains a neutral dashed
 * ring. Custom levels interpolate ring opacity by their configured position.
 *
 * @param {object|string} props.priority Priority item, id, or presentation.
 * @param {object[]} props.priorities Ordered workflow priorities for custom rank.
 * @param {'sm'|'md'} props.size Compact metadata or the stronger task-card mark.
 * @param {string} props.className Placement in the parent only.
 */
export default function PriorityIcon({ priority, priorities = [], size = 'sm', className = '' }) {
  const config = priority
    && typeof priority === 'object'
    && Number.isFinite(priority.outerOpacity)
    && Number.isFinite(priority.innerOpacity)
    ? priority
    : priorityPresentation(priority, priorities);
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
        <circle cx="8" cy="8" r="5.5" fill="none" stroke={config.color} strokeWidth={RING_STROKE_WIDTH} strokeDasharray="1.8 2.1" strokeLinecap="round" opacity="0.65" />
      </svg>
    );
  }

  if (config.critical) {
    return (
      <svg
        viewBox="0 0 16 16"
        role="img"
        aria-label={title}
        title={title}
        className={`${sizeClass} shrink-0 ${className}`.trim()}
      >
        <circle cx="8" cy="8" r="5.5" fill={config.color} fillOpacity="0.2" stroke={config.color} strokeWidth={RING_STROKE_WIDTH} strokeOpacity="0.88" />
        <path d="M8 10.5H8.0075V10.5075H8V10.5Z" stroke={config.color} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 8.33333V5.5" stroke={config.color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
      <circle cx="8" cy="8" r="5.5" fill={config.color} fillOpacity="0.2" stroke={config.color} strokeWidth={RING_STROKE_WIDTH} strokeOpacity={config.outerOpacity} />
      <circle cx="8" cy="8" r="3.5" fill="none" stroke={config.color} strokeWidth={RING_STROKE_WIDTH} strokeOpacity={config.innerOpacity} />
      <circle cx="8" cy="8" r="0.7" fill={config.color} />
    </svg>
  );
}
