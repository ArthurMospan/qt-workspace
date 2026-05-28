import React from 'react';
import { colors, sizing, typography, transitions } from '@/lib/design/tokens';
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
    <div
      className={`flex flex-col items-center justify-center text-center gap-4 py-16 px-6 ${className}`}
      style={{
        transitionDuration: transitions.default,
      }}
    >
      {/* Icon */}
      {IconComponent && (
        <div
          className="flex-shrink-0"
          style={{
            color: colors.text.muted,
            opacity: 0.6,
          }}
        >
          <IconComponent size={48} />
        </div>
      )}

      {/* Title */}
      {title && (
        <h3
          className="font-bold"
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.h2.size,
            fontWeight: typography.sizes.h2.weight,
          }}
        >
          {title}
        </h3>
      )}

      {/* Description */}
      {description && (
        <p
          className="max-w-sm"
          style={{
            color: colors.text.muted,
            fontSize: typography.sizes.sm.size,
            fontWeight: typography.sizes.sm.weight,
            lineHeight: '1.5',
          }}
        >
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <div className="mt-4">
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
