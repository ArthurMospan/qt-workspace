import React from 'react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-[#1f1f1f]/5 border border-[#1f1f1f]/10 text-[#404040]',
    primary: 'bg-[#1f1f1f]/10 border border-[#1f1f1f]/20 text-[#1f1f1f]',
    success: 'bg-[#10b981]/8 border border-[#10b981]/15 text-[#047857]',
    warning: 'bg-[#fbbf24]/8 border border-[#fbbf24]/15 text-[#b45309]',
    danger: 'bg-[#ef4444]/8 border border-[#ef4444]/15 text-[#b91c1c]',
    error: 'bg-[#f97316]/8 border border-[#f97316]/15 text-[#c2410c]',
    info: 'bg-[#6366f1]/8 border border-[#6366f1]/15 text-[#4338ca]',
  };
  
  const vClass = variants[variant] || variants.default;
  
  return (
    <span className={`inline-flex items-center px-[8px] py-[2px] rounded-[6px] text-[11px] font-bold tracking-wide uppercase backdrop-blur-[2px] ${vClass} ${className}`}>
      {children}
    </span>
  );
}
