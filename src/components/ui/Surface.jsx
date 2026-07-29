'use client';

// ─── UI Kit: Surface Component ────────────────────────────────────────────────
// Architecture rule:
//   Content area  → always white (#ffffff)
//   Logical block → Surface panel (gray #f4f4f5, rounded-[16px])
//   White card    → Surface card  (white, rounded-[16px], no border, no shadow)
//   Nested block  → Surface inset (dark gray #f0f0f0, rounded-[12px])
//
// Border radius rule for surfaces: Panel/Card is 16px (rounded-[16px]), Inset is 12px (rounded-[12px]).
// If Card is nested inside Panel, apply !rounded-[12px] to satisfy concentric nesting.

const PRESETS = {
  // Gray surface — separates logical blocks in a white content area
  panel: 'panel',
  // White card surface — lifts content cleanly
  card: 'card',
  // Inset surface — for nested elements within a surface
  inset: 'inset',
  // Nested white cards use the smaller concentric radius.
  'nested-card': 'nested-card',
  'nested-panel': 'nested-panel',
  // Billing and other data-heavy panels need an explicit boundary.
  'bordered-panel': 'bordered-panel',
  'bordered-card': 'bordered-card',
  'compact-bordered-card': 'compact-bordered-card',
  'compact-bordered-panel': 'compact-bordered-panel',
  popover: 'popover',
};

export default function Surface({
  variant   = 'panel',   // 'panel' | 'card' | 'inset'
  preset,
  padding   = 'md',      // 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  className = '',
  children,
}) {
  const semanticPreset = PRESETS[preset || variant] ?? PRESETS.panel;

  return (
    <div
      data-ui-surface={semanticPreset}
      data-ui-padding={padding}
      className={`ui-surface ${className}`}
    >
      {children}
    </div>
  );
}
