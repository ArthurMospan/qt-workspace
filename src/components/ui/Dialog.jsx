'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

// ─── UI Kit: Dialog — the one shared modal shell ─────────────────────────────
// Every modal in the app should render through this component so header
// (title + close button) and footer (action bar) always look the same.
// `size`/`className` are the only things meant to vary per-modal — see
// CLAUDE.md UI Kit policy: content differs, chrome doesn't.
//
// const [open, setOpen] = useState(false);
// <Dialog isOpen={open} onClose={() => setOpen(false)} title="Новий спринт"
//   footer={<>
//     <Button style="secondary" size="md" onClick={() => setOpen(false)}>Скасувати</Button>
//     <Button style="primary" size="md" onClick={handleSave}>Зберегти</Button>
//   </>}>
//   ...form fields...
// </Dialog>

export default function Dialog({
  isOpen,
  onClose,
  title,
  children,
  footer,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`
          bg-white rounded-[24px] shadow-[0_25px_50px_rgba(0,0,0,0.15)]
          w-full flex flex-col max-h-[90vh] overflow-hidden
          ${sizeClasses[size]}
          ${className}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e9e9e9] shrink-0">
            <h2 className="text-[16px] font-bold text-[#1f1f1f]">{title}</h2>
            {showCloseButton && (
              <Button style="secondary" size="icon" icon={X} onClick={onClose} aria-label="Закрити" />
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#e9e9e9] flex justify-end gap-3 bg-[#f4f4f5] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
