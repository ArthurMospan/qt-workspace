'use client';
import React from 'react';

export function SidebarLayout({
  sidebar,
  children,
  className = '',
  sidebarWidth = '280px',
  gap = '12px',
  hasBorder = true,
}) {
  return (
    <div className={`flex-1 h-full overflow-hidden bg-white p-[12px] flex ${className}`}>
      <div className="flex-1 flex overflow-hidden" style={{ gap }}>
        {/* Sidebar container */}
        <div 
          className="bg-[#f4f4f5] rounded-[16px] flex flex-col overflow-hidden shrink-0"
          style={{ width: sidebarWidth }}
        >
          {sidebar}
        </div>
        
        {/* Main Content container */}
        <div className={`flex-1 bg-white flex flex-col overflow-hidden relative rounded-[16px] ${hasBorder ? 'border border-[#f0f0f0]' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default SidebarLayout;
