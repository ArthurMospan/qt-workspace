'use client';
import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

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
