'use client';

export default function Progress({
  value = 0, // 0-100
  variant = 'default', // default, success, warning, danger
  size = 'md', // sm, md, lg
  showLabel = false,
  className = '',
}) {
  const variants = {
    default: 'bg-ink',
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
      <div className={`w-full bg-line rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`h-full ${variants[variant]} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && <p className="text-[12px] text-muted mt-1">{percent}%</p>}
    </div>
  );
}
