'use client';
import { useState } from 'react';
import { Download, FileText, Image as ImageIcon, Film, File } from 'lucide-react';
import { downloadMaterial } from '@/lib/portal/downloadMaterial';
import PdfThumb from '../previews/PdfThumb';
import TextThumb from '../previews/TextThumb';
import OfficeThumb from '../previews/OfficeThumb';

const FALLBACK_ICON = { image: ImageIcon, video: Film, pdf: FileText, text: FileText, office: FileText, file: File };

const OPENS_LIGHTBOX = ['image', 'pdf', 'video', 'text'];

export default function FileCard({ view, onOpen }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const Icon = FALLBACK_ICON[view.kind] || File;

  const handleDownload = async (e) => {
    e.stopPropagation();
    await downloadMaterial(view.url, view.title);
  };

  const handleClick = () => {
    if (!view.url) return;
    if (OPENS_LIGHTBOX.includes(view.kind)) onOpen(view);
    else window.open(view.url, '_blank', 'noopener,noreferrer');
  };

  // thumb тримає JSX-елемент, а не значення — він завжди truthy, тому провал
  // прев'ю (PdfThumb/TextThumb повертають null усередині себе) не спрацював би
  // через `thumb || <fallback/>` нижче. Тому будь-яка невдача підіймається сюди
  // через onFailed і гейтить сам вибір прев'ю через thumbFailed.
  let thumb = null;
  if (view.url && !thumbFailed) {
    if (view.kind === 'image') {
      thumb = <img src={view.url} alt={view.title} onError={() => setThumbFailed(true)} className="w-full h-[160px] object-cover" />;
    } else if (view.kind === 'pdf') {
      thumb = <PdfThumb url={view.url} onFailed={() => setThumbFailed(true)} />;
    } else if (view.kind === 'video') {
      thumb = <video src={view.url} className="w-full h-[160px] object-cover bg-ink" preload="metadata" />;
    } else if (view.kind === 'text') {
      thumb = <TextThumb url={view.url} onFailed={() => setThumbFailed(true)} />;
    } else if (view.kind === 'office') {
      thumb = <OfficeThumb url={view.url} title={view.title} />;
    }
  }

  return (
    <div className="rounded-[12px] border border-line bg-surface overflow-hidden group hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="relative">
        {thumb || (
          <div className="w-full h-[160px] flex items-center justify-center" style={{ backgroundColor: view.badge.bg }}>
            <Icon size={28} style={{ color: view.badge.color }} />
          </div>
        )}

        {/* Бейдж і кнопка скачування лежать НАД повнокартковим оверлеєм
            «відкрити» тому, що в них явний z-10, а в оверлея z-index: auto.
            Додатний z-index завжди виграє в auto — незалежно від порядку
            в DOM (CSS 2.1 Appendix E). Порядок елементів нижче ні на що
            не впливає, покладатись на нього не можна. */}
        {view.url && (
          <button
            type="button"
            onClick={handleClick}
            aria-label={`Відкрити ${view.title}`}
            className="absolute inset-0 cursor-pointer"
          />
        )}

        <span
          className="absolute top-2 left-2 z-10 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-[4px] pointer-events-none"
          style={{ backgroundColor: view.badge.bg, color: view.badge.color }}
        >
          {view.badge.label}
        </span>

        {view.url && (
          <button
            type="button"
            onClick={handleDownload}
            aria-label={`Завантажити ${view.title}`}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/70"
          >
            <Download size={13} />
          </button>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
        {view.subtitle && <p className="text-[12px] text-muted truncate">{view.subtitle}</p>}
      </div>
    </div>
  );
}
