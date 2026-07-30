'use client';

import React from 'react';
import Button from './Button';

export const APPEARANCES = {
  quiet: '!bg-transparent !text-muted hover:!bg-[#f0f0f0] hover:!text-ink',
  soft: '!bg-canvas !text-muted hover:!bg-[#ebebeb] hover:!text-ink',
  surface: '!border !border-line !bg-white !text-muted hover:!bg-canvas hover:!text-ink',
  primary: '!bg-ink !text-white hover:!bg-ink/90',
  'surface-danger': '!border !border-line !bg-white !text-muted shadow-sm hover:!text-red-500',
  'surface-plain': '!bg-white !text-faint hover:!text-ink',
  overlay: '!bg-black/50 !text-white hover:!bg-black/70',
  inverse: '!bg-white/10 !text-white hover:!bg-white/20',
  'auth-close': '!border !border-white/10 !bg-[#2a2a2a] !text-white/70 hover:!bg-white/10 hover:!text-white',
  danger: '!bg-[#ef4444] !text-white hover:!bg-[#dc2626]',
  'quiet-danger': '!bg-transparent !text-muted hover:!bg-red-100 hover:!text-red-500',
};

export const BUTTON_SIZES = {
  micro: 'icon-xs',
  xs: 'icon-24',
  sm: 'icon-sm',
  compact: 'icon-30',
  md: 'icon',
  lg: 'icon-lg',
};

export default function IconAction({
  label,
  icon,
  size = 'md',
  appearance = 'quiet',
  shape = 'default',
  buttonRef,
  className = '',
  ...props
}) {
  return (
    <Button
      {...props}
      aria-label={label}
      buttonRef={buttonRef}
      icon={icon}
      size={BUTTON_SIZES[size] ?? BUTTON_SIZES.md}
      shape={shape}
      style="ghost"
      className={`${APPEARANCES[appearance] ?? APPEARANCES.quiet} ${className}`}
    />
  );
}
