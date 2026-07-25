'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingOverlay } from '@/lib/hooks/useFloatingOverlay';

// UI Kit: ContextMenu Component (Atom)
// Features standard rounded-[12px] corners, soft shadow, and unified font-medium labels

export default function ContextMenu({
  trigger, // React element that triggers the menu (e.g. Button)
  items = [], // Array of items: { label, icon, onClick, isDivider, isDanger, color }
  className = '',
  dropdownClassName = '',
  onOpenChange, // Callback when open state changes
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const menuPosition = useFloatingOverlay({
    open: isOpen,
    anchorRef: containerRef,
    overlayRef: menuRef,
    preferredPlacement: 'bottom',
    align: 'end',
    gap: 4,
  });

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current
        && !containerRef.current.contains(event.target)
        && !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (trigger.props.onClick) {
      trigger.props.onClick(e);
    }
  };

  return (
    <div className={`relative inline-block ${isOpen ? 'z-50' : ''} ${className}`} ref={containerRef}>
      {React.cloneElement(trigger, {
        onClick: handleTriggerClick,
      })}

      {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            className={`fixed z-[1000] w-[200px] max-w-[calc(100vw-16px)] rounded-[12px] border border-[#f0f0f0] bg-white py-[6px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] ${dropdownClassName}`}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              visibility: menuPosition.ready ? 'visible' : 'hidden',
            }}
          >
            {items.map((item, idx) => {
              if (item.isDivider) {
                return <div key={`div-${idx}`} className="h-[1px] bg-[#f0f0f0] my-[4px] mx-[14px]" />;
              }

              const Icon = item.icon;
              const isDanger = item.isDanger || item.color === 'red' || item.color === '#ef4444';

              return (
                <button
                  key={item.label || idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.(e);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-[14px] py-[9px] text-[13px] font-medium flex items-center gap-[8px] transition-colors ${
                    isDanger 
                      ? 'text-[#ef4444] hover:bg-red-50' 
                      : 'text-ink hover:bg-canvas'
                  }`}
                  style={item.color && !isDanger ? { color: item.color } : {}}
                >
                  {Icon && (
                    <Icon 
                      size={14} 
                      className={isDanger ? 'text-[#ef4444]' : 'text-muted'} 
                    />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
      )}
    </div>
  );
}
