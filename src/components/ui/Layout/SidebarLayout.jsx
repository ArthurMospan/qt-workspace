'use client';
import React from 'react';

// The two-pane workspace shell: a canvas-coloured rail beside a white pane.
//
// Three screens are built on this and only one of them used to say so. Settings
// called this component; Chat and Team each hand-wrote the same shell, which is
// how they drifted — Chat spelled the gutter `gap-3` and Settings `gap: '12px'`
// (the same 12px, twice), and the two screens that sit under the fixed 56px
// header each remembered that offset on their own. A layout is a kit decision
// like any other, so the differences are named here instead of being retyped.
//
// `wrapsContent` is the white pane the shell draws for you. Chat supplies its
// own panes — a conversation and a thread rail, side by side — so it opts out
// and its children become direct flex siblings of the rail.
export const CONTEXTS = {
  // Owns the full viewport; nothing is fixed above it.
  settings: {
    shell: 'flex-1 h-full overflow-hidden bg-white p-[12px] flex',
    wrapsContent: true,
  },
  // Sits under the fixed WorkspaceHeader, so the shell reserves its height.
  // Team's right pane is a `Surface preset="panel"`, not the plain white pane,
  // so it renders its own — the shell owns the rail and the gutter only.
  team: {
    shell: 'flex w-full h-full overflow-hidden bg-white p-[12px] pt-[56px]',
    wrapsContent: false,
  },
  chat: {
    shell: 'flex-1 flex overflow-hidden p-[12px] pt-[56px]',
    wrapsContent: false,
  },
};

export function SidebarLayout({
  sidebar,
  children,
  context = 'settings',
  className = '',
  sidebarWidth = '280px',
  gap = '12px',
  hasBorder = true,
  // Mobile single-pane mode: 'sidebar' shows only the nav, 'content' only the
  // main area (with the caller rendering its own back control). md+ ignores it.
  mobilePane = 'sidebar',
}) {
  const { shell, wrapsContent } = CONTEXTS[context] || CONTEXTS.settings;

  return (
    <div className={`${shell} ${className}`}>
      <div className="flex-1 flex overflow-hidden" style={{ gap }}>
        {/* Sidebar container */}
        <div
          className={`${mobilePane === 'content' ? 'hidden' : 'flex'} md:flex bg-canvas rounded-[16px] flex-col overflow-hidden shrink-0 w-full md:w-[var(--sbw)]`}
          style={{ '--sbw': sidebarWidth }}
        >
          {sidebar}
        </div>

        {/* Main Content container */}
        {wrapsContent ? (
          <div className={`${mobilePane === 'sidebar' ? 'hidden' : 'flex'} md:flex flex-1 bg-white flex-col overflow-hidden relative rounded-[16px] ${hasBorder ? 'border border-[#f0f0f0]' : ''}`}>
            {children}
          </div>
        ) : children}
      </div>
    </div>
  );
}

export default SidebarLayout;
