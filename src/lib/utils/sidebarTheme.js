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
 * Three tiers of quiet ink, and why they are numbered the way they are.
 *
 * The rail has a hierarchy: the navigation is the rail's job, the project list
 * is a second thing inside it, and the section header, the «+» beside it and
 * the collapse toggle are chrome around both. That is `muted` →
 * `mutedProject` → `mutedHeader`, each a notch quieter than the last.
 *
 * The notches used to be 0.50 / 0.38 / 0.30 and they were invisible, because
 * `accessibleBlend` may only ever raise a blend: no organization colour is
 * allowed to produce navigation below AA. On the dark preset the 4.5:1 floor
 * lands at ≈0.46, so the two quieter tiers were both clamped to it and to each
 * other, and all three read as one colour.
 *
 * A tier therefore cannot be made quieter — the floor is not negotiable and
 * `tests/qa-accessibility.test.mjs` holds it for every background. The distance
 * is made by lifting the tier above instead: `muted` is asked for well clear of
 * the floor, so what sits under it has somewhere to sit. On a colour whose
 * floor is higher than the top tier's preference — a mid-tone that barely
 * carries any foreground at all — all three still collapse together, which is
 * the honest answer for a background with no room in it.
 *
 * @param {string} bgHex - Background HEX color (e.g. '#1f1f1f')
 * @returns {{ bg, text, muted, mutedProject, mutedHeader, hover, active, border, isDark }}
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
      muted: rgbToHex(accessibleBlend(rgb, textRgb, 0.66)),
      mutedProject: rgbToHex(accessibleBlend(rgb, textRgb, 0.52)),
      mutedHeader: rgbToHex(accessibleBlend(rgb, textRgb, 0.34)),
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
    muted: rgbToHex(accessibleBlend(rgb, textRgb, 0.66)),
    mutedProject: rgbToHex(accessibleBlend(rgb, textRgb, 0.52)),
    mutedHeader: rgbToHex(accessibleBlend(rgb, textRgb, 0.34)),
    hover: 'rgba(0,0,0,0.04)',
    active: 'rgba(0,0,0,0.06)',
    border: 'rgba(31,31,31,0.08)',
    isDark: false,
  };
}

/**
 * The colour a translucent surface actually shows: its own colour laid over
 * whatever is behind it at `alpha`.
 */
function compositeOver(frontHex, backdropHex, alpha) {
  return rgbToHex(blendColors(hexToRgb(backdropHex), hexToRgb(frontHex), alpha));
}

/**
 * The same theme, for a surface that is glass rather than paint.
 *
 * A translucent panel does not have the contrast its own colour promises. At
 * 88% over a white page the dark preset is *seen* as #353535, and `muted` —
 * derived to clear 4.5:1 against #1f1f1f — lands at 3.2:1 against what the
 * reader is actually looking at. So every token here is derived from the
 * perceived colour, and only `bg` stays the organization's own: that is the
 * colour being painted, at the returned `opacity`.
 *
 * Transparency is therefore a budget rather than a constant, and a brand colour
 * that cannot afford all of it gets less. A mid-tone blue thinned to 88% falls
 * into the band where black reads better than white, and the bar's labels would
 * have flipped colour while the sheet the same bar opens kept them white. The
 * tone is the organization's decision; the opacity is what gives way, one point
 * at a time, until the panel can carry that decision at AA.
 *
 * `over` is the page behind the surface. Below md the workspace shell and every
 * content pane are `--color-surface`, and the scrim under the bar keeps them so.
 *
 * @param {string} bgHex Background HEX colour of the surface itself.
 * @param {{opacity?: number, over?: string, minimumContrast?: number}} options Requested opacity, the page behind it, and the floor the text must hold.
 * @returns {{ bg, perceived, opacity, text, muted, hover, active, border, isDark }} `bg` is painted at `opacity`; `perceived` is what that produces, and the colour every token here answers to.
 */
export function computeTranslucentSidebarTheme(bgHex, {
  opacity = 0.88,
  over = '#ffffff',
  minimumContrast = 4.5,
} = {}) {
  const solid = computeSidebarTheme(bgHex);
  let alpha = opacity;
  let seen = compositeOver(solid.bg, over, alpha);
  let perceived = computeSidebarTheme(seen);

  while (
    alpha < 1
    && (perceived.isDark !== solid.isDark || contrastRatio(solid.text, seen) < minimumContrast)
  ) {
    alpha = Math.min(1, alpha + 0.01);
    seen = compositeOver(solid.bg, over, alpha);
    perceived = computeSidebarTheme(seen);
  }

  return { ...perceived, bg: solid.bg, perceived: seen, opacity: alpha };
}
