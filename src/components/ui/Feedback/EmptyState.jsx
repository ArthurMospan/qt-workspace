'use client';
import React from 'react';
import { Button } from '../Button';

const CONTEXTS = {
  default: '',
  page: 'min-h-[328px]',
  inset: 'min-h-[280px]',
  flexible: 'flex-1',
  centered: 'm-auto',
};

const DENSITIES = {
  comfortable: 'px-6 py-16',
  compact: 'px-3 py-8',
};

const SURFACES = {
  transparent: '',
  card: 'rounded-[12px] bg-white',
};

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  onAction,
  children,
  context = 'default',
  density = 'comfortable',
  surface = 'transparent',
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${CONTEXTS[context] ?? CONTEXTS.default} ${DENSITIES[density] ?? DENSITIES.comfortable} ${SURFACES[surface] ?? SURFACES.transparent} ${className}`}>
      {/* Premium Circular Icon Wrapper */}
      {IconComponent && (
        <div className="w-[64px] h-[64px] bg-canvas rounded-full flex items-center justify-center mb-[18px] text-faint">
          <IconComponent size={32} />
        </div>
      )}

      {/* Title */}
      {title && (
        <h4 className="text-[16px] font-bold text-ink mb-[6px]">
          {title}
        </h4>
      )}

      {/* Description */}
      {description && (
        <p className="text-muted text-[13px] max-w-[280px] px-4 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && onAction && (
        <div className="mt-5">
          <Button
            style="secondary"
            size="md"
            onClick={onAction}
          >
            {action}
          </Button>
        </div>
      )}

      {children && <div className="mt-5 w-full">{children}</div>}
    </div>
  );
}

export default EmptyState;
