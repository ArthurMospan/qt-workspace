'use client';
import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import Tabs from '../Tabs';
import Button from '../Button';

// ─── UI Kit: PageHeader Component ────────────────────────────────────────────
// Standard page header used across ALL workspace pages.
//
// Typography rule: main title is ALWAYS 24px (text-2xl), font-bold.
// Spacing rule: pt-0 from top (from the workspace header below), mb-[24px]
//
// Variants:
//   "main" — standalone page title row + optional tabs row below (Projects, Team, etc.)
//   "alt"  — compact inline header inside a white panel (Kanban board, etc.)

export function PageHeader({
  variant    = 'main',
  title,
  tabs       = [],
  activeTab,
  onTabChange,
  actions,
  // Mobile-only action buttons (e.g. an icon CTA that duplicates a desktop
  // filters-row button). Wrapper is md:hidden, so on desktop it contributes
  // neither DOM width nor flex gap.
  mobileActions,
  filters,
  className  = '',
}) {
  // Mobile-only: filters are collapsed behind a toggle button
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // ── Alt variant: compact bar inside a white panel ──────────────────────────
  if (variant === 'alt') {
    return (
      <div className={`bg-white flex items-center gap-[8px] px-[20px] py-[10px] shrink-0 border-b border-canvas w-full ${className}`}>
        {title && (
          <h2 className="text-[24px] font-bold text-ink tracking-tight shrink-0 mr-2">
            {title}
          </h2>
        )}

        {tabs?.length > 0 && (
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        )}

        <div className="flex-1 min-w-[20px]" />

        {filters && (
          <div className="flex items-center gap-2 mr-2 shrink-0">{filters}</div>
        )}

        <div className="flex items-center gap-[8px] shrink-0">
          {actions}
        </div>
      </div>
    );
  }

  // ── Main variant: full page header with top spacing, sticky with premium blur + dynamic gradient layers ────────────────────────
  return (
    <div className={`sticky top-[56px] z-20 shrink-0 flex flex-col pt-[12px] pb-[12px] gap-[10px] full-bleed ${className}`}>

      {/* LAYER 1 (Bottom): Premium vertical fade mask (from solid white at top to transparent at bottom).
          Rounded corners only on md+ where the white panel itself is rounded — on mobile they'd leak content. */}
      <div className="absolute inset-0 z-[-2] bg-gradient-to-b from-white via-white/95 to-transparent pointer-events-none rounded-none md:rounded-t-[24px]" />

      {/* LAYER 2 (Top): Pure frosted backdrop-blur layer to smoothly dissolve scrolling text/images */}
      <div className="absolute inset-0 z-[-1] backdrop-blur-md bg-white/20 pointer-events-none" />

      {/* Row 1: Title + Actions — actions ALWAYS sit right of the title */}
      <div className="flex items-center justify-between gap-[12px] md:gap-[16px] w-full">
        <h1 className="text-[24px] font-bold text-ink tracking-tight truncate min-w-0">
          {title}
        </h1>

        <div className="flex items-center gap-[8px] shrink-0">
          {tabs?.length > 0 && (
            <div className="hidden md:block">
              <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
            </div>
          )}
          {/* Mobile filters toggle — sits with the action buttons */}
          {filters && (
            <Button
              style={mobileFiltersOpen ? 'primary' : 'secondary'}
              size="icon-lg"
              icon={Filter}
              onClick={() => setMobileFiltersOpen(o => !o)}
              title="Фільтри"
              className="md:hidden"
            />
          )}
          {mobileActions && (
            <div className="md:hidden flex items-center gap-[8px] shrink-0">
              {mobileActions}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-[8px] shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Row 1.5 (mobile only): tabs scroll edge-to-edge */}
      {tabs?.length > 0 && (
        <div className="md:hidden overflow-x-auto hide-scrollbar full-bleed">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} className="w-max" />
        </div>
      )}

      {/* Row 2: Filters — mobile: hidden until toggled */}
      {filters && (
        <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} md:flex items-center gap-[12px] flex-wrap`}>
          <div className="flex items-center gap-[12px] flex-wrap flex-1 min-w-0">
            {filters}
          </div>
        </div>
      )}
    </div>
  );
}

export default PageHeader;
