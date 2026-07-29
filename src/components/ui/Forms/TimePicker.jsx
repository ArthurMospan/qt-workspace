'use client';
import React, { forwardRef } from 'react';
import { Clock } from 'lucide-react';

export const TimePicker = forwardRef(({
  value = '',
  onChange,
  error,
  disabled = false,
  className = '',
  size = 'lg',
  ...props
}, ref) => {
  return (
    <div className={`relative w-full ${className}`}>
      <Clock
        size={14}
        className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
      <input
        ref={ref}
        type="time"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        data-ui-size={size}
        className={`
          ui-control w-full bg-canvas border border-transparent rounded-[10px]
          text-[13px] text-ink focus:border-ink outline-none
          transition-colors placeholder:text-[#a3a3a3] flex items-center
          pl-[36px] pr-[12px]
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
        `}
        {...props}
      />
    </div>
  );
});
TimePicker.displayName = 'TimePicker';
