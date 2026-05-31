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
          <p className="px-3 pb-[8px] text-[10px] font-bold text-[#9a9a9a] uppercase tracking-widest">
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
                    style="ghost"
                    color={active ? 'dark' : item.danger ? 'red' : 'gray'}
                    size="md"
                    icon={Icon}
                    iconSize={15}
                    className={`w-full justify-start font-medium transition-colors ${
                      active
                        ? 'bg-[#ebebeb] text-[#1f1f1f]'
                        : item.danger
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-[#9a9a9a] hover:bg-[#ebebeb]/50 hover:text-[#1f1f1f]'
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
