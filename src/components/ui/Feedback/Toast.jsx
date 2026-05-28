import React, { useEffect, useState } from 'react';
import { colors, sizing, typography, transitions, zIndex } from '@/lib/design/tokens';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
} from 'lucide-react';

const variantConfig = {
  info: {
    bg: colors.statusBg.info,
    text: '#1e40af',
    icon: AlertCircle,
    iconColor: colors.status.info,
  },
  success: {
    bg: colors.statusBg.success,
    text: '#065f46',
    icon: CheckCircle,
    iconColor: colors.status.success,
  },
  warning: {
    bg: colors.statusBg.warning,
    text: '#92400e',
    icon: AlertTriangle,
    iconColor: colors.status.warning,
  },
  error: {
    bg: colors.statusBg.error,
    text: '#7f1d1d',
    icon: XCircle,
    iconColor: colors.status.error,
  },
  loading: {
    bg: colors.statusBg.info,
    text: '#1e40af',
    icon: Loader2,
    iconColor: colors.status.info,
  },
};

export function Toast({
  variant = 'info',
  message,
  action,
  onAction,
  autoClose = 3000,
  onClose,
}) {
  const [isVisible, setIsVisible] = useState(true);
  const config = variantConfig[variant] || variantConfig.info;
  const IconComponent = config.icon;

  useEffect(() => {
    if (autoClose && variant !== 'loading') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, autoClose);

      return () => clearTimeout(timer);
    }
  }, [autoClose, variant, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg border border-solid animate-slideInRight"
      style={{
        backgroundColor: colors.surface,
        borderColor: config.bg,
        borderWidth: '1px',
        zIndex: zIndex.notification,
        animation: `slideInRight ${transitions.default} ${transitions.timing}`,
        maxWidth: '360px',
      }}
    >
      {/* Icon */}
      {variant === 'loading' ? (
        <IconComponent
          size={sizing.icon.md}
          style={{
            color: config.iconColor,
            flexShrink: 0,
            animation: 'spin 1s linear infinite',
          }}
        />
      ) : (
        <IconComponent
          size={sizing.icon.md}
          style={{ color: config.iconColor, flexShrink: 0 }}
        />
      )}

      {/* Message */}
      <div className="flex-1">
        <p
          className="text-sm"
          style={{ color: config.text, fontSize: typography.sizes.sm.size }}
        >
          {message}
        </p>
      </div>

      {/* Action Button */}
      {action && (
        <button
          onClick={() => {
            onAction?.();
            setIsVisible(false);
            onClose?.();
          }}
          className="px-3 py-1 rounded text-sm font-bold whitespace-nowrap hover:opacity-80 transition-opacity focus:outline-none focus:ring-2"
          style={{
            color: config.iconColor,
            backgroundColor: config.bg,
            fontSize: typography.sizes.xs.size,
            transitionDuration: transitions.default,
          }}
        >
          {action}
        </button>
      )}

      {/* Close Button */}
      <button
        onClick={() => {
          setIsVisible(false);
          onClose?.();
        }}
        className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity focus:outline-none focus:ring-2"
        style={{
          color: colors.text.muted,
          transitionDuration: transitions.default,
        }}
        aria-label="Close toast"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default Toast;
