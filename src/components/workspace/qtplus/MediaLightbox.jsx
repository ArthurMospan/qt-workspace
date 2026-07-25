'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Повноекранний перегляд. Escape і клік по підкладці закривають. Тільки читання. */
export default function MediaLightbox({ view, onClose }) {
  useEffect(() => {
    if (!view) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [view, onClose]);

  if (!view) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={view.title}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Закрити"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <X size={18} />
      </button>

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {!view.url && view.kind !== 'note' && (
          <div className="bg-surface rounded-[16px] px-6 py-8 max-w-[420px] text-center">
            <p className="text-[13px] text-muted">Файл недоступний.</p>
          </div>
        )}
        {view.kind === 'image' && view.url && (
          // eslint-disable-next-line @next/next/no-img-element -- portal media is served from arbitrary partner hosts, which next/image cannot whitelist
          <img src={view.url} alt={view.title} className="max-w-[90vw] max-h-[80vh] object-contain rounded-[12px]" />
        )}
        {view.kind === 'video' && view.url && (
          <video src={view.url} controls autoPlay className="max-w-[90vw] max-h-[80vh] rounded-[12px]" />
        )}
        {view.kind === 'pdf' && view.url && (
          <iframe src={view.url} title={view.title} className="w-[90vw] h-[80vh] rounded-[12px] bg-white border-0" />
        )}
        {view.kind === 'text' && view.url && (
          <iframe src={view.url} title={view.title} className="w-[70vw] h-[80vh] rounded-[12px] bg-white border-0" />
        )}
        {view.kind === 'note' && (
          <div className="bg-surface rounded-[16px] p-6 max-w-[640px] max-h-[80vh] overflow-y-auto">
            <p className="text-[15px] text-ink whitespace-pre-wrap">{view.note.content}</p>
            {view.note.source && <p className="text-[12px] text-muted mt-3 italic">Джерело: {view.note.source}</p>}
          </div>
        )}
        <p className="text-[13px] text-white/70">{view.title}</p>
      </div>
    </div>
  );
}
