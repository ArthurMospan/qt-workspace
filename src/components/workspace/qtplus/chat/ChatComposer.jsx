'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const TYPING_IDLE_MS = 3000;

/**
 * Поле вводу чату. Enter — надіслати (Shift+Enter — новий рядок).
 * Керує typing: setTyping(true) на початку набору, setTyping(false) після
 * паузи або надсилання. onSend/onTyping приходять від панелі.
 */
export default function ChatComposer({ onSend, onTyping, disabled }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const typingRef = useRef(false);
  const idleTimer = useRef(null);

  const stopTyping = () => {
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    if (typingRef.current) { typingRef.current = false; onTyping?.(false); }
  };

  // Знімаємо typing, якщо компонент зникає (зміна проєкту / розмонтування).
  useEffect(() => stopTyping, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    setText(e.target.value);
    if (disabled) return;
    if (!typingRef.current && e.target.value.trim()) {
      typingRef.current = true;
      onTyping?.(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    stopTyping();
    try {
      await onSend(body);
      setText('');
    } catch (e) {
      console.error('[qtplus] send failed:', e?.message);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 px-4 pb-5 pt-3">
      <div className="flex min-h-[44px] items-end gap-1 rounded-[24px] bg-white p-1 ring-1 ring-black/[0.04] transition-all focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Немає доступу' : 'Повідомлення…'}
          className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-5 text-ink outline-none placeholder:text-muted disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || sending || disabled}
          aria-label="Надіслати"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105 disabled:bg-[#cfcfcf] disabled:hover:scale-100"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}
