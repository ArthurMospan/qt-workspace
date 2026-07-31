'use client';

import React from 'react';

// ─── UI Kit: Text Action ─────────────────────────────────────────────────────
// A button with no box: type, a colour and a hover, nothing else.
//
// This existed 15 times, hand-written, across five surfaces — «Зберегти» beside
// a chat edit box, «Редагувати» in the channel panel, «ще» in the calendar,
// «Спробувати ще раз» on a task, «Перейти» in the header. Every copy re-picked
// its own font size and its own hover, so the same control was 10px normal in
// one place and 13px semibold in another with no rule behind the difference.
//
// The rule below is read *out of* those fifteen rather than imposed on them:
// the two 10px instances are normal weight and the 11/12px ones are semibold,
// so weight follows size instead of being a separate prop nobody would set
// consistently. Icon size and gap follow size for the same reason — `Button`
// learned that lesson already when its free `iconSize` prop was removed.

const SIZES = {
  xs: 'text-[10px] gap-1',
  sm: 'text-[11px] font-semibold gap-1',
  md: 'text-[12px] font-semibold gap-1.5',
};

const ICON_SIZES = { xs: 12, sm: 13, md: 12 };

const TONES = {
  // Primary: the affirmative half of an inline pair (Зберегти, Додати, Перейти).
  ink: 'text-ink hover:underline',
  // Secondary: the quiet half (Скасувати, Редагувати) and quiet navigation.
  muted: 'text-muted hover:text-ink',
  // Destructive and visible about it.
  danger: 'text-red-500 hover:text-red-700',
  // Destructive but resting: an icon that only turns red under the pointer.
  'danger-quiet': 'text-faint hover:text-red-500',
};

export default function TextAction({
  children,
  label,
  icon: Icon,
  tone = 'ink',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const sizeClass = SIZES[size] ?? SIZES.md;
  const toneClass = TONES[tone] ?? TONES.ink;

  // Colour *and* opacity. Half of these sit inside a `group-hover` row and fade
  // in with it, so the call site adds `opacity-0 group-hover:opacity-100`. Had
  // this said `transition-colors`, the two would have been the same property in
  // the same layer and whichever Tailwind emitted last would have won.
  return (
    <button
      type={type}
      aria-label={children ? undefined : label}
      className={`inline-flex items-center transition-[color,opacity] ${sizeClass} ${toneClass} ${className}`}
      {...props}
    >
      {Icon && <Icon size={ICON_SIZES[size] ?? ICON_SIZES.md} />}
      {children}
    </button>
  );
}
