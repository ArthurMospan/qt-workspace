'use client';
import React from 'react';
import { Button } from '../Button';

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {/* Premium Circular Icon Wrapper */}
      {IconComponent && (
        <div className="w-[64px] h-[64px] bg-[#f4f4f5] rounded-full flex items-center justify-center mb-[18px] text-[#cfcfcf]">
          <IconComponent size={32} />
        </div>
      )}

      {/* Title */}
      {title && (
        <h4 className="text-[16px] font-bold text-[#1f1f1f] mb-[6px]">
          {title}
        </h4>
      )}

      {/* Description */}
      {description && (
        <p className="text-[#9a9a9a] text-[13px] max-w-[280px] px-4 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && onAction && (
        <div className="mt-5">
          <Button
            style="secondary"
            color="blue"
            size="md"
            onClick={onAction}
          >
            {action}
          </Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
