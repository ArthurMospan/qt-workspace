'use client';

// ─── UI Kit: PageContentWrapper ───────────────────────────────────────────────
// Standard scrollable content area for ALL workspace pages.
// Ensures consistent padding and max-width across the entire app.
//
// Rules enforced:
//   - px-[32px] horizontal padding (always)
//   - pb-[120px] bottom padding (breathing room at the bottom)
//   - max-w-[1400px] centered content
//   - white background (#ffffff) — content zone is always white
//   - overflow-y-auto for scrolling

export default function PageContentWrapper({
  children,
  className = '',
  maxWidth  = '1400px',
}) {
  return (
    <div className={`flex-1 h-full overflow-y-auto overflow-x-hidden px-[32px] pb-[120px] custom-scrollbar bg-transparent ${className}`}>
      <div style={{ maxWidth }} className="mx-auto">
        {children}
      </div>
    </div>
  );
}
