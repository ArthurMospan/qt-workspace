'use client';
import React from 'react';

export default function Counter({
  value,
  variant = 'count', // count, dot
  status = 'info',   // info, danger, muted, success
  size = 'md',       // sm, md, lg
  dark = false,      // dark theme support (high contrast on dark surfaces)
  className = '',
}) {
  if (variant === 'dot') {
    const dotSizes = {
      sm: 'w-[6px] h-[6px]',
      md: 'w-[8px] h-[8px]',
      lg: 'w-[10px] h-[10px]',
    };

    const dotColors = dark ? {
      info: 'bg-[#818cf8] shadow-[0_0_8px_rgba(129,140,248,0.5)]',
      danger: 'bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.5)]',
      success: 'bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.5)]',
      muted: 'bg-[#a3a3a3]',
    } : {
      info: 'bg-[#6366f1]',
      danger: 'bg-[#ef4444]',
      success: 'bg-[#10b981]',
      muted: 'bg-[#9a9a9a]',
    };

    return (
      <span
        className={`inline-block rounded-full shrink-0 animate-pulse ${dotSizes[size]} ${dotColors[status]} ${className}`}
      />
    );
  }

  // Count variant
  const outerSizes = {
    sm: 'min-w-[16px] h-[16px] px-[4px] text-[9px] font-bold',
    md: 'min-w-[20px] h-[20px] px-[6px] text-[10px] font-bold',
    lg: 'min-w-[24px] h-[24px] px-[8px] text-[11px] font-bold',
  };

  const statusStyles = dark ? {
    info: 'bg-[#818cf8] text-white',
    danger: 'bg-[#f87171] text-white',
    success: 'bg-[#4ade80] text-white',
    muted: 'bg-[#a3a3a3] text-white',
  } : {
    info: 'bg-[#6366f1] text-white',
    danger: 'bg-[#ef4444] text-white',
    success: 'bg-[#10b981] text-white',
    muted: 'bg-[#9a9a9a] text-white',
  };

  // Format value (e.g. 99+)
  const displayValue = typeof value === 'number' && value > 99 ? '99+' : value;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${outerSizes[size]} ${statusStyles[status]} ${className}`}
    >
      {displayValue}
    </span>
  );
}
