'use client';
import React from 'react';

export default function Counter({
  value,
  variant = 'count', // count, dot
  status = 'info',   // info, danger, muted, success
  size = 'md',       // sm, md, lg
  appearance = 'solid', // solid, subtle
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
      muted: 'bg-muted',
    };

    return (
      <span
        className={`inline-block rounded-full shrink-0 ${dotSizes[size]} ${dotColors[status]} ${className}`}
      />
    );
  }

  // Count variant
  const outerSizes = {
    xs: 'min-w-[12px] h-[12px] px-[2px] text-[8px] font-bold',
    sm: 'min-w-[16px] h-[16px] px-[4px] text-[9px] font-bold',
    md: 'min-w-[20px] h-[20px] px-[6px] text-[10px] font-bold',
    lg: 'min-w-[24px] h-[24px] px-[8px] text-[11px] font-bold',
  };

  const statusStyles = appearance === 'subtle'
    ? 'bg-white/60 text-muted'
    : appearance === 'inverse-outline'
      ? 'border-[3px] border-[#171717] bg-white text-[#171717]'
      : dark
        ? 'bg-white text-ink'
        : 'bg-ink text-white';

  // Format value (e.g. 99+)
  const displayValue = typeof value === 'number' && value > 99 ? '99+' : value;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full tabular-nums ${outerSizes[size]} ${statusStyles} ${className}`}
    >
      {displayValue}
    </span>
  );
}
