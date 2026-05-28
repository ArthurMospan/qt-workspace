'use client';

export default function Badge({
  children,
  variant = 'default', // default, success, warning, danger, error, info
  size = 'md', // sm, md, lg
  className = '',
}) {
  const variants = {
    default: 'bg-[#efefef] text-[#1f1f1f]',
    success: 'bg-[#ecfdf5] text-[#10b981]',
    warning: 'bg-[#fefce8] text-[#eab308]',
    danger: 'bg-[#fef2f2] text-[#ef4444]',
    error: 'bg-[#fff7ed] text-[#f97316]',
    info: 'bg-[#eef2ff] text-[#6366f1]',
  };

  const sizes = {
    sm: 'px-[8px] py-[2px] rounded-[5px] text-[9px] font-bold',
    md: 'px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold',
    lg: 'px-[12px] py-[4px] rounded-[8px] text-[12px] font-bold',
  };

  return (
    <span className={`inline-flex items-center ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
