'use client';
import React from 'react';

// A required field is announced in words on the right instead of a red
// asterisk: the asterisk carried no meaning for anyone who had not learned the
// convention, and it read as an error state on an untouched form.
export default function Label({
  children,
  required = false,
  requiredHint = 'обов’язково',
  htmlFor,
  context = 'field',
  className = '',
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`${context === 'inline' ? 'ui-label-inline' : 'ui-label'} flex select-none items-center gap-2 ${className}`}
    >
      <span className="min-w-0">{children}</span>
      {required && (
        <span className="ml-auto shrink-0 text-[10px] font-medium normal-case tracking-normal text-faint">
          {requiredHint}
        </span>
      )}
    </label>
  );
}
