'use client';

import React, { useState } from 'react';

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
 */
export function Tooltip({ content, children, position = 'top', className = '' }) {
  const [isVisible, setIsVisible] = useState(false);

  if (!content) return <>{children}</>;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-[8px]',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-[8px]',
    left: 'right-full top-1/2 -translate-y-1/2 mr-[8px]',
    right: 'left-full top-1/2 -translate-y-1/2 ml-[8px]',
  };

  const arrowClasses = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-[4px] border-t-[#1f1f1f] border-x-[4px] border-x-transparent',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-[4px] border-b-[#1f1f1f] border-x-[4px] border-x-transparent',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-[4px] border-l-[#1f1f1f] border-y-[4px] border-y-transparent',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-[4px] border-r-[#1f1f1f] border-y-[4px] border-y-transparent',
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div
          className={`absolute z-[100] bg-[#1f1f1f] text-white px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold leading-normal w-max max-w-[240px] whitespace-normal break-words pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-100 ease-out ${positionClasses[position]}`}
        >
          {/* Arrow */}
          <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
