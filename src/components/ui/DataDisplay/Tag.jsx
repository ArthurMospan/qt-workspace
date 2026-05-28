'use client';
import { X } from 'lucide-react';

export default function Tag({
  label,
  onRemove,
  variant = 'default',
  className = '',
}) {
  const variants = {
    default: 'bg-[#efefef] text-[#1f1f1f]',
    success: 'bg-[#ecfdf5] text-[#10b981]',
    warning: 'bg-[#fefce8] text-[#eab308]',
    danger: 'bg-[#fef2f2] text-[#ef4444]',
    error: 'bg-[#fff7ed] text-[#f97316]',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold ${variants[variant]} ${className}`}>
      <span>{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity p-0.5"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
