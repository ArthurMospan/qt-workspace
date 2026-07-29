'use client';
import React from 'react';

// ─── UI Kit: Segmented Control ───────────────────────────────────────────────
// Compact pill switch for mutually exclusive view options (period, week/month…).
// Designed to sit INSIDE a FilterBar (transparent bg, active pill = white),
// so per-tab view controls live in the same container as the other filters.
//
// <Segmented value={period} onChange={setPeriod}
//   options={[7, 14, 30, 90].map(d => ({ value: d, label: `${d}д` }))} />

const SURFACES = {
  transparent: '',
  canvas: 'bg-canvas',
};

export default function Segmented({
  value,
  onChange,
  options = [],
  surface = 'transparent',
  composition,
  className = '',
}) {
  return (
    <div
      role="group"
      aria-label="Вибір режиму"
      data-ui-composition={composition}
      className={`ui-segmented flex items-center gap-[2px] p-[2px] rounded-[8px] shrink-0 ${SURFACES[surface] ?? ''} ${className}`}
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange?.(o.value)}
          aria-pressed={value === o.value}
          className={`px-[10px] h-[26px] text-[12px] font-semibold rounded-[7px] transition-all cursor-pointer ${
            value === o.value
              ? 'bg-white text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
