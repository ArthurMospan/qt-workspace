import React from 'react';

// ─── UI Kit: Master Button Component ─────────────────────────────────────────
// Single source of truth for ALL buttons in the project.
//
// SIZE RULES (strict):
//   size="lg"  → 36px (h-9)  — Primary CTA, default when no size specified
//   size="md"  → 32px (h-8)  — Action buttons (edit, archive, secondary)
//   size="sm"  → 28px (h-7)  — Small/compact contexts
//   size="icon"→ 32×32px     — Icon-only button (no text)
//   size="icon-xs" → 20×20px — Dense expand/action controls
//
// STYLE RULES (strict):
//   style="primary"   → dark background (#1f1f1f), white text
//   style="secondary" → light background (#f5f5f5), dark text
//   style="ghost"     → transparent bg, dark border + text
//
// COLOR EXCEPTIONS (only when explicitly needed):
//   color="red"   → red tones (delete/danger actions only)
//   color="dark"  → default (same as no color specified)

const SIZES = {
  sm:   'px-[12px] text-[12px]',
  md:   'px-[16px] text-[13px]',
  lg:   'px-[18px] text-[13px]',
  icon: 'w-[32px] p-0',
  'icon-lg': 'w-[36px] p-0',
  'icon-sm': 'w-[28px] p-0',
  'icon-xs': 'w-[20px] p-0',
  'icon-24': 'w-[24px] p-0',
  'icon-26': 'w-[26px] p-0',
  'icon-30': 'w-[30px] p-0',
};

const UI_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  icon: 'md',
  'icon-lg': 'lg',
  'icon-sm': 'sm',
  'icon-xs': 'icon-xs',
  'icon-24': 'icon-24',
  'icon-26': 'icon-26',
  'icon-30': 'icon-30',
};

const SHAPES = {
  default: '',
  compact: '!rounded-[8px]',
  micro: '!rounded-[6px]',
  tight: '!rounded-[7px]',
  circle: '!rounded-full',
};

const SURFACES = {
  default: '',
  canvas: '!bg-canvas !text-ink hover:!bg-[#ebebeb]',
  'danger-subtle': '!border !border-[#ef4444] !bg-red-50 hover:!bg-red-100',
};

// collapseAt="sm"|"md": below that breakpoint the label hides and the button
// becomes a square icon button — one Button instead of a hand-rolled pair.
// NOTE: these use max-* responsive variants on purpose — a plain `hidden` in
// className can NOT override the base `inline-flex` (same-layer utilities,
// stylesheet order wins), while responsive variants always can.
const COLLAPSE_BTN = {
  sm: {
    sm: 'max-sm:w-[28px] max-sm:px-0 max-sm:gap-0',
    md: 'max-sm:w-[32px] max-sm:px-0 max-sm:gap-0',
    lg: 'max-sm:w-[36px] max-sm:px-0 max-sm:gap-0',
  },
  md: {
    sm: 'max-md:w-[28px] max-md:px-0 max-md:gap-0',
    md: 'max-md:w-[32px] max-md:px-0 max-md:gap-0',
    lg: 'max-md:w-[36px] max-md:px-0 max-md:gap-0',
  },
};
const COLLAPSE_LABEL = { sm: 'max-sm:hidden', md: 'max-md:hidden' };

const STYLES = {
  primary: {
    dark: 'bg-ink text-white hover:bg-ink-hover',
    red:  'bg-[#ef4444] text-white hover:bg-[#dc2626]',
  },
  secondary: {
    dark: 'bg-[#f5f5f5] text-ink hover:bg-[#ebebeb]',
    red:  'bg-[#f5f5f5] text-[#ef4444] hover:bg-[#ebebeb]',
  },
  outline: {
    dark: 'bg-transparent text-ink border-2 border-ink hover:bg-canvas',
    red:  'bg-transparent text-[#ef4444] border-2 border-[#ef4444] hover:bg-[#fee2e2]',
  },
  ghost: {
    dark: 'bg-transparent text-muted hover:text-ink hover:bg-[#f0f0f0]',
    red:  'bg-transparent text-[#ef4444] hover:bg-[#fee2e2]',
  },
};

export function Button({
  children,
  style    = 'primary',  // 'primary' | 'secondary' | 'outline' | 'ghost'
  color    = 'dark',     // 'dark' | 'red'
  size     = 'lg',       // 'sm' | 'md' | 'lg' | 'icon'
  icon: Icon,
  iconSize,
  buttonRef,
  disabled  = false,
  loading   = false,
  onClick,
  type      = 'button',
  className = '',
  collapseAt,
  composition,
  shape = 'default',
  surface = 'default',
  // Legacy prop support
  variant,
  ...props
}) {
  // Legacy variant prop support
  const effectiveStyle = variant || style;
  // Validate color — only 'dark' and 'red' are supported
  const effectiveColor = color === 'red' ? 'red' : 'dark';

  const baseClasses =
    'inline-flex items-center justify-center gap-[6px] font-bold leading-none transition-colors ' +
    'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shrink-0';

  const sizeClass  = SIZES[size] ?? SIZES.lg;
  const collapseClass = collapseAt ? (COLLAPSE_BTN[collapseAt]?.[size] ?? '') : '';
  const labelCollapseClass = collapseAt ? (COLLAPSE_LABEL[collapseAt] ?? '') : '';
  const styleClass = STYLES[effectiveStyle]?.[effectiveColor] ?? STYLES.primary.dark;
  const defaultIconSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;
  const finalIconSize = iconSize ?? defaultIconSize;

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      data-ui-size={UI_SIZES[size] ?? 'lg'}
      data-ui-composition={composition}
      className={`ui-control ${baseClasses} ${sizeClass} ${collapseClass} ${styleClass} ${SHAPES[shape] ?? ''} ${SURFACES[surface] ?? ''} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <>
          {Icon && <Icon size={finalIconSize} />}
          {children && (
            <span className={size.startsWith('icon') ? 'sr-only' : labelCollapseClass}>{children}</span>
          )}
        </>
      )}
    </button>
  );
}

export default Button;
