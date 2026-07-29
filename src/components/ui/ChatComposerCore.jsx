'use client';

import { ArrowUp, Send } from 'lucide-react';

const VARIANTS = {
  workspace: {
    shell: 'overflow-hidden rounded-2xl border border-line bg-white transition-all hover:border-[#cfcfcf] focus-within:border-[#cfcfcf] focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
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
  const textarea = (
    <textarea
      ref={textareaRef}
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
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send size={14} />
            )}
            <span>{sendLabel}</span>
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
            <ArrowUp size={16} />
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
