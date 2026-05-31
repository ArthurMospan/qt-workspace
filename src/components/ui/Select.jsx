'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

// UI Kit Select Component
// Strict rule enforced: Select buttons are 36px height (h-9)
// Matches input and button heights for consistent form alignment

// Single Select Component
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Оберіть...',
  className = '',
  buttonClassName = 'bg-[#f4f4f5] hover:bg-[#ebebeb] rounded-[10px] px-[12px] h-[36px]',
  dropdownClassName = '',
  disabled = false,
  variant = 'default',
  triggerIcon: TriggerIcon
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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
        className={`w-full flex items-center justify-between text-[#1f1f1f] transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'ghost' ? 'bg-transparent hover:bg-[#ebebeb] rounded-[8px] px-[10px] h-[28px] w-auto inline-flex gap-1.5' : buttonClassName}`}
      >
        <div className="flex items-center gap-[8px] overflow-hidden">
          {TriggerIcon && <TriggerIcon size={14} className="text-[#9a9a9a] shrink-0" />}
          {selectedOption?.dotColor && (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedOption.dotColor }} />
          )}
          {selectedOption?.icon && (
            <selectedOption.icon size={14} className="text-[#9a9a9a] shrink-0" />
          )}
          <span className="text-[13px] truncate text-[#1f1f1f] font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={14} className={`text-[#9a9a9a] shrink-0 ml-[8px] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-50 top-full mt-[4px] min-w-full w-max max-w-[300px] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] py-[6px] overflow-hidden ${dropdownClassName}`}>
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-[12px] h-[36px] text-[13px] hover:bg-[#f4f4f5] transition-colors text-left ${value === opt.value ? 'bg-[#f4f4f5] font-bold' : 'font-medium'}`}
              >
                <div className="flex items-center gap-[8px]">
                  {opt.dotColor && (
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
                  )}
                  {opt.icon && (
                    <opt.icon size={14} className={value === opt.value ? 'text-[#1f1f1f]' : 'text-[#9a9a9a]'} />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {value === opt.value && <Check size={14} className="text-[#1f1f1f] shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
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
  triggerIcon: TriggerIcon
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch(''); // clear search on close
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

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
        className={`w-full flex items-center justify-between text-[#1f1f1f] transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'ghost' ? 'bg-transparent hover:bg-[#ebebeb] rounded-[8px] px-[10px] h-[28px] w-auto inline-flex gap-1.5' : 'bg-[#f4f4f5] hover:bg-[#ebebeb] rounded-[10px] px-[12px] h-[36px]'}`}
      >
        <div className="flex items-center gap-[8px] overflow-hidden">
          {TriggerIcon && <TriggerIcon size={14} className="text-[#9a9a9a] shrink-0" />}
          <span className="text-[13px] truncate font-medium text-[#1f1f1f]">
            {triggerText}
          </span>
        </div>
        <ChevronDown size={14} className={`text-[#9a9a9a] shrink-0 ml-[8px] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-50 top-full mt-[4px] min-w-full w-max max-w-[320px] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${dropdownClassName}`}>
          <div className="p-[8px] border-b border-[#f0f0f0] shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
              <input 
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#f4f4f5] text-[13px] font-medium text-[#1f1f1f] rounded-[8px] pl-[32px] pr-[10px] py-[6px] outline-none border border-transparent focus:border-[#e9e9e9]"
              />
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-[6px]">
            {filteredOptions.length === 0 ? (
              <div className="px-[12px] py-[16px] text-center text-[12px] font-medium text-[#9a9a9a]">
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
                    className="w-full flex items-center gap-[10px] px-[8px] h-[32px] rounded-[8px] hover:bg-[#f4f4f5] transition-colors text-left"
                  >
                    <div className={`w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-[#1f1f1f] border-[#1f1f1f]' : 'border-[#d9d9d9] bg-white'}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    {opt.dotColor && (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
                    )}
                    {opt.icon && (
                      <opt.icon size={14} className={isSelected ? 'text-[#1f1f1f]' : 'text-[#9a9a9a]'} />
                    )}
                    <span className={`text-[13px] truncate ${isSelected ? 'font-bold text-[#1f1f1f]' : 'font-medium text-[#1f1f1f]'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
