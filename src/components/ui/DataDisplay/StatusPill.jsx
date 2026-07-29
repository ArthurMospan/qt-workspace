'use client';

import Pill from './Pill';

export default function StatusPill({
  label,
  color = '#9a9a9a',
  className = '',
}) {
  return (
    <Pill
      label={label}
      color={color}
      size="sm"
      shape="badge"
      className={className}
    />
  );
}
