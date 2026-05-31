'use client';
import React from 'react';
import { Check } from 'lucide-react';

export default function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  size = 'md', // sm, md, lg
  label,
  error,
  id,
  className = '',
}) {
  const sizeMap = {
    sm: { box: 'w-4 h-4 rounded-[4px]', icon: 10 },
    md: { box: 'w-[18px] h-[18px] rounded-[5px]', icon: 12 },
    lg: { box: 'w-5 h-5 rounded-[6px]', icon: 14 },
  };

  const { box, icon } = sizeMap[size];
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex items-center">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={(e) => !disabled && onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          onClick={() => !disabled && onChange?.(!checked)}
          className={`
            ${box} flex items-center justify-center shrink-0
            bg-white border-2 border-[#e9e9e9] transition-all cursor-pointer
            peer-checked:bg-[#1f1f1f] peer-checked:border-[#1f1f1f]
            peer-focus-visible:ring-2 peer-focus-visible:ring-[#1f1f1f]/20 peer-focus-visible:ring-offset-0
            hover:border-[#d1d5db]
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'border-red-500' : ''}
          `}
        >
          {checked && <Check size={icon} className="text-white" />}
        </div>
      </div>

      {label && (
        <label
          htmlFor={checkboxId}
          className={`text-[13px] font-semibold text-[#1f1f1f] select-none cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {label}
        </label>
      )}

      {error && <span className="text-[11px] text-red-500 ml-1">{error}</span>}
    </div>
  );
}
