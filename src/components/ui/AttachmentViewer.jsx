'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, FileText, X, ZoomIn, ZoomOut } from 'lucide-react';

function getUrl(attachment) {
  return attachment?.previewUrl || attachment?.url || attachment?.downloadUrl || attachment?.downloadURL || attachment?.audioUrl || '';
}

// Cloudinary forces a download (rather than inline view) when the delivery URL
// carries the fl_attachment flag. For any other host we fall back to the raw
// URL + the download attribute.
function downloadUrlFor(url) {
  if (typeof url === 'string' && url.includes('/upload/') && url.includes('res.cloudinary.com')) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

function getKind(attachment) {
  const type = (attachment?.resourceType || attachment?.type || attachment?.mimeType || '').toLowerCase();
  const source = `${attachment?.name || ''} ${getUrl(attachment)}`;
  if (type === 'image' || type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif|tiff?)(?:[?#]|$)/i.test(source)) return 'image';
  if (type === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(source)) return 'pdf';
  if (type === 'video' || type.startsWith('video/') || /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(source)) return 'video';
  if (type === 'audio' || type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)(?:[?#]|$)/i.test(source)) return 'audio';
  return 'file';
}

/**
 * Full-screen viewer for one attachment — image, PDF, or the download card for
 * anything the browser cannot render.
 *
 * @param {object} props.attachment The file to show; `null` closes the viewer.
 * @param {() => void} props.onClose Closes it.
 */
export default function AttachmentViewer({ attachment, onClose }) {
  const [scale, setScale] = useState(1);
  const url = getUrl(attachment);
  const kind = useMemo(() => getKind(attachment), [attachment]);
  const name = attachment?.name || 'Вкладення';

  useEffect(() => {
    if (!attachment) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (kind === 'image' && (event.key === '+' || event.key === '=')) setScale(value => Math.min(3, value + 0.25));
      if (kind === 'image' && event.key === '-') setScale(value => Math.max(0.5, value - 0.25));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [attachment, kind, onClose]);

  if (!attachment || !url || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-ui-overlay="media-viewer"
      className="fixed inset-0 z-[200] flex flex-col bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label={`Перегляд: ${name}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black/35 px-4 text-white">
        <FileText size={18} className="shrink-0 text-white/65" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</span>
        {kind === 'image' && (
          <div className="flex items-center gap-1" aria-label="Масштаб зображення">
            <button data-ui-control="media-action" type="button" onClick={() => setScale(value => Math.max(0.5, value - 0.25))} className="rounded-[7px] p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Зменшити"><ZoomOut size={17} /></button>
            <button
              type="button"
              onClick={() => setScale(1)}
              disabled={scale === 1}
              className="min-w-12 rounded-[7px] px-2 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:text-white/35 disabled:hover:bg-transparent"
              aria-label={`Поточний масштаб ${Math.round(scale * 100)}%. Скинути до 100%`}
              title={scale === 1 ? 'Зображення вже має масштаб 100%' : 'Скинути масштаб до 100%'}
            >
              {Math.round(scale * 100)}%
            </button>
            <button data-ui-control="media-action" type="button" onClick={() => setScale(value => Math.min(3, value + 0.25))} className="rounded-[7px] p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Збільшити"><ZoomIn size={17} /></button>
          </div>
        )}
        <a href={downloadUrlFor(url)} download={name} className="rounded-[7px] p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Завантажити" title="Завантажити"><Download size={17} /></a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-[7px] p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Відкрити оригінал" title="Відкрити оригінал"><ExternalLink size={17} /></a>
        <button data-ui-control="media-action" type="button" onClick={onClose} className="rounded-[7px] p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Закрити"><X size={19} /></button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="max-h-full max-w-full select-none object-contain transition-transform duration-150" style={{ transform: `scale(${scale})` }} />
        )}
        {kind === 'pdf' && <iframe src={url} title={name} className="h-full w-full max-w-6xl rounded-[8px] bg-white" />}
        {kind === 'video' && <video src={url} controls autoPlay className="max-h-full max-w-full" />}
        {kind === 'audio' && <audio src={url} controls autoPlay className="w-full max-w-xl" />}
        {kind === 'file' && (
          <div data-ui-surface="local" className="flex max-w-sm flex-col items-center gap-4 rounded-[8px] bg-white p-8 text-center">
            <FileText size={40} className="text-muted" />
            <p className="max-w-full break-words text-[14px] font-semibold text-ink">{name}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[7px] bg-ink px-4 py-2 text-[13px] font-semibold text-white"><ExternalLink size={15} /> Відкрити файл</a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
