'use client';
import { StickyNote } from 'lucide-react';
import { Card } from '@/components/ui';

// `bordered-compact` rather than `bordered`: the material grid around this card
// — files, audio — is 12px, and the kit's default card radius is 16px, so the
// plain preset would have made the note the one tile of a different shape.
//
// The hover was a shadow, which is the only hover-shadow in the product; the
// card's own interactive treatment replaces it, so the whole grid reacts the
// same way. The flex column moves inside because `Card` puts `block` on the
// button it renders, and a `flex` from the call site would be the same property
// in the same layer.
export default function NoteCard({ view, onOpen }) {
  return (
    <Card preset="bordered-compact" padding="none" interactive onClick={() => onOpen(view)}>
      <span className="flex flex-col overflow-hidden rounded-[12px]">
        <span className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-canvas">
            <StickyNote size={14} className="text-muted" />
          </span>
          <span className="truncate text-[13px] font-medium text-ink">{view.title}</span>
        </span>
        <span className="relative block max-h-[140px] overflow-hidden px-3 py-2">
          <span className="block whitespace-pre-wrap text-[12px] text-ink">{view.note.content}</span>
          <span className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent" />
        </span>
      </span>
    </Card>
  );
}
