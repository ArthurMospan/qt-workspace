'use client';
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
    sm: { box: 'w-4 h-4 rounded-[4px]', icon: 12 },
    md: { box: 'w-[18px] h-[18px] rounded-[5px]', icon: 14 },
    lg: { box: 'w-5 h-5 rounded-[6px]', icon: 16 },
  };

  const { box, icon } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="checkbox"
        id={id}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`
          ${box} flex items-center justify-center shrink-0
          bg-white border-2 border-[#e9e9e9] transition-all
          ${
            checked
              ? 'bg-[#1f1f1f] border-[#1f1f1f]'
              : 'hover:border-[#d1d5db]'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-[#1f1f1f] focus:ring-offset-1
          ${error ? 'border-red-500' : ''}
        `}
      >
        {checked && <Check size={icon} className="text-white" />}
      </button>

      {label && (
        <label
          htmlFor={id}
          className={`text-[13px] font-semibold text-[#1f1f1f] cursor-pointer ${
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
