'use client';
import Link from 'next/link';

// ─── UI Kit: Tabs Component ───────────────────────────────────────────────────
// Height rule: h-[36px] — matches inputs and buttons for perfect alignment.
// Wrapper: bg-[#f4f4f5] rounded-[10px] p-[4px] h-[36px]

export default function Tabs({
  tabs      = [],
  activeTab,
  onTabChange,
  className = '',
}) {
  if (!tabs || tabs.length === 0) return null;

  return (
    <div className={`flex bg-[#f4f4f5] h-[36px] p-[4px] rounded-[10px] items-center gap-[2px] shrink-0 ${className}`}>
      {tabs.map(tab => {
        const Icon   = tab.icon;
        const active = activeTab === tab.id;

        const content = (
          <>
            {Icon && <Icon size={14} />}
            {tab.label}
          </>
        );

        const classes = [
          'flex items-center justify-center gap-[6px]',
          tab.label ? 'px-[16px]' : 'w-[28px] shrink-0',
          'h-[28px] text-[13px] font-medium rounded-[8px]',
          'transition-all whitespace-nowrap',
          active
            ? 'bg-white text-[#1f1f1f]'
            : 'text-[#9a9a9a] hover:text-[#1f1f1f]',
        ].join(' ');

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
