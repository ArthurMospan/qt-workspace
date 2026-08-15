'use client';
import { useId, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import { useModalFocus } from '@/lib/hooks/useModalFocus';
import { useOverlayHistory } from '@/lib/hooks/useOverlayHistory';

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

/**
 * The kit's modal. Every dialog in the product is this component — the shell,
 * the overlay, the focus trap and the escape key all live here, so no screen
 * builds its own.
 *
 * @param {boolean} props.isOpen Whether it is on screen. The dialog renders nothing when false.
 * @param {() => void} props.onClose Closes it: the ×, the overlay and Escape all call this.
 * @param {string} props.title Headline.
 * @param {string} props.description Sentence under the headline.
 * @param {React.ReactNode} props.children Body.
 * @param {React.ReactNode} props.footer Actions along the bottom.
 * @param {React.ReactNode} props.headerAction A control in the top-right, beside the close button.
 * @param {string} props.size Width token.
 * @param {string} props.bodyPadding Inner spacing of the body.
 * @param {'dialog'|'eyebrow'} props.titleContext Type scale of the headline.
 * @param {'dialog'|'sheet'} props.presentation Centred dialog, or a sheet from the edge.
 * @param {boolean} props.showCloseButton Whether the × is drawn.
 * @param {string} props.bodyClassName Placement of the body only.
 * @param {string} props.className Placement of the shell only.
 * @param {boolean} props.isDirty Whether closing should confirm unsaved changes.
 * @param {string} props.closeConfirmation Confirmation shown for an unsaved draft.
 */
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
  isDirty = false,
  closeConfirmation,
}) {
  const titleId = useId();
  const requestClose = useOverlayHistory({ isOpen, onClose, isDirty, closeConfirmation });
  const dialogRef = useModalFocus({ isOpen, onClose: requestClose });
  // A click is only a click-away when the press *started* on the backdrop.
  // Without this, selecting text inside the dialog and releasing the mouse
  // outside it fires `click` on the nearest common ancestor — the backdrop —
  // and the dialog closed mid-edit. That is what discarded a set of AI drafts
  // in the audio tab: the panel is nothing but long text fields, so dragging a
  // selection past the edge of the sheet is the normal way to use it.
  const pressStartedOnBackdrop = useRef(false);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:w-[440px]',
    status: 'sm:w-[340px]',
    md: 'sm:w-[560px]',
    lg: 'sm:w-[min(760px,92vw)]',
  };
  const isSheet = presentation === 'sheet';
  const titleClass = titleContext === 'dialog'
    ? 'ui-type-dialog-title'
    : titleContext === 'eyebrow'
      ? 'ui-type-eyebrow'
      : 'ui-type-section-title';
  const bodyPaddingClass = {
    default: 'px-5 py-5 sm:px-6',
    spacious: 'p-5 sm:p-6',
    responsive: 'p-5 sm:p-6',
    invite: 'px-5 py-5 sm:px-7',
    horizontal: 'px-6 py-0',
    flush: 'p-0',
  }[bodyPadding] || 'px-6 py-5';

  return (
    <div
      // The click-away. It is the same element that centres the dialog, so it
      // cannot be hidden from the accessibility tree — that would hide the
      // dialog with it. It stays a plain container with a shortcut on it:
      // everything it does is also done by the close button and by Escape, and
      // making it focusable would put a nameless stop in front of every dialog
      // in the product.
      className={`fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm ${
        isSheet
          ? 'items-end justify-end sm:items-stretch'
          : 'items-end justify-center p-0 sm:items-center sm:p-4'
      }`}
      onPointerDown={event => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={event => {
        const startedOutside = pressStartedOnBackdrop.current;
        pressStartedOnBackdrop.current = false;
        if (startedOutside && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
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
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line shrink-0 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className={`${titleClass} text-ink`}>{title}</h2>
              {description ? (
                <p className="mt-0.5 text-[11px] font-medium text-muted">{description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
              {showCloseButton && (
                <Button style="secondary" size="icon-sm" icon={X} onClick={requestClose} aria-label="Закрити" />
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
          <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-line bg-canvas px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
