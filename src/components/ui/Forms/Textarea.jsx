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
          w-full bg-[#f4f4f5] border border-transparent rounded-[10px]
          text-[13px] text-[#1f1f1f] focus:border-[#1f1f1f] outline-none
          transition-colors placeholder:text-[#a3a3a3] resize-none
          disabled:opacity-50 disabled:cursor-not-allowed
          px-[12px] py-[10px]
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
          ${className}
        `}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = 'Textarea';
