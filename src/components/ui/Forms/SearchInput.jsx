'use client';
import React, { forwardRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export const SearchInput = forwardRef(({
  value = '',
  onChange,
  onClear,
  placeholder = 'Пошук...',
  error,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={`relative w-full ${className}`}>
      <Search
        size={14}
        className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#9a9a9a]"
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`
          h-[36px] w-full bg-[#f4f4f5] border border-transparent rounded-[10px]
          text-[13px] text-[#1f1f1f] focus:border-[#1f1f1f] outline-none
          transition-colors placeholder:text-[#a3a3a3] flex items-center
          disabled:opacity-50 disabled:cursor-not-allowed
          pl-[36px] pr-[36px]
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
        `}
        {...props}
      />
      {value && (
        <button
          onClick={() => {
            onChange?.('');
            onClear?.();
          }}
          className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#9a9a9a] hover:text-[#1f1f1f] p-1"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});
SearchInput.displayName = 'SearchInput';
