'use client';
import { AlertCircle, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

export default function PriorityBadge({ priority = 'low', showIcon = true, className = '' }) {
  const priorityMap = {
    blocker: {
      bg: 'bg-[#fee2e2]',
      text: 'text-[#7f1d1d]',
      icon: AlertOctagon,
      label: 'Blocker',
    },
    high: {
      bg: 'bg-[#fed7aa]',
      text: 'text-[#92400e]',
      icon: AlertTriangle,
      label: 'High',
    },
    medium: {
      bg: 'bg-[#fefce8]',
      text: 'text-[#92400e]',
      icon: AlertCircle,
      label: 'Medium',
    },
    low: {
      bg: 'bg-[#f5f5f5]',
      text: 'text-[#9a9a9a]',
      icon: AlertCircle,
      label: 'Low',
    },
    info: {
      bg: 'bg-[#eef2ff]',
      text: 'text-[#3730a3]',
      icon: Info,
      label: 'Info',
    },
  };

  const config = priorityMap[priority] || priorityMap.low;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-[6px] text-[11px] font-bold ${config.bg} ${config.text} ${className}`}
    >
      {showIcon && <Icon size={12} />}
      {config.label}
    </span>
  );
}
