'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { colors, spacing, sizing, shadows, transitions, zIndex } from '@/lib/design/tokens';

/**
 * Popover Component
 *
 * A generic popover container that appears near a trigger element.
 * Includes a close button and arrow pointing to the trigger.
 *
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Element that triggers the popover
 * @param {React.ReactNode} props.children - Content to display in the popover
 * @param {string} [props.position] - Position relative to trigger: 'top', 'bottom', 'left', 'right' (default: 'bottom')
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <Popover
 *   trigger={<button>Info</button>}
 *   position="top"
 * >
 *   <div>Popover content goes here</div>
 * </Popover>
 */
export function Popover({ trigger, children, position = 'bottom', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

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

  const getPositionStyles = () => {
    const arrowSize = 8;
    const gap = 8;

    switch (position) {
      case 'top':
        return {
          top: 'auto',
          bottom: `calc(100% + ${gap}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          arrowBottom: `-${arrowSize}px`,
          arrowLeft: '50%',
          arrowTransform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: '50%',
          right: `calc(100% + ${gap}px)`,
          left: 'auto',
          transform: 'translateY(-50%)',
          arrowRight: `-${arrowSize}px`,
          arrowTop: '50%',
          arrowTransform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: '50%',
          left: `calc(100% + ${gap}px)`,
          transform: 'translateY(-50%)',
          arrowLeft: `-${arrowSize}px`,
          arrowTop: '50%',
          arrowTransform: 'translateY(-50%)',
        };
      case 'bottom':
      default:
        return {
          top: `calc(100% + ${gap}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          arrowTop: `-${arrowSize}px`,
          arrowLeft: '50%',
          arrowTransform: 'translateX(-50%)',
        };
    }
  };

  const positionStyles = getPositionStyles();

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border.light}`,
            borderRadius: sizing.radius.xl,
            boxShadow: shadows.xl,
            zIndex: zIndex.modal,
            minWidth: '240px',
            padding: spacing.lg,
            ...positionStyles,
          }}
          className="animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {/* Arrow pointing to trigger */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `8px solid ${colors.surface}`,
              ...positionStyles,
            }}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: 'transparent',
              border: 'none',
              color: colors.text.muted,
              cursor: 'pointer',
              transition: `color ${transitions.default} ${transitions.timing}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.text.muted;
            }}
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div style={{ paddingTop: spacing.sm }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default Popover;
