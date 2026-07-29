import React, { forwardRef } from 'react';

const INPUT_SIZES = {
  sm: 'text-[12px]',
  md: 'text-[13px]',
  lg: 'text-[13px]',
};
const INPUT_PRESETS = {
  money: '!pr-[54px] text-right font-bold',
};

export const Input = forwardRef(({
  className = '',
  icon: Icon,
  error,
  size = 'lg',
  preset,
  composition,
  ...props
}, ref) => {
  const sizeClass = INPUT_SIZES[size] ?? INPUT_SIZES.lg;

  return (
    <div className="relative w-full">
      {Icon && (
        <Icon
          size={14}
          className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted"
        />
      )}
      <input
        ref={ref}
        data-ui-size={size}
        data-ui-composition={composition}
        className={`
          ui-control ${sizeClass} w-full bg-canvas border border-transparent
          text-ink focus:border-ink outline-none
          transition-colors placeholder:text-[#a3a3a3] flex items-center
          disabled:opacity-50 disabled:cursor-not-allowed
          ${Icon ? 'pl-[36px]' : 'pl-[12px]'} pr-[12px]
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
          ${INPUT_PRESETS[preset] || ''}
          ${className}
        `}
        {...props}
      />
    </div>
  );
});
Input.displayName = 'Input';
