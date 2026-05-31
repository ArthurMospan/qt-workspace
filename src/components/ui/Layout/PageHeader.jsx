'use client';
import React from 'react';
import Tabs from '../Tabs';

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
  filters,
  className  = '',
}) {

  // ── Alt variant: compact bar inside a white panel ──────────────────────────
  if (variant === 'alt') {
    return (
      <div className={`bg-white flex items-center gap-[8px] px-[20px] py-[10px] shrink-0 border-b border-[#f4f4f5] w-full ${className}`}>
        {title && (
          <h2 className="text-[24px] font-bold text-[#1f1f1f] tracking-tight shrink-0 mr-2">
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
    <div className={`sticky top-[56px] z-20 w-full shrink-0 flex flex-col pt-[12px] pb-[12px] gap-[10px] px-[24px] md:px-[32px] -mx-[24px] md:-mx-[32px] w-[calc(100%+48px)] md:w-[calc(100%+64px)] ${className}`}>
      
      {/* LAYER 1 (Bottom): Premium vertical fade mask (from solid white at top to transparent at bottom) */}
      <div className="absolute inset-0 z-[-2] bg-gradient-to-b from-white via-white/95 to-transparent pointer-events-none rounded-t-[24px]" />

      {/* LAYER 2 (Top): Pure frosted backdrop-blur layer to smoothly dissolve scrolling text/images */}
      <div className="absolute inset-0 z-[-1] backdrop-blur-md bg-white/20 pointer-events-none" />

      {/* Row 1: Title + Tabs & Actions */}
      <div className="flex items-center justify-between gap-[16px] w-full">
        <h1 className="text-[24px] font-bold text-[#1f1f1f] tracking-tight truncate">
          {title}
        </h1>

        <div className="flex items-center gap-[12px] shrink-0">
          {tabs?.length > 0 && (
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
          )}
          {actions && (
            <div className="flex items-center gap-[8px] shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Filters (only if present) */}
      {filters && (
        <div className="flex items-center gap-[12px] flex-wrap">
          <div className="flex items-center gap-[12px] flex-wrap flex-1">
            {filters}
          </div>
        </div>
      )}
    </div>
  );
}

export default PageHeader;
