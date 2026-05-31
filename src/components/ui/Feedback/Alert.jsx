import React from 'react';
import { colors, sizing, typography, transitions } from '@/lib/design/tokens';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';

const variantConfig = {
  info: {
    bg: colors.statusBg.info,
    border: colors.status.info,
    text: '#1e40af',
    icon: AlertCircle,
    iconColor: colors.status.info,
  },
  success: {
    bg: colors.statusBg.success,
    border: colors.status.success,
    text: '#065f46',
    icon: CheckCircle,
    iconColor: colors.status.success,
  },
  warning: {
    bg: colors.statusBg.warning,
    border: colors.status.warning,
    text: '#92400e',
    icon: AlertTriangle,
    iconColor: colors.status.warning,
  },
  error: {
    bg: colors.statusBg.error,
    border: colors.status.error,
    text: '#7f1d1d',
    icon: XCircle,
    iconColor: colors.status.error,
  },
  danger: {
    bg: colors.statusBg.danger,
    border: colors.status.danger,
    text: '#7f1d1d',
    icon: XCircle,
    iconColor: colors.status.danger,
  },
};

export function Alert({
  variant = 'info',
  title,
  description,
  children,
  onClose,
  className = '',
}) {
  const config = variantConfig[variant] || variantConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      className={`flex items-start gap-3 rounded-[8px] p-4 min-h-9 border-l-4 transition-all ${className}`}
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        transitionDuration: transitions.default,
      }}
    >
      {/* Icon */}
      <IconComponent
        size={sizing.icon.md}
        style={{ color: config.iconColor, flexShrink: 0, marginTop: '2px' }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <div
            className="font-bold text-sm"
            style={{ color: config.text, fontSize: typography.sizes.sm.size }}
          >
            {title}
          </div>
        )}
        {(children || description) && (
          <div
            className="text-sm mt-1"
            style={{ color: config.text, fontSize: typography.sizes.sm.size }}
          >
            {children || description}
          </div>
        )}
      </div>

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            color: config.text,
            transitionDuration: transitions.default,
          }}
          aria-label="Close alert"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export default Alert;
