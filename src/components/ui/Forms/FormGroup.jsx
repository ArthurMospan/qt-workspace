'use client';
import React from 'react';
import Label from './Label';

export default function FormGroup({
  children,
  label,
  error,
  required = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-[6px] ${className}`}>
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
