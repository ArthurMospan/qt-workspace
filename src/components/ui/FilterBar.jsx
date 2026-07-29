import React, { Children, cloneElement, isValidElement } from 'react';

// ─── UI Kit: FilterBar Component ──────────────────────────────────────────────
// A unified container for filter controls (Select, MultiSelect).
// Renders a soft gray background area that groups the filters visually.

const WIDTHS = {
  default: {
    type: 'w-[136px]',
    date: 'w-[136px]',
    member: 'w-[148px]',
    project: 'w-[200px]',
    sort: 'w-[180px]',
    priority: 'w-[148px]',
    sprint: 'w-[148px]',
    status: 'w-[148px]',
  },
  detail: {
    type: 'w-[136px]',
    date: 'w-[136px]',
    member: 'w-[148px]',
    project: 'w-[210px]',
    sort: 'w-[180px]',
    priority: 'w-[148px]',
    sprint: 'w-[148px]',
    status: 'w-[148px]',
  },
};

export function getFilterControlWidth(role, context = 'default') {
  if (!role) return '';
  return WIDTHS[context]?.[role] ?? WIDTHS.default[role] ?? '';
}

export default function FilterBar({ children, context = 'default', className = '' }) {
  const controls = Children.map(children, child => {
    if (!isValidElement(child) || !child.props.filterRole) return child;
    return cloneElement(child, {
      filterContext: child.props.filterContext || context,
    });
  });

  return (
    <div className={`flex flex-wrap items-center gap-1 ${context === 'detail' ? 'bg-white' : 'bg-canvas'} rounded-[10px] p-[4px] min-h-[36px] w-max max-w-full ${className}`}>
      {controls}
    </div>
  );
}
