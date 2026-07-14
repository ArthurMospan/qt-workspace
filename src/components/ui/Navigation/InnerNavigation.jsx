'use client';
import React from 'react';
import Button from '../Button';

export function InnerNavigation({
  items = [],
  activeId,
  onChange,
  className = '',
}) {
  // Deduplicate and filter groups in original order of appearance
  const groups = items.reduce((acc, item) => {
    if (item.group && !acc.includes(item.group)) {
      acc.push(item.group);
    }
    return acc;
  }, []);

  return (
    <aside className={`flex-1 overflow-y-auto custom-scrollbar px-[16px] py-[32px] ${className}`}>
      {groups.map(group => (
        <div key={group} className="mb-[24px] last:mb-0">
          <p className="px-3 pb-[8px] text-[10px] font-bold text-muted uppercase tracking-widest">
            {group}
          </p>
          <div className="flex flex-col gap-[2px]">
            {items
              .filter(item => item.group === group)
              .map(item => {
                const Icon = item.icon;
                const active = activeId === item.id;
                return (
                  <Button
                    key={item.id}
                    onClick={() => onChange?.(item.id)}
                    style={active ? 'primary' : 'ghost'}
                    color={active ? 'dark' : item.danger ? 'red' : 'dark'}
                    size="md"
                    icon={Icon}
                    iconSize={15}
                    className={`w-full justify-start transition-colors ${
                      active
                        ? 'font-bold shadow-sm'
                        : item.danger
                        ? 'font-medium text-red-500 hover:bg-red-50'
                        : 'font-medium text-muted hover:bg-[#ebebeb]/50 hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Button>
                );
              })}
          </div>
        </div>
      ))}
    </aside>
  );
}

export default InnerNavigation;
