import React from 'react';

// ─── UI Kit: Master Button Component ─────────────────────────────────────────
// Single source of truth for ALL buttons in the project.
//
// SIZE RULES (strict):
//   size="lg"  → 36px (h-9)  — Primary CTA, default when no size specified
//   size="md"  → 32px (h-8)  — Action buttons (edit, archive, secondary)
//   size="sm"  → 28px (h-7)  — Small/compact contexts
//   size="icon"→ 32×32px     — Icon-only button (no text)
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
  sm:   'h-[28px] px-[12px] text-[12px] rounded-[10px]',
  md:   'h-[32px] px-[16px] text-[13px] rounded-[10px]',
  lg:   'h-[36px] px-[18px] text-[13px] rounded-[10px]',
  icon: 'w-[32px] h-[32px] rounded-[10px] p-0',
  'icon-lg': 'w-[36px] h-[36px] rounded-[10px] p-0',
  'icon-sm': 'w-[28px] h-[28px] rounded-[10px] p-0',
};

const STYLES = {
  primary: {
    dark: 'bg-[#1f1f1f] text-white hover:bg-[#303030]',
    red:  'bg-[#ef4444] text-white hover:bg-[#dc2626]',
  },
  secondary: {
    dark: 'bg-[#f5f5f5] text-[#1f1f1f] hover:bg-[#ebebeb]',
    red:  'bg-[#f5f5f5] text-[#ef4444] hover:bg-[#ebebeb]',
  },
  outline: {
    dark: 'bg-transparent text-[#1f1f1f] border-2 border-[#1f1f1f] hover:bg-[#f4f4f5]',
    red:  'bg-transparent text-[#ef4444] border-2 border-[#ef4444] hover:bg-[#fee2e2]',
  },
  ghost: {
    dark: 'bg-transparent text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0]',
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
  disabled  = false,
  loading   = false,
  onClick,
  type      = 'button',
  className = '',
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
  const styleClass = STYLES[effectiveStyle]?.[effectiveColor] ?? STYLES.primary.dark;
  const defaultIconSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;
  const finalIconSize = iconSize ?? defaultIconSize;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClass} ${styleClass} ${className}`}
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
            <span className={size.startsWith('icon') ? 'sr-only' : ''}>{children}</span>
          )}
        </>
      )}
    </button>
  );
}

export default Button;
