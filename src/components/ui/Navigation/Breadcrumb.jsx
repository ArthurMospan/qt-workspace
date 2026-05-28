import React from 'react';
import { colors, typography, spacing } from '@/lib/design/tokens';

/**
 * Breadcrumb Component
 *
 * @component
 * A navigation component showing the current page location in a hierarchy.
 *
 * @param {Object} props
 * @param {Array} props.items - Array of breadcrumb items
 * @param {string} props.items[].label - Display text for the breadcrumb item
 * @param {string} [props.items[].href] - URL to navigate to (omit for non-clickable items)
 * @param {boolean} [props.items[].active] - Whether this item is the current/active page
 * @param {string} [props.className] - Additional CSS classes to apply
 *
 * @example
 * const items = [
 *   { label: 'Home', href: '/' },
 *   { label: 'Projects', href: '/projects' },
 *   { label: 'Current Project', active: true }
 * ];
 * <Breadcrumb items={items} />
 */
export function Breadcrumb({ items = [], className = '' }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center gap-[${spacing.sm}] ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-[4px]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = item.href && !isLast;

          return (
            <li key={index} className="flex items-center gap-[4px]">
              {isClickable ? (
                <a
                  href={item.href}
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: colors.text.primary,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: `color 200ms ease-in-out`,
                  }}
                  className="hover:opacity-70"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isLast && item.active ? colors.text.primary : colors.text.muted,
                  }}
                >
                  {item.label}
                </span>
              )}

              {!isLast && (
                <span
                  style={{
                    color: colors.text.muted,
                    fontSize: '13px',
                    marginLeft: '4px',
                  }}
                >
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
