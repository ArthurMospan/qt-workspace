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
    <div className={`relative flex items-center border-b border-transparent focus-within:border-[#1f1f1f] w-full max-w-[320px] h-[36px] transition-colors ${className}`}>
      <Search size={14} className="text-[#9a9a9a] absolute left-0 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full h-full bg-transparent text-[13px] text-[#1f1f1f] placeholder:text-[#a3a3a3] outline-none pl-[24px] pr-[30px]"
        {...props}
      />
      {value && (
        <button 
          onClick={() => {
            onChange?.('');
            onClear?.();
          }} 
          className="absolute right-[10px] text-[#cfcfcf] hover:text-[#9a9a9a] transition-colors p-1"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
});

HeaderSearch.displayName = 'HeaderSearch';
export default HeaderSearch;
