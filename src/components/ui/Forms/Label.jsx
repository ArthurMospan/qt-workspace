'use client';
import React from 'react';

export default function Label({
  children,
  required = false,
  htmlFor,
  className = '',
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-[11px] font-bold text-[#666666] uppercase tracking-wider select-none ${className}`}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
