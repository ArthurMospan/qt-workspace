'use client';

import React from 'react';
import { X } from 'lucide-react';

/**
 * One notification, drawn as the card that slides in over the workspace when it
 * arrives: who did it, what happened, and the two things you can do about it.
 *
 * Not a `Toast`. A toast reports that something you just did worked and takes
 * itself away; this arrives unasked, names a sender, and can carry a whole
 * calendar reply inside it. The icon and those extra actions are slots rather
 * than props, because deciding which glyph a notification type gets is the
 * product's business, not the kit's.
 *
 * It used to open with two lines that could not tell the reader anything: a
 * capitalised category that repeated the title in worse words, and the name of
 * the organisation — which is filtered three times over on the way here and is
 * therefore always the one already written in the header. So the card's first
 * line is now the only thing it arrived to say: who, and what. The type moved
 * into the button, where it names the destination instead of the category, and
 * the same card is now the same shape as the row in the bell.
 *
 * @param {React.ReactNode} props.icon The sender's face, drawn at the leading edge.
 * @param {string} props.title What happened.
 * @param {string} props.body The detail under it, clamped to two lines.
 * @param {string} props.time How long ago, since the card can sit there while nobody is at the desk.
 * @param {'emergency'|'default'} props.tone An emergency draws a different surface.
 * @param {React.ReactNode} props.actions Extra controls inside the card — the calendar reply buttons.
 * @param {string} props.openLabel What the open button says — where it goes, not «Перейти».
 * @param {() => void} props.onOpen Goes to whatever the notification is about. Without it no open button is drawn.
 * @param {() => void} props.onDismiss Hides the card.
 * @param {React.CSSProperties} props.style Placement and stacking, which the layer above owns.
 */
export default function NotificationCard({
  icon,
  title,
  body,
  time,
  tone = 'default',
  actions,
  openLabel = 'Перейти',
  onOpen,
  onDismiss,
  style,
}) {
  return (
    <div
      data-qt-global-notification-layer
      data-ui-surface="notification"
      data-ui-tone={tone}
      className="ui-surface fixed bottom-[72px] right-[12px] w-[min(320px,calc(100vw-24px))] overflow-hidden md:bottom-5 md:right-[24px]"
      style={style}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-ink leading-snug">{title}</p>
          {body && <p className="text-[11px] text-muted mt-1 line-clamp-2">{body}</p>}
          {actions}
          {(onOpen || time) && (
            <div className="mt-2 flex items-center gap-2">
              {onOpen && (
                <button onClick={onOpen} className="text-[11px] font-semibold text-ink hover:underline">
                  {openLabel}
                </button>
              )}
              {time && <span className="text-[10px] text-faint">{time}</span>}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Приховати сповіщення"
          className="text-faint hover:text-ink transition-colors p-1"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
