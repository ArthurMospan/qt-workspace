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
  description,
  headerAction,
  children,
  footer,
  className = '',
  bodyClassName = '',
  size = 'md', // sm, md, lg, xl
  showCloseButton = true,
  presentation = 'sheet', // sheet | dialog
  titleContext = 'section', // section | dialog
  bodyPadding = 'default', // default | spacious | responsive | invite | horizontal | flush
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
    status: 'sm:w-[340px]',
    workspace: 'sm:w-[480px]',
    md: 'sm:w-[560px]',
    lg: 'sm:w-[min(760px,92vw)]',
    xl: 'sm:w-[960px]',
  };
  const isSheet = presentation === 'sheet';
  const titleClass = titleContext === 'dialog'
    ? 'ui-type-dialog-title'
    : titleContext === 'eyebrow'
      ? 'ui-type-eyebrow'
      : 'ui-type-section-title';
  const bodyPaddingClass = {
    default: 'px-6 py-5',
    spacious: 'p-6',
    responsive: 'p-5 sm:p-6',
    invite: 'px-5 py-5 sm:px-7',
    horizontal: 'px-6 py-0',
    flush: 'p-0',
  }[bodyPadding] || 'px-6 py-5';

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
            ? 'max-h-[94dvh] rounded-t-[24px] sm:h-full sm:max-h-none sm:rounded-none'
            : 'max-h-[92vh] rounded-t-[24px] sm:max-h-[90vh] sm:rounded-[24px]'}
          ${sizeClasses[size]}
          ${className}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line shrink-0">
            <div className="min-w-0">
              <h2 id={titleId} className={`${titleClass} text-ink`}>{title}</h2>
              {description ? (
                <p className="mt-0.5 text-[11px] font-medium text-muted">{description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
              {showCloseButton && (
                <Button style="secondary" size="icon-sm" icon={X} iconSize={16} onClick={onClose} aria-label="Закрити" />
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className={`${bodyPaddingClass} overflow-y-auto flex-1 ${bodyClassName}`}>
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
