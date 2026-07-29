'use client';
import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Flag,
  Folder,
  Search,
  Shapes,
  Users,
  Zap,
} from 'lucide-react';
import { getFilterControlWidth } from './FilterBar';
import UserAvatar from './DataDisplay/UserAvatar';

// UI Kit Select Component
// Named form-control sizes match Input and Button.
const CONTROL_SIZES = {
  sm: 'text-[12px]',
  md: 'text-[13px]',
  lg: 'text-[13px]',
};

// The trigger width is a floor for the dropdown, never a cap. Matching it
// exactly turned every compact inline control into an unreadable column — the
// issue attribute selects are ~110px wide, so a member list rendered there had
// nowhere to put a full name. The panel now sizes to its content between these
// two bounds, which only ever makes a dropdown wider than it was.
const DROPDOWN_MIN_WIDTH = 200;
const DROPDOWN_MAX_WIDTH = 360;
const FILTER_ROLE_ICONS = {
  type: Shapes,
  priority: Flag,
  sprint: Zap,
  status: CircleDot,
  date: CalendarDays,
  member: Users,
  project: Folder,
  sort: ArrowUpDown,
};

function OptionIdentity({ option, size = 14 }) {
  if (!option?.user && !option?.avatar) return null;
  return (
    <span aria-hidden="true" className="shrink-0">
      <UserAvatar
        user={option.user || { name: option.label, avatar: option.avatar }}
        size={size}
      />
    </span>
  );
}

function useDropdownPosition(isOpen, triggerRef, dropdownRef, gap = 4) {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    minWidth: 0,
    maxWidth: DROPDOWN_MAX_WIDTH,
    visible: false,
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const roomForPanel = window.innerWidth - viewportPadding * 2;
      const maxWidth = Math.min(DROPDOWN_MAX_WIDTH, roomForPanel);
      const minWidth = Math.min(Math.max(rect.width, DROPDOWN_MIN_WIDTH), roomForPanel);
      // Clamping `left` needs the width the panel actually took, which only the
      // laid-out element knows once `max-content` has resolved.
      const renderedWidth = Math.min(
        Math.max(dropdownRef.current?.offsetWidth || 0, minWidth),
        roomForPanel,
      );
      const dropdownHeight = dropdownRef.current?.offsetHeight || 280;
      const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
      const roomAbove = rect.top - viewportPadding;
      const showAbove = roomBelow < dropdownHeight && roomAbove > roomBelow;
      const top = showAbove
        ? Math.max(viewportPadding, rect.top - dropdownHeight - gap)
        : Math.max(
          viewportPadding,
          Math.min(rect.bottom + gap, window.innerHeight - dropdownHeight - viewportPadding),
        );
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - renderedWidth - viewportPadding),
      );

      setPosition({ top, left, minWidth, maxWidth, visible: true });
    };

    // Twice: the first pass measures a panel that has not been given its
    // min-width yet, so its width — and with it the `left` clamp near the right
    // edge of the viewport — is only final on the second.
    updatePosition();
    const settle = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(settle);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dropdownRef, gap, isOpen, triggerRef]);

  return position;
}

