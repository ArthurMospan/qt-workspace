'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Dialog({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'md', // sm, md, lg, xl
  showCloseButton = true,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-[480px]',
    md: 'max-w-[640px]',
    lg: 'max-w-[900px]',
    xl: 'max-w-[1200px]',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-12 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`
          bg-white rounded-[24px] shadow-[0_25px_50px_rgba(0,0,0,0.15)]
          w-full mx-4
          ${sizeClasses[size]}
          ${className}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0] shrink-0">
            <h2 className="text-[18px] font-bold text-[#1f1f1f]">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f4f4f5] rounded-[8px] transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[calc(100vh-200px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
