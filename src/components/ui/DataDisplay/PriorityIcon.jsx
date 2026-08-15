'use client';

import { priorityPresentation } from '@/lib/utils/priorities.mjs';

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

/**
 * Canonical priority mark: one solid colour dot on a 40%-opacity halo of the
 * same colour. Every level shares the same geometry, so colour communicates
 * priority without making people decode a second ring system.
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
