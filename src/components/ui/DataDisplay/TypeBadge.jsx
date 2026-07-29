'use client';

import Pill from './Pill';

export default function TypeBadge({
  label,
  color = '#9a9a9a',
  icon: Icon,
  className = '',
}) {
  return (
    <Pill
      label={label}
      icon={Icon}
      color={color}
      colorAlpha="14"
      size="sm"
      shape="badge"
      className={`!font-medium backdrop-blur-[2px] ${className}`}
    />
  );
}
