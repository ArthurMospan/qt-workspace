'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { colors, spacing, sizing, shadows, transitions } from '@/lib/design/tokens';
import { useFloatingOverlay } from '@/lib/hooks/useFloatingOverlay';

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
export function Popover({ trigger, children, position = 'bottom', className = '', hideCloseIcon = false, onOpenChange }) {
  const [isOpen, setIsOpenState] = useState(false);
  const setIsOpen = useCallback((value) => {
    setIsOpenState(value);
    onOpenChange?.(value);
  }, [onOpenChange]);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const popoverPosition = useFloatingOverlay({
    open: isOpen,
    anchorRef: triggerRef,
    overlayRef: popoverRef,
    preferredPlacement: position,
    align: 'center',
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current
        && !containerRef.current.contains(event.target)
        && !popoverRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  const arrowStyle = {
    top: { bottom: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    bottom: { top: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    left: { right: -5, top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
    right: { left: -5, top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
  }[popoverPosition.placement];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        {trigger}
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: popoverPosition.top,
            left: popoverPosition.left,
            visibility: popoverPosition.ready ? 'visible' : 'hidden',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border.light}`,
            borderRadius: sizing.radius.xl,
            boxShadow: shadows.xl,
            zIndex: 1000,
            minWidth: '240px',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: 'calc(100dvh - 16px)',
            overflowY: 'auto',
            padding: spacing.lg,
          }}
          className="animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {/* Arrow pointing to trigger */}
          <div
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border.light}`,
              ...arrowStyle,
            }}
          />

          {/* Close button — content may opt out (hideCloseIcon) and render its
              own cancel/apply controls via function-children instead */}
          {!hideCloseIcon && <button
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
          </button>}

          {/* Content */}
          <div style={{ paddingTop: hideCloseIcon ? 0 : spacing.sm }}>
            {typeof children === 'function' ? children({ close: () => setIsOpen(false) }) : children}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default Popover;
