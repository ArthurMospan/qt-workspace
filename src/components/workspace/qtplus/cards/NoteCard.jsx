'use client';
import { StickyNote } from 'lucide-react';
import { Card } from '@/components/ui';

// `bordered-compact` rather than `bordered`: the material grid around this card
// — files, audio — is 12px, and the kit's default card radius is 16px, so the
// plain preset would have made the note the one tile of a different shape.
//
// Two things it got wrong beside its neighbours. It was white, so the one
// material the client sees as a yellow sticky in the portal arrived here as a
// blank rectangle among blank rectangles; and its text sat on top with a
// gradient painted permanently across the bottom, so a two-line note came with
// a grey band under it announcing text that was not there. Now the note reads
// like every other tile in the grid — a 160px preview with the name row under
// it — and the truncation is `line-clamp`, which only appears when there is
// genuinely more to read.
export default function NoteCard({ view, onOpen }) {
  const { content, source, color } = view.note;

  return (
    <Card preset="bordered-compact" padding="none" interactive onClick={() => onOpen(view)}>
      <span className="flex flex-col overflow-hidden rounded-[12px]">
        {/* Стікер бере лише горизонталь `qtplus-card-row` і робить це власною
            утилітою, а не пресетом: вертикаль йому чіпати не можна. `line-clamp-[7]`
            × 18px + 20px полів рівно вкладаються в його 160px, і 12px, які пресет
            дав би нижче md, забрали б сьомий рядок. Лівий край при цьому лишається
            там само, де й у підпису під ним. */}
        <span className="block h-[160px] overflow-hidden px-3 py-2.5 max-md:px-4" style={{ backgroundColor: color }}>
          <span className="line-clamp-[7] block whitespace-pre-wrap text-[12px] leading-[18px] text-ink">{content}</span>
        </span>
        <span data-ui-surface="qtplus-card-row" className="ui-surface flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
            style={{ backgroundColor: color }}
          >
            <StickyNote size={14} className="text-ink" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{view.title}</span>
            <span className="block truncate text-[11px] text-faint">
              {source ? `Нотатка · ${source}` : 'Нотатка'}
            </span>
          </span>
        </span>
      </span>
    </Card>
  );
}
