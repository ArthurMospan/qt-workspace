// src/lib/utils/sidebarTheme.js
// Computes a full set of sidebar color tokens from a single background HEX color.
// Uses WCAG relative luminance to decide if the background is "dark" or "light",
// then derives text, muted, hover, active, and border colors accordingly.

export const SIDEBAR_PRESETS = {
  dark:  '#1f1f1f',
  light: '#ffffff',
};

/**
 * Parse a HEX color string into { r, g, b } (0-255).
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  };
}

/**
 * WCAG relative luminance (0 = black, 1 = white).
 */
function luminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(first, second) {
  const firstLum = luminance(typeof first === 'string' ? hexToRgb(first) : first);
  const secondLum = luminance(typeof second === 'string' ? hexToRgb(second) : second);
  return (Math.max(firstLum, secondLum) + 0.05) / (Math.min(firstLum, secondLum) + 0.05);
}

/**
 * Clamp a value between 0 and 255.
 */
function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Blend background and foreground colors by a given ratio (0 to 1).
 */
function blendColors(bg, fg, ratio) {
  return {
    r: Math.round(bg.r + (fg.r - bg.r) * ratio),
    g: Math.round(bg.g + (fg.g - bg.g) * ratio),
    b: Math.round(bg.b + (fg.b - bg.b) * ratio)
  };
}

function accessibleBlend(bg, fg, preferredRatio, minimumContrast = 4.5) {
  let ratio = preferredRatio;
  let blended = blendColors(bg, fg, ratio);
  while (ratio < 1 && contrastRatio(bg, blended) < minimumContrast) {
    ratio = Math.min(1, ratio + 0.01);
    blended = blendColors(bg, fg, ratio);
  }
  return blended;
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

/**
 * Compute a complete sidebar color theme from a single background color.
 *
 * @param {string} bgHex - Background HEX color (e.g. '#1f1f1f')
 * @returns {{ bg, text, muted, hover, active, border, isDark }}
 */
export function computeSidebarTheme(bgHex) {
  const fallback = bgHex && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgHex)
    ? bgHex
    : SIDEBAR_PRESETS.dark;

  const rgb = hexToRgb(fallback);
  const lum = luminance(rgb);
  let isDark = lum < 0.4; // Preserve the established dark/light preference.
  let textRgb = isDark ? { r: 255, g: 255, b: 255 } : { r: 31, g: 31, b: 31 };

  // A middle custom colour can make the preferred foreground fail AA. In that
  // narrow band, choose the stronger black/white candidate before deriving the
  // quieter tokens; no organization colour can create unreadable navigation.
  if (contrastRatio(rgb, textRgb) < 4.5) {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    textRgb = contrastRatio(rgb, white) >= contrastRatio(rgb, black) ? white : black;
    isDark = textRgb === white;
  }

  if (isDark) {
    // Dark background → light text
    return {
      bg: fallback,
      text: rgbToHex(textRgb),
      muted: rgbToHex(accessibleBlend(rgb, textRgb, 0.50)),
      mutedProject: rgbToHex(accessibleBlend(rgb, textRgb, 0.38)),
      mutedHeader: rgbToHex(accessibleBlend(rgb, textRgb, 0.30)),
      hover: 'rgba(255,255,255,0.04)',
      active: 'rgba(255,255,255,0.08)',
      border: 'rgba(255,255,255,0.06)',
      isDark: true,
    };
  }

  // Light background → dark text
  return {
    bg: fallback,
    text: rgbToHex(textRgb),
    muted: rgbToHex(accessibleBlend(rgb, textRgb, 0.50)),
    mutedProject: rgbToHex(accessibleBlend(rgb, textRgb, 0.38)),
    mutedHeader: rgbToHex(accessibleBlend(rgb, textRgb, 0.30)),
    hover: 'rgba(0,0,0,0.04)',
    active: 'rgba(0,0,0,0.06)',
    border: 'rgba(31,31,31,0.08)',
    isDark: false,
  };
}
