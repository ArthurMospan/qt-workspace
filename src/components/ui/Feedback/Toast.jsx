'use client';
import React, { useEffect, useState } from 'react';
import { CheckCircle, X, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

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

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none flex flex-col items-center">
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
    </div>
  );
}

export default Toast;
