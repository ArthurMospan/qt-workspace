'use client';
import { useEffect, useState } from 'react';

/** Перші 500 байтів текстового/кодового файлу. Тільки читання. */
export default function TextThumb({ url }) {
  const [content, setContent] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!canceled) setContent(text.slice(0, 500));
      } catch {
        if (!canceled) setFailed(true);
      }
    })();
    return () => { canceled = true; };
  }, [url]);

  if (failed) return null;
  if (content === null) {
    return (
      <div className="w-full h-[160px] bg-canvas flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-line border-t-muted rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-full h-[160px] bg-ink p-3 overflow-hidden relative select-none">
      <pre className="text-[9px] text-white/60 font-mono leading-tight whitespace-pre-wrap break-all">{content}</pre>
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
    </div>
  );
}
