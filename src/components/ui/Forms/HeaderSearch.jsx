'use client';
import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * The search field inside the workspace header. Reached through `TopHeader`,
 * which is the only thing that renders it — it is not a general search input.
 *
 * @param {string} props.value Current query.
 * @param {(value: string) => void} props.onChange Fires with the new query.
 * @param {() => void} props.onClear Clears the field; renders the × while there is text.
 * @param {string} props.placeholder Placeholder text.
 * @param {string} props.className Placement in the parent only.
 */
export const HeaderSearch = forwardRef(({
  value = '',
  onChange,
  onClear,
  placeholder = 'Пошук...',
  className = '',
  ...props
}, ref) => {
  return (
    <div className={`relative flex items-center border-b border-transparent focus-within:border-line w-full max-w-[320px] h-[36px] transition-colors ${className}`}>
      <Search size={14} className="text-muted absolute left-0 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full h-full bg-transparent text-[13px] text-ink placeholder:text-[#a3a3a3] outline-none pl-[24px] pr-[30px]"
        {...props}
      />
      {value && (
        <button
          onClick={() => {
            onChange?.('');
            onClear?.();
          }}
          aria-label="Очистити пошук"
          className="absolute right-[10px] text-faint hover:text-muted transition-colors p-1"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
});

HeaderSearch.displayName = 'HeaderSearch';
export default HeaderSearch;
