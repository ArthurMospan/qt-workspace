'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { colors, spacing, sizing, shadows, transitions, zIndex } from '@/lib/design/tokens';

/**
 * Dropdown Component
 *
 * A simplified dropdown menu component with a button trigger and optional icon.
 * Automatically closes on item selection.
 *
 * @component
 * @param {Object} props
 * @param {Array} props.items - Array of menu items to display
 * @param {string} props.items[].label - Display text for the item
 * @param {Function} props.items[].onClick - Handler when item is clicked
 * @param {string} props.trigger - Button label text (displays as button with chevron)
 * @param {string} [props.variant] - Button style: 'primary' or 'secondary' (default: 'secondary')
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <Dropdown
 *   trigger="Actions"
 *   variant="secondary"
 *   items={[
 *     { label: 'Edit', onClick: () => handleEdit() },
 *     { label: 'Delete', onClick: () => handleDelete() }
 *   ]}
 * />
 */
export function Dropdown({ items = [], trigger, variant = 'secondary', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

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

  // Variant styles for the trigger button
  const variantStyles = {
    primary: {
      bg: colors.dark,
      text: colors.surface,
      hover: colors.hover.dark,
    },
    secondary: {
      bg: colors.light,
      text: colors.text.primary,
      hover: colors.hover.light,
    },
  };

  const buttonStyle = variantStyles[variant] || variantStyles.secondary;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing.md,
          height: '36px',
          padding: `0 ${spacing.md}`,
          backgroundColor: buttonStyle.bg,
          color: buttonStyle.text,
          border: 'none',
          borderRadius: sizing.radius.lg,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: `background-color ${transitions.default} ${transitions.timing}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = buttonStyle.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = buttonStyle.bg;
        }}
      >
        <span>{trigger}</span>
        <ChevronDown
          size={14}
          style={{
            transition: `transform ${transitions.default} ${transitions.timing}`,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: spacing.xs,
            minWidth: '200px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border.light}`,
            borderRadius: sizing.radius.xl,
            boxShadow: shadows.xl,
            zIndex: zIndex.dropdown,
            overflow: 'hidden',
          }}
          className="animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div style={{ padding: `${spacing.sm} 0` }}>
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleItemClick(item.onClick)}
                style={{
                  width: '100%',
                  textAlign: 'left',
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
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dropdown;
