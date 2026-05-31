import React from 'react';

// ─── UI Kit: FilterBar Component ──────────────────────────────────────────────
// A unified container for filter controls (Select, MultiSelect).
// Renders a soft gray background area that groups the filters visually.

export default function FilterBar({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-1 bg-[#f4f4f5] rounded-[10px] p-[4px] h-[36px] w-max ${className}`}>
      {children}
    </div>
  );
}
