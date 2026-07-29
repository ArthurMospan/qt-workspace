'use client';
import React from 'react';

export default function Label({
  children,
  required = false,
  htmlFor,
  context = 'field',
  className = '',
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`${context === 'inline' ? 'ui-label-inline' : 'ui-label'} select-none ${className}`}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
