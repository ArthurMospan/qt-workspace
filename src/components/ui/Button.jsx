import React from 'react';
import { colors } from '@/lib/design/tokens';

// UI Kit Button Component - ENHANCED with color variants
// Strict rules enforced:
// - Primary buttons: 36px (h-9)
// - Action buttons: 32px (h-8)
// - Small buttons: 28px (h-7)
// - Multiple color variants (primary/secondary/ghost in 8 colors)
// - Icons paired with text when possible

const getColorClasses = (style, color) => {
  const colorConfig = {
    primary: colors.buttonPrimary,
    secondary: colors.buttonSecondary,
    ghost: colors.buttonGhost,
  }[style];

  if (!colorConfig || !colorConfig[color]) {
    return 'bg-[#1f1f1f] text-white hover:bg-[#303030]'; // Fallback
  }

  const conf = colorConfig[color];
  const bgHover = style === 'primary' ? conf.hover : style === 'secondary' ? conf.hover : conf.hover;
  const borderStyle = style === 'ghost' ? `border-2 border-[${conf.border}]` : '';

  return `bg-[${conf.bg}] text-[${conf.text}] hover:bg-[${bgHover}] ${borderStyle}`;
};

// Strict button heights enforced - no arbitrary sizes
const SIZES = {
  sm: 'h-[28px] px-[12px] text-[12px] rounded-[8px]',   // Small action buttons (h-7)
  md: 'h-[32px] px-[16px] text-[13px] rounded-[10px]',  // Action buttons (h-8)
  lg: 'h-[36px] px-[20px] text-[14px] rounded-[10px]',  // Primary buttons (h-9) DEFAULT
  icon: 'w-[32px] h-[32px] rounded-[10px] p-0 flex items-center justify-center' // Icon-only
};

// Style: primary (dark), secondary (light), ghost (outline)
// Color: blue, green, red, orange, purple, pink, teal, yellow
// Usage: <Button style="primary" color="blue" size="lg">Click me</Button>

export function Button({
  children,
  variant = 'primary',
  style = 'primary',        // 'primary', 'secondary', 'ghost'
  color = 'dark',           // 'blue', 'green', 'red', 'orange', 'purple', 'pink', 'teal', 'yellow', or 'dark'/'gray' for legacy
  size = 'lg',              // 'sm', 'md', 'lg', 'icon'
  className = '',
  icon: Icon,
  iconSize,
  disabled,
  onClick,
  type = 'button',
  loading = false,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center gap-[6px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#1f1f1f] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  // Handle legacy variant prop for backward compatibility
  let effectiveStyle = style;
  if (variant === 'primary' && !style) effectiveStyle = 'primary';
  if (variant === 'secondary' && !style) effectiveStyle = 'secondary';
  if (variant === 'ghost' && !style) effectiveStyle = 'ghost';

  // Map legacy variant names to color names
  let effectiveColor = color;
  if (color === 'dark') effectiveColor = 'dark'; // Default primary dark

  // Get color classes inline (since dynamic classes don't work well in Tailwind)
  let variantClasses = '';
  if (effectiveStyle === 'primary') {
    const conf = colors.buttonPrimary[effectiveColor] || { bg: '#1f1f1f', text: '#ffffff', hover: '#303030' };
    variantClasses = `transition-all shadow-sm`;
    variantClasses = `${variantClasses}`; // Will use inline styles below
  } else if (effectiveStyle === 'secondary') {
    const conf = colors.buttonSecondary[effectiveColor] || { bg: '#f5f5f5', text: '#1f1f1f', hover: '#e9e9e9' };
    variantClasses = `transition-all`;
  } else if (effectiveStyle === 'ghost') {
    variantClasses = `transition-all border-2`;
  } else {
    // Fallback for backward compat
    variantClasses = 'bg-[#1f1f1f] text-white hover:bg-[#303030] shadow-sm transition-all';
  }

  const sizeClasses = SIZES[size] || SIZES.lg;
  const defaultIconSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;
  const finalIconSize = iconSize || defaultIconSize;

  // Generate inline styles for button colors (since Tailwind doesn't support dynamic values)
  let buttonStyle = {};

  // Handle legacy color names
  let finalColor = effectiveColor;
  if (effectiveColor === 'dark' || effectiveColor === 'gray') {
    finalColor = 'blue'; // Default to blue for legacy dark/gray
  }

  if (effectiveStyle === 'primary') {
    const conf = colors.buttonPrimary[finalColor];
    if (conf) {
      buttonStyle = {
        backgroundColor: conf.bg,
        color: conf.text,
      };
    } else {
      // Fallback to dark primary
      buttonStyle = {
        backgroundColor: '#1f1f1f',
        color: '#ffffff',
      };
    }
  } else if (effectiveStyle === 'secondary') {
    const conf = colors.buttonSecondary[finalColor];
    if (conf) {
      buttonStyle = {
        backgroundColor: conf.bg,
        color: conf.text,
      };
    } else {
      // Fallback to light secondary
      buttonStyle = {
        backgroundColor: '#f5f5f5',
        color: '#1f1f1f',
      };
    }
  } else if (effectiveStyle === 'ghost') {
    const conf = colors.buttonGhost[finalColor];
    if (conf) {
      buttonStyle = {
        backgroundColor: conf.bg,
        color: conf.text,
        border: `2px solid ${conf.border}`,
      };
    } else {
      // Fallback to transparent ghost
      buttonStyle = {
        backgroundColor: 'transparent',
        color: '#1f1f1f',
        border: '2px solid #1f1f1f',
      };
    }
  } else {
    // Fallback for unknown style
    buttonStyle = {
      backgroundColor: '#1f1f1f',
      color: '#ffffff',
    };
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={buttonStyle}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <>
          {Icon && <Icon size={finalIconSize} />}
          {children && <span className={size === 'icon' ? 'sr-only' : ''}>{children}</span>}
        </>
      )}
    </button>
  );
}

export default Button;
