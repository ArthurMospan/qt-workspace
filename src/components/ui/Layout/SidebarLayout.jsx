'use client';
import React from 'react';

export function SidebarLayout({
  sidebar,
  children,
  className = '',
  sidebarWidth = '280px',
  gap = '12px',
  hasBorder = true,
  // Mobile single-pane mode: 'sidebar' shows only the nav, 'content' only the
  // main area (with the caller rendering its own back control). md+ ignores it.
  mobilePane = 'sidebar',
}) {
  return (
    <div className={`flex-1 h-full overflow-hidden bg-white p-[12px] flex ${className}`}>
      <div className="flex-1 flex overflow-hidden" style={{ gap }}>
        {/* Sidebar container */}
        <div
          className={`${mobilePane === 'content' ? 'hidden' : 'flex'} md:flex bg-canvas rounded-[16px] flex-col overflow-hidden shrink-0 w-full md:w-[var(--sbw)]`}
          style={{ '--sbw': sidebarWidth }}
        >
          {sidebar}
        </div>

        {/* Main Content container */}
        <div className={`${mobilePane === 'sidebar' ? 'hidden' : 'flex'} md:flex flex-1 bg-white flex-col overflow-hidden relative rounded-[16px] ${hasBorder ? 'border border-[#f0f0f0]' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default SidebarLayout;
