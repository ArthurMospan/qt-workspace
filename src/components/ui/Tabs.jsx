'use client';
import Link from 'next/link';

export default function Tabs({
  tabs = [],
  activeTab,
  onTabChange,
  className = '',
}) {
  if (!tabs || tabs.length === 0) return null;

  return (
    <div className={`flex bg-[#f7f7f7] p-[3px] rounded-[10px] items-center gap-[2px] shrink-0 ${className}`}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;

        const content = (
          <>
            {Icon && <Icon size={13} />}
            {tab.label}
          </>
        );

        const classes = `
          flex items-center justify-center gap-[6px] px-[16px] h-[32px] text-[12px] font-semibold
          rounded-[8px] transition-all whitespace-nowrap
          ${
            active
              ? 'bg-white text-[#1f1f1f] shadow-sm'
              : 'text-[#9a9a9a] hover:text-[#1f1f1f]'
          }
        `;

        if (tab.href) {
          return (
            <Link key={tab.id} href={tab.href} className={classes}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
