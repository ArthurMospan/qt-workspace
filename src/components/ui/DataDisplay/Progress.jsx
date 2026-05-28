'use client';

export default function Progress({
  value = 0, // 0-100
  variant = 'default', // default, success, warning, danger
  size = 'md', // sm, md, lg
  showLabel = false,
  className = '',
}) {
  const variants = {
    default: 'bg-[#6366f1]',
    success: 'bg-[#10b981]',
    warning: 'bg-[#eab308]',
    danger: 'bg-[#ef4444]',
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  const percent = Math.min(Math.max(value, 0), 100);

  return (
    <div className={className}>
      <div className={`w-full bg-[#e9e9e9] rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`h-full ${variants[variant]} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && <p className="text-[12px] text-[#9a9a9a] mt-1">{percent}%</p>}
    </div>
  );
}
