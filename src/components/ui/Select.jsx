'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

// UI Kit Select Component
// Strict rule enforced: Select buttons are 36px height (h-9)
// Matches input and button heights for consistent form alignment

function useDropdownPosition(isOpen, triggerRef, dropdownRef, gap = 4) {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    visible: false,
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
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
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      );

      setPosition({ top, left, width, visible: true });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
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
  buttonClassName = 'bg-canvas hover:bg-[#ebebeb] rounded-[10px] px-[12px] h-[36px]',
  dropdownClassName = '',
  disabled = false,
  variant = 'default',
  triggerIcon: TriggerIcon,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownPosition = useDropdownPosition(isOpen, containerRef, dropdownRef);

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

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-ink transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'ghost' ? 'bg-transparent hover:bg-[#ebebeb] rounded-[8px] px-[10px] h-[28px] w-auto inline-flex gap-1.5' : buttonClassName}`}
      >
        <div className={`flex items-center overflow-hidden ${compact ? 'gap-1' : 'gap-[8px]'}`}>
          {TriggerIcon && <TriggerIcon size={14} className="text-muted shrink-0" />}
          {selectedOption?.dotColor && (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedOption.dotColor }} />
          )}
          {selectedOption?.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedOption.avatar} alt="" className="w-[14px] h-[14px] rounded-full object-cover shrink-0" />
          )}
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
          className={`fixed z-[300] max-w-[calc(100vw-16px)] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-[6px] overflow-hidden ${dropdownClassName}`}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            visibility: dropdownPosition.visible ? 'visible' : 'hidden',
          }}
        >
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-[12px] h-[36px] text-[13px] hover:bg-canvas transition-colors text-left ${value === opt.value ? 'bg-canvas font-bold' : 'font-medium'}`}
              >
                <div className="flex items-center gap-[8px]">
                  {opt.dotColor && (
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
                  )}
                  {opt.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.avatar} alt="" className="w-[14px] h-[14px] rounded-full object-cover shrink-0" />
                  )}
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
  dropdownClassName = '',
  disabled = false,
  variant = 'default',
  triggerIcon: TriggerIcon,
  selectAllLabel = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownPosition = useDropdownPosition(isOpen, containerRef, dropdownRef);

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

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const allValues = options.map(option => option.value);
  const allSelected = allValues.length > 0 && allValues.every(optionValue => value.includes(optionValue));

  const handleSelect = (val) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const selectedLabels = options
    .filter(o => value.includes(o.value))
    .map(o => o.label);

  let triggerText = placeholder;
  if (value.length === 1) triggerText = selectedLabels[0];
  else if (value.length > 1) triggerText = `Обрано (${value.length})`;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-ink transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'ghost' ? 'bg-transparent hover:bg-[#ebebeb] rounded-[8px] px-[10px] h-[28px] w-auto inline-flex gap-1.5' : 'bg-canvas hover:bg-[#ebebeb] rounded-[10px] px-[12px] h-[36px]'}`}
      >
        <div className="flex items-center gap-[8px] overflow-hidden">
          {TriggerIcon && <TriggerIcon size={14} className="text-muted shrink-0" />}
          <span className="text-[13px] truncate font-medium text-ink">
            {triggerText}
          </span>
        </div>
        <ChevronDown size={14} className={`text-muted shrink-0 ml-[8px] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className={`fixed z-[300] max-w-[calc(100vw-16px)] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col ${dropdownClassName}`}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
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
                    {opt.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.avatar} alt="" className="w-[14px] h-[14px] rounded-full object-cover shrink-0" />
                    )}
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
