import React, { forwardRef } from 'react';

const INPUT_SIZES = {
  sm: 'text-[12px]',
  md: 'text-[13px]',
  lg: 'text-[13px]',
};

// QUI-133. `money` used to be right-aligned bold text plus a fixed 54px gutter
// and nothing else: it reserved room for a currency suffix the component never
// drew. Each call site drew its own absolutely-positioned span instead — at
// 10px in one place and 9px in another, at two different offsets — and the
// catalogue drew none at all, which is why the preview looked like a bare
// number floating in an empty field. The suffix belongs to the preset that
// reserves space for it, sized from the text rather than from one guess.
const INPUT_PRESETS = {
  money: 'text-right font-bold tabular-nums',
};

export const Input = forwardRef(({
  className = '',
  icon: Icon,
  error,
  size = 'lg',
  preset,
  composition,
  // Short trailing unit — a currency, `₴/г`, `%`. Rendered inside the control
  // and given real room, so the value can never slide under it.
  suffix,
  ...props
}, ref) => {
  const sizeClass = INPUT_SIZES[size] ?? INPUT_SIZES.lg;
  const suffixText = suffix ? String(suffix) : '';
  // Room for the label plus the padding either side of it, from its own length
  // rather than one hardcoded number that only ever fitted one caller.
  const suffixPadding = suffixText ? 18 + suffixText.length * 6 : 0;

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
        style={suffixText ? { paddingRight: `${suffixPadding}px` } : undefined}
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
      {suffixText && (
        <span className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">
          {suffixText}
        </span>
      )}
    </div>
  );
});
Input.displayName = 'Input';
