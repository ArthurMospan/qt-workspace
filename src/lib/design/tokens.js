// src/lib/design/tokens.js
// Centralized design tokens for the QuickTeam UI Kit
// Single source of truth for colors, typography, spacing, and sizing

export const colors = {
  // Core/semantic colors
  dark: '#1f1f1f',        // Primary dark (buttons, text, sidebar)
  light: '#f4f4f5',       // Global canvas/surface background (Zinc-grey)
  elementLight: '#f4f4f5', // Previous element light grey (interactive components)
  surface: '#ffffff',     // White surfaces (cards, modals, content bg)
  border: {
    primary: '#e9e9e9',
    secondary: '#efefef',
    light: '#f0f0f0',
  },
  text: {
    primary: '#1f1f1f',   // Dark text
    muted: '#9a9a9a',     // Hints, placeholders, secondary
    inactive: '#cfcfcf',  // Disabled, very light
  },
  hover: {
    dark: '#303030',      // Dark button hover
    light: '#ebebeb',     // Light button hover
  },

  // Status/semantic colors
  status: {
    success: '#10b981',
    warning: '#eab308',
    danger: '#ef4444',
    error: '#f97316',
    info: '#6366f1',
    cyan: '#0891b2',
    purple: '#7c3aed',
  },

  // Status backgrounds (light tints)
  statusBg: {
    success: '#ecfdf5',
    warning: '#fefce8',
    danger: '#fef2f2',
    error: '#fff7ed',
    info: '#eef2ff',
    cyan: '#ecfeff',
    purple: '#f5f3ff',
  },

  // Priority colors
  priority: {
    blocker: '#ef4444',   // Red
    high: '#f97316',      // Orange
    medium: '#eab308',    // Yellow
    low: '#9a9a9a',       // Gray
  },

  // Button color variants - Primary style (dark bg)
  buttonPrimary: {
    dark: { bg: '#1f1f1f', text: '#ffffff', hover: '#303030', border: '#0a0a0a' },
    blue: { bg: '#3b82f6', text: '#ffffff', hover: '#2563eb', border: '#1d4ed8' },
    green: { bg: '#10b981', text: '#ffffff', hover: '#059669', border: '#047857' },
    red: { bg: '#ef4444', text: '#ffffff', hover: '#dc2626', border: '#b91c1c' },
    orange: { bg: '#f97316', text: '#ffffff', hover: '#ea580c', border: '#c2410c' },
    purple: { bg: '#7c3aed', text: '#ffffff', hover: '#6d28d9', border: '#5b21b6' },
    pink: { bg: '#ec4899', text: '#ffffff', hover: '#db2777', border: '#be185d' },
    teal: { bg: '#14b8a6', text: '#ffffff', hover: '#0d9488', border: '#0f766e' },
    yellow: { bg: '#eab308', text: '#1f1f1f', hover: '#ca8a04', border: '#a16207' },
  },

  // Button color variants - Secondary style (light bg)
  buttonSecondary: {
    dark: { bg: '#f5f5f5', text: '#1f1f1f', hover: '#e9e9e9', border: '#d1d1d1' },
    blue: { bg: '#dbeafe', text: '#1e40af', hover: '#bfdbfe', border: '#93c5fd' },
    green: { bg: '#ecfdf5', text: '#065f46', hover: '#d1fae5', border: '#a7f3d0' },
    red: { bg: '#fee2e2', text: '#7f1d1d', hover: '#fecaca', border: '#fca5a5' },
    orange: { bg: '#fed7aa', text: '#92400e', hover: '#fdba74', border: '#fb923c' },
    purple: { bg: '#ede9fe', text: '#5b21b6', hover: '#ddd6fe', border: '#c4b5fd' },
    pink: { bg: '#fce7f3', text: '#831843', hover: '#fbcfe8', border: '#f472b6' },
    teal: { bg: '#ccfbf1', text: '#0f766e', hover: '#99f6e4', border: '#5eead4' },
    yellow: { bg: '#fef3c7', text: '#92400e', hover: '#fde68a', border: '#fcd34d' },
  },

  // Button color variants - Ghost style (transparent)
  buttonGhost: {
    dark: { bg: 'transparent', text: '#1f1f1f', border: '#1f1f1f', hover: '#f4f4f5' },
    blue: { bg: 'transparent', text: '#3b82f6', border: '#3b82f6', hover: '#dbeafe' },
    green: { bg: 'transparent', text: '#10b981', border: '#10b981', hover: '#ecfdf5' },
    red: { bg: 'transparent', text: '#ef4444', border: '#ef4444', hover: '#fee2e2' },
    orange: { bg: 'transparent', text: '#f97316', border: '#f97316', hover: '#fed7aa' },
    purple: { bg: 'transparent', text: '#7c3aed', border: '#7c3aed', hover: '#ede9fe' },
    pink: { bg: 'transparent', text: '#ec4899', border: '#ec4899', hover: '#fce7f3' },
    teal: { bg: 'transparent', text: '#14b8a6', border: '#14b8a6', hover: '#ccfbf1' },
    yellow: { bg: 'transparent', text: '#eab308', border: '#eab308', hover: '#fef3c7' },
  },
};

