'use client';
import React from 'react';
import { X } from 'lucide-react';

export default function Chip({
  label,
  icon: Icon,
  deletable = false,
  onDelete,
  color = 'default',
  clickable = false,
  onClick,
  className = ''
}) {
  const colorMap = {
    default: 'bg-[#f5f5f5] text-[#1f1f1f]',
    primary: 'bg-[#e6f4ff] text-[#1e40af]',
    success: 'bg-[#ecfdf5] text-[#065f46]',
    warning: 'bg-[#fefce8] text-[#92400e]',
    danger: 'bg-[#fee2e2] text-[#7f1d1d]',
  };

  const bgColor = colorMap[color] || colorMap.default;
  const cursor = clickable ? 'cursor-pointer' : '';
  const hoverClass = clickable ? 'hover:opacity-80 transition-opacity' : '';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-[10px] h-[32px] ${bgColor} ${cursor} ${hoverClass} ${className}`}
    >
      {Icon && <Icon size={14} />}
      <span className="text-[12px] font-bold">{label}</span>
      {deletable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="ml-[4px] hover:opacity-60 transition-opacity"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
