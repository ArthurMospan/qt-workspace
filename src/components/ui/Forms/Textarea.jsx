'use client';
import React, { forwardRef } from 'react';

export const Textarea = forwardRef(({
  className = '',
  placeholder,
  error,
  rows = 4,
  maxRows,
  composition,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        data-ui-composition={composition}
        className={`
          ui-textarea w-full bg-canvas border border-transparent rounded-[10px]
          text-[13px] text-ink focus:border-ink outline-none
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
