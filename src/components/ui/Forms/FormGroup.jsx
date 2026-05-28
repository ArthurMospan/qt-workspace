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
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <Label required={required} error={error}>
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}
