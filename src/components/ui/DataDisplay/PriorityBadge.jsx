'use client';

export default function PriorityBadge({ priority = 'low', className = '' }) {
  const priorityMap = {
    blocker: {
      bg: 'bg-[#ef4444]/8',
      text: 'text-[#ef4444]',
      dot: 'bg-[#ef4444]',
      label: 'Blocker',
    },
    high: {
      bg: 'bg-[#f97316]/8',
      text: 'text-[#ea580c]',
      dot: 'bg-[#f97316]',
      label: 'High',
    },
    medium: {
      bg: 'bg-[#eab308]/8',
      text: 'text-[#b45309]',
      dot: 'bg-[#eab308]',
      label: 'Medium',
    },
    low: {
      bg: 'bg-[#9a9a9a]/8',
      text: 'text-[#737373]',
      dot: 'bg-[#9a9a9a]',
      label: 'Low',
    },
    info: {
      bg: 'bg-[#6366f1]/8',
      text: 'text-[#4f46e5]',
      dot: 'bg-[#6366f1]',
      label: 'Info',
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
