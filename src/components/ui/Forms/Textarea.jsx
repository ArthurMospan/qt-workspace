'use client';
import React, { forwardRef } from 'react';

/**
 * Multi-line text field. Like `Input`, anything not named here — `value`,
 * `disabled`, `onChange` — reaches the native textarea through the rest spread.
 *
 * @param {boolean|string} props.error Draws the error border; the message itself belongs to `FormGroup`.
 * @param {string} props.placeholder Placeholder text.
 * @param {number} props.rows Initial visible rows.
 * @param {number} props.maxRows Ceiling for auto-growth, where the caller grows it.
 * @param {string} props.composition Named size contract for a specific place, resolved in globals.css.
 * @param {string} props.className Placement in the parent only.
 */
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
