import React from 'react';

// ─── UI Kit: FilterBar Component ──────────────────────────────────────────────
// A unified container for filter controls (Select, MultiSelect).
// Renders a soft gray background area that groups the filters visually.

export default function FilterBar({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-1 bg-canvas rounded-[10px] p-[4px] min-h-[36px] w-max max-w-full ${className}`}>
      {children}
    </div>
  );
}
