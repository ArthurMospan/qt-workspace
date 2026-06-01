'use client';
import React from 'react';
import { Tag as TagIcon, X } from 'lucide-react';

function hexToRgba(hex, alpha) {
  if (!hex) return 'transparent';
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function Tag({
  label,
  onRemove,
  variant = 'default',
  showIcon = true,
  color = null,
  size = 'default',
  className = '',
}) {
  const variants = {
    default: 'bg-[#1f1f1f]/5 text-[#404040]',
    success: 'bg-[#10b981]/8 text-[#047857]',
    warning: 'bg-[#fbbf24]/8 text-[#b45309]',
    danger: 'bg-[#ef4444]/8 text-[#b91c1c]',
    error: 'bg-[#f97316]/8 text-[#c2410c]',
    info: 'bg-[#6366f1]/8 text-[#4338ca]',
  };

  const sizeMap = {
    default: 'px-[10px] py-[3px] rounded-[8px] text-[11px] gap-1.5',
    small: 'px-[6px] py-[1.5px] rounded-[6px] text-[10px] gap-[4px]',
  };

  const vClass = color ? '' : (variants[variant] || variants.default);
  const dynamicStyle = color ? {
    background: hexToRgba(color, 0.08),
    color: color
  } : {};

  return (
    <div
      className={`inline-flex items-center font-medium backdrop-blur-[2px] ${sizeMap[size]} ${vClass} ${className}`}
      style={dynamicStyle}
    >
      {showIcon && <TagIcon size={size === 'small' ? 8 : 10} className="shrink-0 opacity-70" />}
      <span>{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity p-0.5 ml-0.5 shrink-0"
        >
          <X size={size === 'small' ? 8 : 10} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}
