'use client';

/**
 * Issue priority as a dot plus its Ukrainian name. The five levels and their
 * colours are fixed here, not configurable: priority is a shared vocabulary.
 *
 * @param {'blocker'|'high'|'medium'|'low'|'info'} props.priority Which level to draw.
 * @param {string} props.className Placement in the parent only.
 */
export default function PriorityBadge({ priority = 'low', className = '' }) {
  const priorityMap = {
    blocker: {
      bg: 'bg-[#ef4444]/8',
      text: 'text-[#ef4444]',
      dot: 'bg-[#ef4444]',
      label: 'Критичний',
    },
    high: {
      bg: 'bg-[#f97316]/8',
      text: 'text-[#ea580c]',
      dot: 'bg-[#f97316]',
      label: 'Високий',
    },
    medium: {
      bg: 'bg-[#eab308]/8',
      text: 'text-[#b45309]',
      dot: 'bg-[#eab308]',
      label: 'Середній',
    },
    low: {
      bg: 'bg-muted/8',
      text: 'text-[#737373]',
      dot: 'bg-muted',
      label: 'Низький',
    },
    info: {
      bg: 'bg-[#6366f1]/8',
      text: 'text-[#4f46e5]',
      dot: 'bg-[#6366f1]',
      label: 'Інфо',
    },
  };

  const config = priorityMap[priority] || priorityMap.low;

  return (
    <span
      className={`inline-flex items-center gap-[6px] px-[8px] py-[3px] rounded-[6px] text-[11px] font-medium backdrop-blur-[2px] ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}
