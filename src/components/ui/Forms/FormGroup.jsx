'use client';
import React from 'react';
import Label from './Label';

export default function FormGroup({
  children,
  label,
  error,
  required = false,
  gap = 'sm',
  className = '',
}) {
  const gapClass = gap === 'md' ? 'gap-[8px]' : 'gap-[6px]';

  return (
    <div className={`flex flex-col ${gapClass} ${className}`}>
      {label && (
        <Label required={required}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <span className="text-[11px] text-red-500 mt-[2px] block">{error}</span>
      )}
    </div>
  );
}
