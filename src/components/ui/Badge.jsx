import React from 'react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-[#efefef] text-[#9a9a9a]',
    primary: 'bg-[#1f1f1f] text-white',
    success: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border border-amber-100',
    danger: 'bg-red-50 text-red-600 border border-red-100'
  };
  
  const vClass = variants[variant] || variants.default;
  
  return (
    <span className={`inline-flex items-center px-[8px] py-[2px] rounded-[6px] text-[11px] font-bold tracking-wide uppercase ${vClass} ${className}`}>
      {children}
    </span>
  );
}
