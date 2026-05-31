'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function TaskAttributesPanel({
  primaryChildren,
  secondaryChildren,
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`relative overflow-visible w-full ${secondaryChildren ? 'mb-[24px]' : ''} ${className}`}>
      {/* Main card containing attributes */}
      <div className="bg-[#f4f4f5] rounded-[16px] px-5 py-3.5 flex flex-col gap-3 relative z-10">
        {/* Primary Row */}
        <div className="flex flex-wrap items-center gap-y-4 gap-x-6 overflow-visible">
          {primaryChildren}
        </div>

        {/* Collapsible Secondary Drawer */}
        {secondaryChildren && isExpanded && (
          <div className="flex flex-wrap items-center gap-y-4 gap-x-6 pt-3 border-t border-[#e9e9e9] overflow-visible animate-in slide-in-from-top-2 duration-200">
            {secondaryChildren}
          </div>
        )}
      </div>

      {/* Expand/Collapse Trigger Bar layered underneath */}
      {secondaryChildren && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute left-0 right-0 bottom-[-16px] h-[28px] bg-[#e4e4e7] hover:bg-[#d4d4d8] rounded-b-[16px] flex items-center justify-center text-[#666666] hover:text-[#1f1f1f] transition-all cursor-pointer z-0"
        >
          {isExpanded ? <ChevronUp size={12} className="mt-[12px]" /> : <ChevronDown size={12} className="mt-[12px]" />}
        </button>
      )}
    </div>
  );
}
