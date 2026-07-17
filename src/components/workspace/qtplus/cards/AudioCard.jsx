'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { downloadMaterial } from '@/lib/portal/downloadMaterial';

function formatTime(t) {
  if (!Number.isFinite(t)) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AudioCard({ view }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState('00:00');
  const [total, setTotal] = useState('00:00');

  // Слухаємо сам <audio>, а не власні клікі — інакше стан розʼїдеться,
  // якщо браузер поставить на паузу сам (втрата фокуса, інший трек).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!Number.isFinite(el.duration)) return;
      setProgress((el.currentTime / el.duration) * 100);
      setCurrent(formatTime(el.currentTime));
    };
    const onMeta = () => setTotal(formatTime(el.duration));
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, [view.url]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  };

  const seekTo = (time) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(Math.max(time, 0), el.duration);
  };

  const onSeekKeyDown = (e) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        seekTo(el.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekTo(el.currentTime + 5);
        break;
      case 'Home':
        e.preventDefault();
        seekTo(0);
        break;
      case 'End':
        e.preventDefault();
        seekTo(el.duration);
        break;
      default:
        break;
    }
  };

  return (
    <div className="rounded-[12px] border border-line bg-surface px-3 py-3 flex flex-col gap-2 group">
      {view.url && <audio ref={audioRef} src={view.url} preload="metadata" playsInline />}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={!view.url}
          aria-label={playing ? 'Пауза' : 'Відтворити'}
          className="w-8 h-8 rounded-[8px] bg-canvas text-ink flex items-center justify-center shrink-0 hover:bg-line transition-colors disabled:opacity-40"
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-[2px]" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
          <p className="text-[11px] text-muted">{current} / {total}</p>
        </div>

        {view.url && (
          <button
            type="button"
            onClick={() => downloadMaterial(view.url, view.title)}
            aria-label={`Завантажити ${view.title}`}
            className="w-7 h-7 rounded-full text-muted flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-canvas hover:text-ink shrink-0"
          >
            <Download size={13} />
          </button>
        )}
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Перемотка"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        onClick={seek}
        onKeyDown={onSeekKeyDown}
        className="h-[6px] w-full bg-canvas rounded-full cursor-pointer relative focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
      >
        <div className="absolute top-0 left-0 h-full bg-ink rounded-full" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