// Single Select Component
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Оберіть...',
  className = '',
  buttonClassName,
  dropdownClassName = '',
  disabled = false,
  variant = 'default',
  triggerIcon: TriggerIcon,
  compact = false,
  size = 'lg',
  composition,
  filterRole,
  filterContext = 'default',
  ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxId = useId();
  const dropdownPosition = useDropdownPosition(isOpen, containerRef, dropdownRef);
  const filterWidth = getFilterControlWidth(filterRole, filterContext);
  const defaultButtonClass = `bg-canvas hover:bg-[#ebebeb] px-[12px] ${CONTROL_SIZES[size] ?? CONTROL_SIZES.lg}`;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !dropdownRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const selectedIndex = options.findIndex(o => o.value === value);
  const ResolvedTriggerIcon = TriggerIcon
    || (selectedOption?.icon ? null : FILTER_ROLE_ICONS[filterRole]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    dropdownRef.current
      ?.querySelector(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const open = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    setActiveIndex(options.length ? Math.max(0, Math.min(index, options.length - 1)) : -1);
    setIsOpen(true);
  };
  const close = ({ focusTrigger = true } = {}) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const commit = index => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  };

  // Full keyboard support: the control is the primary form input across the
  // whole app and previously could not be operated without a mouse at all.
  const handleKeyDown = event => {
    if (disabled) return;
    const { key } = event;
    if (!isOpen) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        open();
      }
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      close();
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(current => Math.min(current + 1, options.length - 1));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(current => Math.max(current - 1, 0));
    } else if (key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      commit(activeIndex);
    } else if (key === 'Tab') {
      close({ focusTrigger: false });
    }
  };

  return (
    <div className={`relative ${filterWidth} ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        data-ui-size={variant === 'ghost' ? 'sm' : size}
        data-ui-composition={composition}
        onKeyDown={handleKeyDown}
        onClick={() => (isOpen ? close({ focusTrigger: false }) : open())}
        className={`ui-control w-full flex items-center justify-between text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'ghost' ? `bg-transparent hover:bg-[#ebebeb] !rounded-[8px] px-[10px] ${filterWidth ? 'w-full' : 'w-auto'} inline-flex gap-1.5` : (buttonClassName || defaultButtonClass)}`}
      >
        <div className={`flex items-center overflow-hidden ${compact ? 'gap-1' : 'gap-[8px]'}`}>
          {ResolvedTriggerIcon && <ResolvedTriggerIcon size={14} className="text-muted shrink-0" />}
          {selectedOption?.dotColor && (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedOption.dotColor }} />
          )}
          <OptionIdentity option={selectedOption} />
          {selectedOption?.icon && (
            <selectedOption.icon size={14} className="text-muted shrink-0" />
          )}
          <span
            className={`truncate font-medium ${selectedOption?.badgeColor ? 'rounded-[4px] px-[6px] py-[1.5px] text-[10px]' : 'text-[13px] text-ink'}`}
            style={selectedOption?.badgeColor ? {
              color: selectedOption.badgeColor,
              backgroundColor: `${selectedOption.badgeColor}14`,
            } : undefined}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={compact ? 12 : 14} className={`text-muted shrink-0 transition-transform ${compact ? 'ml-1' : 'ml-[8px]'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          data-qt-floating-overlay
          className={`fixed z-[1100] max-w-[calc(100vw-16px)] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-[6px] overflow-hidden ${dropdownClassName}`}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: 'max-content',
            minWidth: dropdownPosition.minWidth,
            maxWidth: dropdownPosition.maxWidth,
            visibility: dropdownPosition.visible ? 'visible' : 'hidden',
          }}
        >
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar" role="listbox" id={listboxId}>
            {options.map((opt, index) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                data-option-index={index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
                className={`w-full flex items-center justify-between px-[12px] h-[36px] text-[13px] transition-colors text-left ${index === activeIndex ? 'bg-canvas' : ''} ${value === opt.value ? 'bg-canvas font-bold' : 'font-medium'}`}
              >
                <div className="flex items-center gap-[8px]">
                  {opt.dotColor && (
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
                  )}
                  <OptionIdentity option={opt} />
                  {opt.icon && (
                    <opt.icon size={14} className={value === opt.value ? 'text-ink' : 'text-muted'} />
                  )}
                  <span
                    className={`truncate ${opt.badgeColor ? 'rounded-[4px] px-[6px] py-[1.5px] text-[10px] font-medium' : ''}`}
                    style={opt.badgeColor ? {
                      color: opt.badgeColor,
                      backgroundColor: `${opt.badgeColor}14`,
                    } : undefined}
                  >
                    {opt.label}
                  </span>
                </div>
                {value === opt.value && <Check size={14} className="text-ink shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// Multi Select Component with Search
export function MultiSelect({
  value = [], // array of selected values
  onChange,
  options = [], // { value, label, icon?, dotColor? }
  placeholder = 'Оберіть...',
  searchPlaceholder = 'Пошук...',
  className = '',
  buttonClassName,
  dropdownClassName = '',
  disabled = false,
  variant = 'default',
  triggerIcon: TriggerIcon,
  selectAllLabel = '',
  size = 'lg',
  composition,
  filterRole,
  filterContext = 'default',
  compact = false,
  ariaLabel,
  // Renders the selected people as an overlapping avatar stack in the trigger
  // instead of "Обрано (N)". Task attributes need to read the assignees at a
  // glance, which a bare count cannot do.
  showSelectedAvatars = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownPosition = useDropdownPosition(isOpen, containerRef, dropdownRef);
  const filterWidth = getFilterControlWidth(filterRole, filterContext);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !dropdownRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setSearch(''); // clear search on close
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // String(...) guard: an option built from a record with a missing name used
  // to throw here and take the whole page down.
  const filteredOptions = options.filter(o =>
    String(o.label ?? '').toLowerCase().includes(search.toLowerCase()));
  const allValues = options.map(option => option.value);
  const allSelected = allValues.length > 0 && allValues.every(optionValue => value.includes(optionValue));

  const handleSelect = (val) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const selectedOptions = options.filter(o => value.includes(o.value));
  const selectedLabels = selectedOptions.map(o => o.label);
  const singleSelectedOption = value.length === 1 ? selectedOptions[0] : null;
  const avatarOptions = showSelectedAvatars
    ? selectedOptions.filter(option => option.user || option.avatar)
    : [];
  const ResolvedTriggerIcon = TriggerIcon || FILTER_ROLE_ICONS[filterRole];

  let triggerText = placeholder;
  if (value.length === 1) triggerText = selectedLabels[0];
  else if (value.length > 1) {
    triggerText = showSelectedAvatars
      ? `${selectedLabels[0]} +${value.length - 1}`
      : `Обрано (${value.length})`;
  }
  const defaultButtonClass = `bg-canvas hover:bg-[#ebebeb] px-[12px] ${CONTROL_SIZES[size] ?? CONTROL_SIZES.lg}`;

  return (
    <div className={`relative ${filterWidth} ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        data-ui-size={variant === 'ghost' ? 'sm' : size}
        data-ui-composition={composition}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onKeyDown={event => {
          if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            setIsOpen(false);
            setSearch('');
          }
        }}
        onClick={() => setIsOpen(!isOpen)}
        className={`ui-control w-full flex items-center justify-between text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'ghost' ? `bg-transparent hover:bg-[#ebebeb] !rounded-[8px] px-[10px] ${filterWidth ? 'w-full' : 'w-auto'} inline-flex gap-1.5` : (buttonClassName || defaultButtonClass)}`}
      >
        <div className={`flex items-center overflow-hidden ${compact ? 'gap-1' : 'gap-[8px]'}`}>
          {ResolvedTriggerIcon && <ResolvedTriggerIcon size={14} className="text-muted shrink-0" />}
          {avatarOptions.length > 1 ? (
            <span aria-hidden="true" className="flex shrink-0 items-center -space-x-1.5">
              {avatarOptions.slice(0, 3).map(option => (
                <span key={option.value} className="rounded-full ring-2 ring-white">
                  <UserAvatar user={option.user || { name: option.label, avatar: option.avatar }} size={16} />
                </span>
              ))}
            </span>
          ) : (
            <OptionIdentity option={showSelectedAvatars ? (avatarOptions[0] || singleSelectedOption) : singleSelectedOption} />
          )}
          <span className="text-[13px] truncate font-medium text-ink">
            {triggerText}
          </span>
        </div>
        <ChevronDown size={compact ? 12 : 14} className={`text-muted shrink-0 transition-transform ${compact ? 'ml-1' : 'ml-[8px]'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          data-qt-floating-overlay
          className={`fixed z-[1100] max-w-[calc(100vw-16px)] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col ${dropdownClassName}`}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: 'max-content',
            minWidth: dropdownPosition.minWidth,
            maxWidth: dropdownPosition.maxWidth,
            visibility: dropdownPosition.visible ? 'visible' : 'hidden',
          }}
        >
          <div className="p-[8px] border-b border-[#f0f0f0] shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  setIsOpen(false);
                  setSearch('');
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-canvas text-[13px] font-medium text-ink rounded-[8px] pl-[32px] pr-[10px] py-[6px] outline-none border border-transparent focus:border-line"
              />
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-[6px]">
            {selectAllLabel && options.length > 0 && (
              <button
                type="button"
                aria-pressed={allSelected}
                onClick={() => {
                  onChange(allSelected
                    ? value.filter(selectedValue => !allValues.includes(selectedValue))
                    : [...new Set([...value, ...allValues])]);
                }}
                className="mb-1 flex h-[34px] w-full items-center gap-[10px] rounded-[8px] border-b border-line px-[8px] text-left transition-colors hover:bg-canvas"
              >
                <div className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${allSelected ? 'border-ink bg-ink' : 'border-[#d9d9d9] bg-white'}`}>
                  {allSelected && <Check size={12} className="text-white" />}
                </div>
                <span className="truncate text-[13px] font-bold text-ink">{selectAllLabel}</span>
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-[12px] py-[16px] text-center text-[12px] font-medium text-muted">
                Нічого не знайдено
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className="w-full flex items-center gap-[10px] px-[8px] h-[32px] rounded-[8px] hover:bg-canvas transition-colors text-left"
                  >
                    <div className={`w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-ink border-ink' : 'border-[#d9d9d9] bg-white'}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    {opt.dotColor && (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
                    )}
                    <OptionIdentity option={opt} />
                    {opt.icon && (
                      <opt.icon size={14} className={isSelected ? 'text-ink' : 'text-muted'} />
                    )}
                    <span className={`text-[13px] truncate ${isSelected ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
