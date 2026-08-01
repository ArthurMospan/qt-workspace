'use client';
import Link from 'next/link';

// ─── UI Kit: Tabs Component ───────────────────────────────────────────────────
// Height rule: h-[36px] — matches inputs and buttons for perfect alignment.
// Wrapper: bg-canvas rounded-[10px] p-[4px] h-[36px]

/**
 * Horizontal tab strip, 36px tall so it lines up with inputs and buttons in the
 * same row. Arrow keys move between tabs, as the ARIA tab pattern requires.
 *
 * @param {{id: string, label: string, href?: string, count?: number}[]} props.tabs The tabs; `href` turns one into a link.
 * @param {string} props.activeTab Id of the selected tab.
 * @param {(id: string) => void} props.onTabChange Fires with the newly selected tab id.
 * @param {string} props.className Placement in the parent only.
 */
export default function Tabs({
  tabs      = [],
  activeTab,
  onTabChange,
  className = '',
}) {
  if (!tabs || tabs.length === 0) return null;

  const handleKeyDown = (e) => {
    const tabElements = Array.from(e.currentTarget.querySelectorAll('[role="tab"]'));
    const currentIndex = tabElements.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabElements.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabElements.length) % tabElements.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabElements.length - 1;
    }

    if (nextIndex !== null) {
      tabElements[nextIndex].focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Перемикач вкладок"
      onKeyDown={handleKeyDown}
      className={`flex bg-canvas h-[36px] p-[4px] rounded-[10px] items-center gap-[2px] shrink-0 ${className}`}
    >
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
          'transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
          active
            ? 'bg-white text-ink shadow-sm'
            : 'text-muted hover:text-ink',
        ].join(' ');

        if (tab.href) {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={classes}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={classes}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
