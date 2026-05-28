'use client';
import { colors } from '@/lib/design/tokens';

export default function ProgressRing({
  value = 0,
  size = 'md',
  variant = 'default',
  showLabel = true,
  className = ''
}) {
  const sizeMap = { sm: 64, md: 96, lg: 128 };
  const diameter = sizeMap[size] || sizeMap.md;
  const radius = (diameter - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  const variantMap = {
    default: '#3b82f6',
    success: colors.status.success,
    warning: colors.status.warning,
    danger: colors.status.danger,
  };
  const color = variantMap[variant] || variantMap.default;

  const fontSize = size === 'sm' ? 16 : size === 'lg' ? 28 : 24;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="#e9e9e9"
          strokeWidth="4"
        />
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
        {showLabel && (
          <text
            x={diameter / 2}
            y={diameter / 2}
            textAnchor="middle"
            dy="0.3em"
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: 'bold',
              fill: '#1f1f1f',
              transform: 'rotate(90deg)',
              transformOrigin: `${diameter / 2}px ${diameter / 2}px`,
            }}
          >
            {value}%
          </text>
        )}
      </svg>
    </div>
  );
}
