'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, X, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { GLOBAL_NOTIFICATION_Z_INDEX } from '@/lib/utils/overlayLayers.mjs';

/**
 * Transient feedback that something happened, floating above the page and
 * closing itself. Anything the reader has to act on is an `Alert`, which stays.
 *
 * @param {'info'|'success'|'error'|'warning'|'loading'} props.variant Colour, icon and meaning.
 * @param {string} props.message What happened.
 * @param {string} props.action Label of the single inline action (usually "Скасувати").
 * @param {() => void} props.onAction Handler for that action.
 * @param {number} props.autoClose Milliseconds before it closes itself; 0 keeps it until dismissed.
 * @param {() => void} props.onClose Fires when it closes, by timer or by the ×.
 */
export function Toast({
  variant = 'info', // success, error, warning, info, loading
  message,
  action,
  onAction,
  autoClose = 3000,
  onClose,
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose && variant !== 'loading') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, variant, onClose]);

  if (!isVisible) return null;

  const isError = variant === 'error' || variant === 'danger';
  const isWarning = variant === 'warning';
  const isLoading = variant === 'loading';
  const isSuccess = variant === 'success';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-qt-global-notification-layer
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className="pointer-events-none fixed bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center"
      style={{ zIndex: GLOBAL_NOTIFICATION_Z_INDEX }}
    >
      <div 
        className="flex items-center gap-3 bg-ink text-white px-5 py-3 rounded-[12px] shadow-xl text-[13px] font-medium pointer-events-auto transition-all"
        style={{ animation: 'toastSlideUp 0.2s ease-out' }}
      >
        {isSuccess && <CheckCircle size={15} className="text-green-400 shrink-0" />}
        {isError && <AlertCircle size={15} className="text-red-400 shrink-0" />}
        {isWarning && <AlertTriangle size={15} className="text-yellow-400 shrink-0" />}
        {!isSuccess && !isError && !isWarning && !isLoading && <Info size={15} className="text-blue-400 shrink-0" />}
        {isLoading && <Loader2 size={15} className="text-blue-400 shrink-0 animate-spin" />}
        
        <span>{message}</span>

        {action && onAction && (
          <button 
            onClick={() => {
              onAction();
              setIsVisible(false);
              onClose?.();
            }}
            className="text-blue-400 hover:text-blue-300 font-bold ml-2 text-[11px] transition-colors"
          >
            {action}
          </button>
        )}

        <button
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          aria-label="Закрити сповіщення"
          className="text-white/40 hover:text-white/80 ml-1 transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <style>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

export default Toast;
