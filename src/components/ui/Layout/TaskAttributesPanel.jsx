'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function TaskAttributesPanel({
  primaryChildren,
  secondaryChildren,
  className = '',
  cardClassName = '',
  cardStyle,
  primaryClassName = '',
  singleRow = false,
  compact = false,
  condensed = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`relative overflow-visible w-full ${secondaryChildren ? 'mb-[24px]' : ''} ${className}`}>
      {/* Main card containing attributes */}
      <div
        className={`bg-canvas rounded-[14px] ${condensed ? 'px-2 py-1.5' : compact ? 'px-2.5 py-2' : 'px-4 py-3'} flex flex-col gap-3 relative z-10 ${cardClassName}`}
        style={cardStyle}
      >
        {/* Primary Row */}
        <div className={primaryClassName || (singleRow
          ? 'grid w-full grid-cols-[minmax(90px,1fr)_minmax(105px,1.15fr)_minmax(105px,1.1fr)_minmax(82px,.8fr)_minmax(72px,.7fr)_minmax(92px,.8fr)_minmax(128px,1.2fr)] items-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] lg:overflow-visible [&::-webkit-scrollbar]:hidden [&>*]:!min-w-0'
          : 'flex flex-wrap items-center gap-y-4 gap-x-6 overflow-visible')}>
          {primaryChildren}
        </div>

        {/* Collapsible Secondary Drawer */}
        {secondaryChildren && isExpanded && (
          <div className="flex flex-wrap items-center gap-y-4 gap-x-6 pt-3 border-t border-line overflow-visible animate-in slide-in-from-top-2 duration-200">
            {secondaryChildren}
          </div>
        )}
      </div>

      {/* Expand/Collapse Trigger Bar layered underneath */}
      {secondaryChildren && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute left-0 right-0 bottom-[-16px] h-[28px] bg-[#e4e4e7] hover:bg-[#d4d4d8] rounded-b-[16px] flex items-center justify-center text-[#666666] hover:text-ink transition-all cursor-pointer z-0"
        >
          {isExpanded ? <ChevronUp size={12} className="mt-[12px]" /> : <ChevronDown size={12} className="mt-[12px]" />}
        </button>
      )}
    </div>
  );
}
