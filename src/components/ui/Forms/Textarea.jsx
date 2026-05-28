'use client';
import React, { forwardRef } from 'react';

export const Textarea = forwardRef(({
  className = '',
  placeholder,
  error,
  rows = 4,
  maxRows,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        className={`
          w-full bg-[#f7f7f7] border border-transparent rounded-[12px]
          text-[13px] text-[#1f1f1f] focus:border-[#1f1f1f] outline-none
          transition-colors placeholder:text-[#cfcfcf] resize-none
          px-[12px] py-[10px]
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-[11px] text-red-500 mt-1 block px-1">{error}</span>}
    </div>
  );
});
Textarea.displayName = 'Textarea';
