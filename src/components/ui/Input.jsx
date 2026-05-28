import React, { forwardRef } from 'react';
// UI Kit Input Component
// Strict rule enforced: All inputs are 36px height (h-9)
// Matches button heights for perfect alignment in forms

export const Input = forwardRef(({
  className = '',
  icon: Icon,
  error,
  ...props
}, ref) => {
  return (
    <div className="relative w-full">
      {Icon && (
        <Icon
          size={14}
          className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#9a9a9a]"
        />
      )}
      <input
        ref={ref}
        className={`
          h-[36px] w-full bg-[#f7f7f7] border border-transparent rounded-[12px]
          text-[13px] text-[#1f1f1f] focus:border-[#1f1f1f] outline-none
          transition-colors placeholder:text-[#cfcfcf] flex items-center
          ${Icon ? 'pl-[36px]' : 'pl-[12px]'} pr-[12px]
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-[11px] text-red-500 mt-1 block px-1">{error}</span>}
    </div>
  );
});
Input.displayName = 'Input';