export const typography = {
  // Font families
  fontFamily: {
    primary: 'Inter, sans-serif',
    secondary: 'Roboto Condensed, sans-serif',
  },

  // Font sizes and weights (in pixels)
  sizes: {
    h1: { size: '32px', weight: 700 },      // Page title
    h2: { size: '24px', weight: 700 },      // Section title
    h3: { size: '18px', weight: 700 },      // Subsection
    h4: { size: '16px', weight: 700 },      // Small title
    body: { size: '14px', weight: 600 },    // Primary text
    sm: { size: '13px', weight: 600 },      // Secondary text
    xs: { size: '12px', weight: 600 },      // Small text
    label: { size: '11px', weight: 700 },   // Form labels, badges
    tag: { size: '9px', weight: 700 },      // Type tags, tiny text
  },
};

export const spacing = {
  // Fixed spacing values (in pixels)
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',

  // Common composite spacing
  pagePadding: '32px',    // Content padding (px-8)
  sectionGap: '24px',     // Gap between sections
  componentGap: {
    tight: '6px',
    default: '8px',
    loose: '12px',
    section: '16px',
  },
};

export const sizing = {
  // Button heights
  button: {
    sm: '28px',           // h-7
    md: '32px',           // h-8
    lg: '36px',           // h-9 (default/primary)
  },

  // Input heights
  input: '36px',          // h-9 (standard input height)
  control: '36px',        // Standard height for controls (inputs, selects, tabs)

  // Border radius
  radius: {
    sm: '5px',            // Badges
    md: '8px',            // Buttons
    lg: '10px',           // Inputs, tabs
    xl: '12px',           // Cards
    xxl: '14px',          // Select dropdowns
    full: '16px',         // Common card radius (rounded-2xl)
    max: '24px',          // Modals
  },

  // Avatar sizes
  avatar: {
    sm: '28px',
    md: '32px',
    lg: '40px',
    xl: '48px',
  },

  // Icon sizes
  icon: {
    xs: '12px',
    sm: '14px',
    md: '18px',
    lg: '20px',
    xl: '24px',
  },

  // Checkbox & Radio sizes
  checkbox: {
    sm: '16px',
    md: '18px',
    lg: '20px',
  },

  // Progress bar heights
  progress: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },

  // Badge sizes
  badge: {
    sm: '16px',
    md: '20px',
    lg: '24px',
  },

  // List item heights (comfortable touch targets)
  listItem: {
    compact: '40px',      // For dense lists
    default: '48px',      // Standard list item
    spacious: '56px',     // For card-like items
  },

  // Toggle switch sizes
  toggle: {
    sm: '24px',
    md: '32px',
    lg: '36px',
  },
};

export const shadows = {
  none: 'none',
  sm: '0 1px 4px rgba(0, 0, 0, 0.04)',
  md: '0 2px 6px rgba(0, 0, 0, 0.04)',
  lg: '0 4px 24px rgba(0, 0, 0, 0.02)',
  xl: '0 8px 30px rgba(0, 0, 0, 0.08)',
  drag: '0 18px 44px rgba(0, 0, 0, 0.14)',
  modal: '0 25px 50px rgba(0, 0, 0, 0.15)',
};

export const transitions = {
  fast: '100ms',
  default: '200ms',
  slow: '300ms',
  timing: 'ease-in-out',
};

export const zIndex = {
  // Layering scale
  default: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  tooltip: 50,
  notification: 60,
};

export const states = {
  // Opacity for disabled/inactive states
  disabled: 0.5,
  hover: 1,
  active: 1,
  focus: 1,

  // State colors
  focus: {
    ring: '2px',
    color: '#1f1f1f',
    offset: '1px',
  },
};

export const cardVariants = {
  // Card padding options
  padding: {
    compact: '12px',
    default: '16px',
    spacious: '20px',
    extra: '24px',
  },

  // Card border options
  border: {
    none: 'none',
    subtle: `1px solid ${colors.border.light}`,
    standard: `1px solid ${colors.border.primary}`,
    strong: `2px solid ${colors.dark}`,
  },
};

export const animations = {
  // Keyframe names for common animations
  spin: 'spin',
  pulse: 'pulse',
  bounce: 'bounce',
  slideIn: 'slideIn',
  fadeIn: 'fadeIn',
  slideUp: 'slideUp',
  // Toggle switch animations
  toggleSlide: 'toggleSlide',
  // Modal animations
  scaleIn: 'scaleIn',
  fadeInDown: 'fadeInDown',
  // Toast animations
  slideInRight: 'slideInRight',
  slideOutRight: 'slideOutRight',
};

// Preset combinations for common patterns
export const presets = {
  button: {
    primary: {
      height: sizing.button.lg,          // 36px
      padding: '0 20px',
      borderRadius: sizing.radius.lg,    // 10px
      fontSize: typography.sizes.xs.size,
      fontWeight: typography.sizes.xs.weight,
      bg: colors.dark,
      text: colors.surface,
    },
    secondary: {
      height: sizing.button.lg,          // 36px
      padding: '0 20px',
      borderRadius: sizing.radius.lg,    // 10px
      fontSize: typography.sizes.xs.size,
      fontWeight: typography.sizes.xs.weight,
      bg: colors.light,
      text: colors.dark,
    },
    action: {
      height: sizing.button.md,          // 32px
      padding: '0 16px',
      borderRadius: sizing.radius.md,    // 8px
      fontSize: typography.sizes.xs.size,
      fontWeight: typography.sizes.xs.weight,
    },
  },
  control: {
    height: sizing.control,              // 36px
    borderRadius: sizing.radius.lg,      // 10px
    fontSize: typography.sizes.sm.size,
  },
  surface: {
    borderRadius: sizing.radius.full,    // 16px
    shadow: shadows.sm,
    border: `1px solid ${colors.border.primary}`,
  },
  modal: {
    borderRadius: sizing.radius.max,     // 24px
    shadow: shadows.modal,
  },
};
