'use client';

import React from 'react';

export default function Pill({
  children,
  label,
  icon: Icon,
  tone = 'neutral',
  size = 'sm',
  shape = 'capsule',
  appearance = 'subtle',
  preset,
  color,
  colorAlpha = '18',
  uppercase = false,
  weight = 'bold',
  className = '',
  ...props
}) {
  const customStyle = color
    ? { color, backgroundColor: `${color}${colorAlpha}` }
    : undefined;

  return (
    <span
      {...props}
      data-ui-pill-tone={color ? 'custom' : tone}
      data-ui-pill-size={size}
      data-ui-pill-shape={shape}
      data-ui-pill-appearance={appearance}
      data-ui-pill-preset={preset}
      className={`ui-pill ${weight === 'medium' ? '!font-medium' : ''} ${uppercase ? 'uppercase tracking-wider' : ''} ${className}`}
      style={customStyle}
    >
      {Icon ? <Icon size={size === 'lg' ? 12 : 10} strokeWidth={2} aria-hidden /> : null}
      {label ?? children}
    </span>
  );
}
