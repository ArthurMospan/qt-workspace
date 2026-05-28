'use client';

import React, { useState, useRef, useEffect } from 'react';
import { colors, spacing, sizing, shadows, transitions, zIndex } from '@/lib/design/tokens';

/**
 * Tooltip Component
 *
 * A hover tooltip that appears near the trigger element.
 * Displays a small dark tooltip with white text and an arrow pointing to the trigger.
 *
 * @component
 * @param {Object} props
 * @param {string} props.content - Text to display in the tooltip
 * @param {React.ReactNode} props.children - The element that triggers the tooltip
 * @param {string} [props.position] - Position relative to trigger: 'top', 'bottom', 'left', 'right' (default: 'top')
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * <Tooltip content="Click to save" position="top">
 *   <button>Save</button>
 * </Tooltip>
 */
export function Tooltip({ content, children, position = 'top', className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 100);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionStyles = () => {
    const gap = 8;
    const arrowSize = 4;

    switch (position) {
      case 'top':
        return {
          bottom: `calc(100% + ${gap}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          arrowBottom: `-${arrowSize}px`,
          arrowLeft: '50%',
          arrowTransform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: `calc(100% + ${gap}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          arrowTop: `-${arrowSize}px`,
          arrowLeft: '50%',
          arrowTransform: 'translateX(-50%)',
        };
      case 'left':
        return {
          right: `calc(100% + ${gap}px)`,
          top: '50%',
          transform: 'translateY(-50%)',
          arrowRight: `-${arrowSize}px`,
          arrowTop: '50%',
          arrowTransform: 'translateY(-50%)',
        };
      case 'right':
        return {
          left: `calc(100% + ${gap}px)`,
          top: '50%',
          transform: 'translateY(-50%)',
          arrowLeft: `-${arrowSize}px`,
          arrowTop: '50%',
          arrowTransform: 'translateY(-50%)',
        };
      default:
        return {};
    }
  };

  const positionStyles = getPositionStyles();

  return (
    <div
      className={`relative inline-block ${className}`}
      ref={containerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            backgroundColor: colors.dark,
            color: colors.surface,
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: sizing.radius.md,
            fontSize: '12px',
            fontWeight: 500,
            maxWidth: '240px',
            wordWrap: 'break-word',
            whiteSpace: 'normal',
            zIndex: zIndex.tooltip,
            pointerEvents: 'none',
            ...positionStyles,
          }}
          className="animate-in fade-in-0 duration-200"
        >
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `4px solid ${colors.dark}`,
              ...positionStyles,
            }}
          />

          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
