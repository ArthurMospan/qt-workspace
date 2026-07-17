'use client';
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

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
    <div className="flex items-end gap-2 border-t border-line px-3 py-2">
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={stopTyping}
        disabled={disabled}
        rows={1}
        placeholder={disabled ? 'Немає доступу' : 'Напишіть повідомлення…'}
        className="flex-1 resize-none max-h-[96px] text-[13px] text-ink placeholder:text-faint bg-transparent outline-none py-1 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim() || sending || disabled}
        aria-label="Надіслати"
        className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-ink-hover transition-colors"
      >
        <Send size={15} />
      </button>
    </div>
  );
}
