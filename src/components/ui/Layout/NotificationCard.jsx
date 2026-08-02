'use client';

import React from 'react';
import { X } from 'lucide-react';

/**
 * One notification, drawn as the card that slides in over the workspace when it
 * arrives: what kind it is, which organisation it came from, what happened, and
 * the two things you can do about it.
 *
 * Not a `Toast`. A toast reports that something you just did worked and takes
 * itself away; this arrives unasked, names a sender, and can carry a whole
 * calendar reply inside it. The icon and those extra actions are slots rather
 * than props, because deciding which glyph a notification type gets is the
 * product's business, not the kit's.
 *
 * Moved out of `WorkspaceHeader` with its classes intact; the surface itself
 * was already kit-owned as `data-ui-surface="notification"`.
 *
 * @param {React.ReactNode} props.icon The type's glyph, drawn at the leading edge.
 * @param {string} props.categoryLabel What kind of notification this is, in caps above the title.
 * @param {string} props.categoryColor The colour that label carries — the type's own, from the product.
 * @param {string} props.organizationName Which workspace it came from; omitted when there is only one in play.
 * @param {string} props.title What happened.
 * @param {string} props.body The detail under it, clamped to two lines.
 * @param {'emergency'|'default'} props.tone An emergency draws a different surface.
 * @param {React.ReactNode} props.actions Extra controls inside the card — the calendar reply buttons.
 * @param {() => void} props.onOpen Goes to whatever the notification is about. Without it no «Перейти» is drawn.
 * @param {() => void} props.onDismiss Hides the card.
 * @param {React.CSSProperties} props.style Placement and stacking, which the layer above owns.
 */
export default function NotificationCard({
  icon,
  categoryLabel,
  categoryColor,
  organizationName,
  title,
  body,
  tone = 'default',
  actions,
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
          <p className="text-[10px] font-bold uppercase tracking-wide mb-[3px]" style={{ color: categoryColor }}>
            {categoryLabel}
          </p>
          {organizationName && (
            <p className="text-[10px] font-semibold text-ink mb-1 truncate">{organizationName}</p>
          )}
          <p className="text-[13px] font-bold text-ink leading-snug">{title}</p>
          {body && <p className="text-[11px] text-muted mt-1 line-clamp-2">{body}</p>}
          {actions}
          {onOpen && (
            <button onClick={onOpen} className="mt-2 text-[11px] font-semibold text-ink hover:underline">
              Перейти
            </button>
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
