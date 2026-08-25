'use client';

import React from 'react';
import Button from './Button';

export const APPEARANCES = {
  quiet: '!bg-transparent !text-muted hover:!bg-canvas hover:!text-ink',
  soft: '!bg-canvas !text-muted hover:!bg-line hover:!text-ink',
  // Like `soft`, but the icon carries the weight rather than the fill: a dark
  // glyph on a flat #f1f1f1 disc. Used where the action *is* the control and
  // there is no label beside it to say what it does.
  contrast: '!bg-[#f1f1f1] !text-ink hover:!bg-[#e4e4e4]',
  surface: '!border !border-line !bg-white !text-muted hover:!bg-canvas hover:!text-ink',
  primary: '!bg-ink !text-white hover:!bg-ink/90',
  // The same disc as `surface`, and only its hover differs. It used to carry a
  // shadow as well, which is why the two of them side by side — the notification
  // row's «прочитано» and «видалити» — read as two different controls.
  'surface-danger': '!border !border-line !bg-white !text-muted hover:!bg-danger-soft hover:!text-danger',
  'surface-plain': '!bg-white !text-faint hover:!text-ink',
  overlay: '!bg-black/50 !text-white hover:!bg-black/70',
  inverse: '!bg-white/10 !text-white hover:!bg-white/20',
  'auth-close': '!border !border-white/10 !bg-[#2a2a2a] !text-white/70 hover:!bg-white/10 hover:!text-white',
  danger: '!bg-danger-solid !text-white hover:!bg-danger',
  'quiet-danger': '!bg-transparent !text-muted hover:!bg-danger-soft hover:!text-danger',
};

export const BUTTON_SIZES = {
  micro: 'icon-xs',
  xs: 'icon-24',
  sm: 'icon-sm',
  compact: 'icon-30',
  md: 'icon',
  lg: 'icon-lg',
  xl: 'icon-xl',
};

/**
 * A square icon-only button. It is `Button` underneath, so it inherits the same
 * control height scale; what it adds is the accessible name, which an icon
 * button has no other way to carry.
 *
 * @param {string} props.label Accessible name and tooltip. Required — an icon alone names nothing.
 * @param {React.ComponentType} props.icon lucide icon; its pixel size comes from `size`, never from the call site.
 * @param {'micro'|'xs'|'sm'|'compact'|'md'|'lg'|'xl'} props.size Box size, mapped onto Button's icon sizes.
 * @param {string} props.appearance Fill and hover treatment; the dark ones exist for overlays and dark surfaces.
 * @param {string} props.shape Corner radius token.
 * @param {React.Ref} props.buttonRef Ref to the underlying button, for popovers anchored to it.
 * @param {string} props.className Placement in the parent only.
 */
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
