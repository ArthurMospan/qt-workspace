'use client';

export default function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  size = 'md', // sm, md, lg
  label,
  className = '',
}) {
  const sizeMap = {
    sm: { width: '44px', height: '24px', dotSize: '20px', translateX: '20px' },
    md: { width: '56px', height: '32px', dotSize: '28px', translateX: '24px' },
    lg: { width: '64px', height: '36px', dotSize: '32px', translateX: '28px' },
  };

  const size_config = sizeMap[size];

  const containerStyle = {
    width: size_config.width,
    height: size_config.height,
  };

  const dotStyle = {
    width: size_config.dotSize,
    height: size_config.dotSize,
    transform: checked ? `translateX(${size_config.translateX}px)` : 'translateX(2px)',
    transition: 'transform 200ms ease-in-out, background-color 200ms ease-in-out',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        style={containerStyle}
        className={`
          relative inline-flex flex-shrink-0 rounded-full border-2 border-transparent
          transition-colors
          ${checked ? 'bg-[#1f1f1f]' : 'bg-[#e9e9e9]'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          focus:outline-none focus:ring-2 focus:ring-[#1f1f1f] focus:ring-offset-1
        `}
      >
        <div
          style={dotStyle}
          className="absolute top-[2px] left-[2px] bg-white rounded-full shadow-sm"
        />
      </button>
      {label && (
        <span className={`text-[13px] font-semibold text-[#1f1f1f] select-none ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </div>
  );
}
