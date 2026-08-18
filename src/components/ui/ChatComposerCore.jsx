'use client';

import { useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { ArrowUp, Send } from 'lucide-react';

const VARIANTS = {
  workspace: {
    // A border *and* a focus shadow drew two concentric outlines around the
    // same box. The task-page composer below already solved this with one ring
    // that thickens; the workspace chat now wears exactly that, keeping only
    // its own corner radius and textarea geometry.
    shell: 'overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.04] transition-all hover:ring-black/10 focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
    textarea: 'w-full px-4 py-3.5 text-[14px] text-ink placeholder-[#b0b0b0] bg-transparent outline-none resize-none max-h-[200px] leading-relaxed',
  },
  timeline: {
    shell: 'overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.04] transition-all hover:ring-black/10 focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
    textarea: 'custom-scrollbar min-h-[36px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-[14px] leading-5 text-ink outline-none placeholder:text-muted',
  },
  qtplus: {
    shell: 'flex min-h-[44px] items-end gap-1 rounded-[24px] bg-white p-1 ring-1 ring-black/[0.04] transition-all focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
    textarea: 'max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-5 text-ink outline-none placeholder:text-muted disabled:opacity-50',
  },
};

const ROUND_SEND_CLASS = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105 disabled:bg-[#cfcfcf] disabled:hover:scale-100';

// How tall the field may grow before it starts scrolling instead, per variant.
// It is the one number the growth needs and the only thing the three chats
// disagreed about.
const MAX_HEIGHT = { workspace: 200, timeline: 120, qtplus: 120 };

const Spinner = ({ className = '' }) => (
  <span className={`h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white ${className}`} />
);

/**
 * The message input itself, shared by all three chats — workspace, timeline and
 * QuickTeam+. Each of them had its own copy of the ring, the growth behaviour
 * and the send button; the three had already drifted, so the geometry lives
 * here and the caller picks a `variant` rather than restating it.
 *
 * @param {string} props.value Draft text.
 * @param {(value: string) => void} props.onChange Fires with the new draft.
 * @param {() => void} props.onSubmit Sends it.
 * @param {'workspace'|'timeline'|'qtplus'} props.variant Which chat this is; changes the frame, not the behaviour.
 * @param {string} props.placeholder Text shown while empty.
 * @param {number} props.rows Initial visible rows before it grows.
 * @param {boolean} props.disabled Unavailable: the field and the send button are both blocked.
 * @param {boolean} props.sending In flight: the send button shows the wait.
 * @param {boolean} props.canSubmit Whether sending is currently allowed at all.
 * @param {React.ReactNode} props.leading Controls before the field — the attach button.
 * @param {React.ReactNode} props.toolbar Controls under the field.
 * @param {React.ReactNode} props.attachments Pending attachments, drawn above the field.
 * @param {string} props.sendLabel Visible label on the send button, where it has one.
 * @param {string} props.sendAriaLabel Accessible name for the icon-only send button.
 * @param {React.Ref} props.textareaRef Ref to the textarea, for mention menus and focus handling.
 * @param {React.CSSProperties} props.textareaStyle Inline style for the textarea, for measured heights.
 * @param {(event) => void} props.onKeyDown Key handler; this is where mention navigation hooks in.
 * @param {(event) => void} props.onBlur Blur handler.
 * @param {(event) => void} props.onClick Click handler on the field.
 * @param {string} props.textareaClassName Placement of the textarea only.
 */
export default function ChatComposerCore({
  variant = 'workspace',
  textareaRef,
  value,
  onChange,
  onKeyDown,
  onClick,
  onBlur,
  placeholder,
  disabled = false,
  rows = 1,
  textareaStyle,
  textareaClassName = '',
  attachments,
  leading,
  toolbar,
  onSubmit,
  canSubmit = Boolean(value?.trim()),
  sending = false,
  sendLabel = 'Надіслати',
  sendAriaLabel = sendLabel,
}) {
  const composer = VARIANTS[variant] || VARIANTS.workspace;
  const sendDisabled = !canSubmit || sending || disabled;

  // The field grows with what is in it — measured here, from `value`, rather
  // than in each caller's `onChange`. Doing it on the event meant it only ever
  // grew for text somebody typed: opening a long message for editing put a
  // whole paragraph into a two-line box that had to be scrolled, because
  // nothing about that assignment was an input event. Same for a draft
  // restored, a mention inserted by the picker, or text pasted by script.
  const innerRef = useRef(null);
  const setTextareaRef = useCallback(node => { innerRef.current = node; }, []);
  useImperativeHandle(textareaRef, () => innerRef.current, []);
  useLayoutEffect(() => {
    const field = innerRef.current;
    if (!field) return;
    const max = MAX_HEIGHT[variant] || MAX_HEIGHT.workspace;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, max)}px`;
    field.style.overflowY = field.scrollHeight > max ? 'auto' : 'hidden';
  }, [value, variant]);

  const textarea = (
    <textarea
      ref={setTextareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={textareaStyle}
      className={`${composer.textarea} ${textareaClassName}`.trim()}
    />
  );

  if (variant === 'workspace') {
    return (
      <div className={composer.shell}>
        {attachments}
        {textarea}
        <div className="flex items-center justify-between border-t border-[#f0f0f0] px-3 pb-3 pt-2">
          <div className="flex items-center gap-1">{toolbar}</div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={sendDisabled}
            aria-label={sendAriaLabel}
            className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-[13px] font-semibold transition-all ${
              sendDisabled
                ? 'cursor-not-allowed bg-[#f0f0f0] text-[#b0b0b0]'
                : 'bg-ink text-white shadow-sm hover:bg-[#333] active:scale-95'
            }`}
          >
            {sending ? <Spinner /> : <Send size={14} />}
            <span>{sending ? 'Надсилання…' : sendLabel}</span>
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'timeline') {
    return (
      <div className={composer.shell}>
        {attachments}
        <div className="flex min-h-[44px] items-end gap-0 p-1">
          {leading}
          {textarea}
          <button
            type="button"
            onClick={onSubmit}
            disabled={sendDisabled}
            aria-label={sendAriaLabel}
            className={ROUND_SEND_CLASS}
          >
            {sending ? <Spinner /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={composer.shell}>
      {textarea}
      <button
        type="button"
        onClick={onSubmit}
        disabled={sendDisabled}
        aria-label={sendAriaLabel}
        className={ROUND_SEND_CLASS}
      >
        <ArrowUp size={16} />
      </button>
    </div>
  );
}
