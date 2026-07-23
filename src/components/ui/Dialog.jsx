'use client';
import { useEffect, useId } from 'react';
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
  bodyClassName = '',
  size = 'md', // sm, md, lg, xl
  showCloseButton = true,
  presentation = 'sheet', // sheet | dialog
}) {
  const titleId = useId();

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
    sm: 'sm:w-[440px]',
    md: 'sm:w-[560px]',
    lg: 'sm:w-[720px]',
    xl: 'sm:w-[960px]',
  };
  const isSheet = presentation === 'sheet';

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm ${
        isSheet
          ? 'items-end justify-end sm:items-stretch'
          : 'items-end justify-center p-0 sm:items-center sm:p-4'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`
          bg-white shadow-[0_25px_70px_rgba(0,0,0,0.18)]
          w-full flex flex-col overflow-hidden
          pb-[env(safe-area-inset-bottom)] sm:pb-0
          ${isSheet
            ? 'max-h-[94dvh] rounded-t-[24px] sm:h-full sm:max-h-none sm:rounded-none sm:rounded-l-[24px]'
            : 'max-h-[92vh] rounded-t-[24px] sm:max-h-[90vh] sm:rounded-[24px]'}
          ${sizeClasses[size]}
          ${className}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
            <h2 id={titleId} className="text-[16px] font-bold text-ink">{title}</h2>
            {showCloseButton && (
              <Button style="secondary" size="icon" icon={X} onClick={onClose} aria-label="Закрити" />
            )}
          </div>
        )}

        {/* Body */}
        <div className={`px-6 py-5 overflow-y-auto flex-1 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-canvas shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
