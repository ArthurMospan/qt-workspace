'use client';
import React from 'react';

export default function Label({
  children,
  required = false,
  error,
  htmlFor,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-bold text-[#1f1f1f]"
      >
        {children}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {error && (
        <span className="text-[11px] text-red-500">{error}</span>
      )}
    </div>
  );
}
