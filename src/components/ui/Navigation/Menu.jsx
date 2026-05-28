'use client';

import React, { useState, useRef, useEffect } from 'react';
import { colors, spacing, sizing, shadows, transitions, zIndex } from '@/lib/design/tokens';

/**
 * Menu Component
 *
 * A dropdown menu component with optional icons for each menu item.
 * Closes automatically on item selection or outside click.
 *
 * @component
 * @param {Object} props
 * @param {Array} props.items - Array of menu items
 * @param {string} props.items[].label - Display text for the menu item
 * @param {React.ComponentType} [props.items[].icon] - Icon component from lucide-react
 * @param {Function} props.items[].onClick - Handler when item is clicked
 * @param {React.ReactNode} props.trigger - Element or button that triggers the menu
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <Menu
 *   trigger={<button>Menu</button>}
 *   items={[
 *     { label: 'Edit', icon: Edit, onClick: () => handleEdit() },
 *     { label: 'Delete', icon: Trash, onClick: () => handleDelete() }
 *   ]}
 * />
 */
export function Menu({ items = [], trigger, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (onClick) => {
    onClick?.();
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: spacing.xs,
            minWidth: '200px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border.light}`,
            borderRadius: sizing.radius.lg,
            boxShadow: shadows.xl,
            zIndex: zIndex.dropdown,
            overflow: 'hidden',
          }}
          className="animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div style={{ padding: `${spacing.sm} 0` }}>
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleItemClick(item.onClick)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: `${spacing.sm} ${spacing.md}`,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: colors.text.primary,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: `background-color ${transitions.default} ${transitions.timing}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.light;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {Icon && <Icon size={16} style={{ color: colors.text.muted, flexShrink: 0 }} />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;
