'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip Component
 *
 * A hover tooltip that appears near the trigger element.
 * Displays a small dark tooltip with white text and an arrow pointing to the trigger.
 * Now uses React Portal to render outside overflow hidden containers.
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
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        windowScrollY: window.scrollY,
        windowScrollX: window.scrollX,
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [isVisible]);

  if (!content) return <>{children}</>;

  let tooltipNode = null;
  if (isVisible && coords) {
    const gap = 8;
    let top = 0;
    let left = 0;
    let transform = '';
    let arrowClasses = '';

    if (position === 'top') {
      top = coords.top + coords.windowScrollY - gap;
      left = coords.left + coords.windowScrollX + coords.width / 2;
      transform = 'translate(-50%, -100%)';
      arrowClasses = 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-[4px] border-t-[#1f1f1f] border-x-[4px] border-x-transparent';
    } else if (position === 'bottom') {
      top = coords.top + coords.windowScrollY + coords.height + gap;
      left = coords.left + coords.windowScrollX + coords.width / 2;
      transform = 'translate(-50%, 0)';
      arrowClasses = 'top-[-4px] left-1/2 -translate-x-1/2 border-b-[4px] border-b-[#1f1f1f] border-x-[4px] border-x-transparent';
    } else if (position === 'left') {
      top = coords.top + coords.windowScrollY + coords.height / 2;
      left = coords.left + coords.windowScrollX - gap;
      transform = 'translate(-100%, -50%)';
      arrowClasses = 'right-[-4px] top-1/2 -translate-y-1/2 border-l-[4px] border-l-[#1f1f1f] border-y-[4px] border-y-transparent';
    } else if (position === 'right') {
      top = coords.top + coords.windowScrollY + coords.height / 2;
      left = coords.left + coords.windowScrollX + coords.width + gap;
      transform = 'translate(0, -50%)';
      arrowClasses = 'left-[-4px] top-1/2 -translate-y-1/2 border-r-[4px] border-r-[#1f1f1f] border-y-[4px] border-y-transparent';
    }

    tooltipNode = createPortal(
      <div
        style={{ top, left, transform }}
        className="absolute z-[9999] bg-[#1f1f1f] text-white px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold leading-normal w-max max-w-[240px] whitespace-normal break-words pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-100 ease-out"
      >
        <div className={`absolute w-0 h-0 ${arrowClasses}`} />
        {content}
      </div>,
      document.body
    );
  }

  return (
    <div
      ref={triggerRef}
      className={`relative ${className || 'inline-block'}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {tooltipNode}
    </div>
  );
}

export default Tooltip;
