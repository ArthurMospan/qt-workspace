'use client';

export default function Badge({
  children,
  variant = 'default', // default, success, warning, danger, error, info
  size = 'md', // sm, md, lg
  className = '',
}) {
  const variants = {
    default: 'bg-[#1f1f1f]/5 text-[#404040]',
    success: 'bg-[#10b981]/8 text-[#047857]',
    warning: 'bg-[#fbbf24]/8 text-[#b45309]',
    danger: 'bg-[#ef4444]/8 text-[#b91c1c]',
    error: 'bg-[#f97316]/8 text-[#c2410c]',
    info: 'bg-[#6366f1]/8 text-[#4338ca]',
  };

  const sizes = {
    sm: 'px-[8px] py-[2px] rounded-[6px] text-[9px] font-medium',
    md: 'px-[10px] py-[3px] rounded-[6px] text-[11px] font-medium',
    lg: 'px-[12px] py-[4px] rounded-[8px] text-[12px] font-medium',
  };

  return (
    <span className={`inline-flex items-center backdrop-blur-[2px] ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
