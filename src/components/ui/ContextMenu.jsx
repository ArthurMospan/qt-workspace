'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useFloatingOverlay } from '@/lib/hooks/useFloatingOverlay';
import { useFloatingOverlayEscape } from '@/lib/hooks/useFloatingOverlayEscape';

// UI Kit: ContextMenu Component (Atom)
// Features standard rounded-[12px] corners, soft shadow, and unified font-medium labels

/**
 * The dropdown menu behind a ⋮ or any other trigger. Rendered in a portal, so a
 * row with `overflow: hidden` cannot cut it off.
 *
 * @param {React.ReactElement} props.trigger The element that opens the menu.
 * @param {{label: string, icon?, onClick?, isDivider?: boolean, isDanger?: boolean, color?: string, selected?: boolean, disabled?: boolean, disabledReason?: string}[]} props.items The rows; `selected` gives one a trailing tick instead of a "✓ " in its label.
 * @param {(open: boolean) => void} props.onOpenChange Fires when the menu opens or closes.
 * @param {boolean} props.closeOnSelect Whether a click closes it; toggle menus keep it open while ticking.
 * @param {string} props.dropdownClassName Placement of the panel only.
 * @param {string} props.className Placement of the trigger wrapper only.
 */
export default function ContextMenu({
  trigger, // React element that triggers the menu (e.g. Button)
  // Array of items: { label, icon, onClick, isDivider, isDanger, color, selected }
  // `selected` turns the row into a toggle: it stays open-menu styling but gets
  // a trailing checkmark instead of callers prefixing "✓ " into the label.
  items = [],
  className = '',
  dropdownClassName = '',
  onOpenChange, // Callback when open state changes
  closeOnSelect = true, // Toggle menus keep the panel open while ticking items
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
  useFloatingOverlayEscape({ open: isOpen, onClose: () => setIsOpen(false) });

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
            data-qt-floating-overlay
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
              const isToggle = item.selected !== undefined;

              return (
                <button
                  key={item.label || idx}
                  type="button"
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledReason : undefined}
                  role={isToggle ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={isToggle ? Boolean(item.selected) : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.disabled) return;
                    item.onClick?.(e);
                    if (closeOnSelect) setIsOpen(false);
                  }}
                  className={`w-full text-left px-[14px] py-[9px] text-[13px] flex items-center gap-[8px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    item.selected ? 'font-bold' : 'font-medium'
                  } ${
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
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {isToggle && (
                    <Check
                      size={14}
                      strokeWidth={3}
                      className={`shrink-0 transition-opacity ${
                        item.selected ? 'text-ink opacity-100' : 'opacity-0'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
      )}
    </div>
  );
}
