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

const VARIANTS = {
  // Gray surface — separates logical blocks in a white content area
  panel: 'bg-[#f4f4f5] rounded-[16px]',
  // White card surface — lifts content cleanly
  card:  'bg-white rounded-[16px]',
  // Inset surface — for nested elements within a surface
  inset: 'bg-[#f0f0f0] rounded-[16px]',
};

const PADDING = {
  none: '',
  xs:   'p-[8px]',
  sm:   'p-[12px]',
  md:   'p-[16px]',
  lg:   'p-[20px]',
  xl:   'p-[24px]',
  xxl:  'p-[32px]',
};

export default function Surface({
  variant   = 'panel',   // 'panel' | 'card' | 'inset'
  padding   = 'md',      // 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  className = '',
  children,
}) {
  return (
    <div className={`${VARIANTS[variant] ?? VARIANTS.panel} ${PADDING[padding] ?? PADDING.md} ${className}`}>
      {children}
    </div>
  );
}
