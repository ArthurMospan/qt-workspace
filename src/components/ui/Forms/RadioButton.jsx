'use client';

export default function RadioButton({
  options = [],
  value,
  onChange,
  disabled = false,
  size = 'md', // sm, md, lg
  name,
  className = '',
  layout = 'vertical', // vertical, horizontal
}) {
  const sizeMap = {
    sm: { box: 'w-4 h-4', label: 'text-[12px]' },
    md: { box: 'w-[18px] h-[18px]', label: 'text-[13px]' },
    lg: { box: 'w-5 h-5', label: 'text-[14px]' },
  };

  const { box, label: labelClass } = sizeMap[size];
  const containerClass = layout === 'horizontal' ? 'flex gap-4' : 'flex flex-col gap-2';

  return (
    <div className={`${containerClass} ${className}`}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex items-center gap-2 cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => !disabled && onChange?.(option.value)}
            disabled={disabled}
            className={`${box} cursor-pointer accent-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#1f1f1f] focus:ring-offset-1`}
          />
          <span className={`font-semibold text-[#1f1f1f] ${labelClass}`}>
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
