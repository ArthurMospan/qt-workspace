'use client';
import { StickyNote } from 'lucide-react';

export default function NoteCard({ view, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      className="rounded-[12px] border border-line bg-surface text-left flex flex-col overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-line">
        <div className="w-7 h-7 rounded-[8px] bg-canvas flex items-center justify-center shrink-0">
          <StickyNote size={14} className="text-muted" />
        </div>
        <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
      </div>
      <div className="px-3 py-2 relative max-h-[140px] overflow-hidden">
        <p className="text-[12px] text-ink whitespace-pre-wrap">{view.note.content}</p>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent" />
      </div>
    </button>
  );
}
