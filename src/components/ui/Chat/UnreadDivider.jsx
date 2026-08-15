'use client';

import Counter from '../DataDisplay/Counter';

/**
 * The boundary between previously seen chat history and unread messages.
 *
 * @param {number} props.count Number of unread messages after the boundary.
 * @param {string} props.label Human-readable boundary label.
 * @param {string} props.className Placement in the parent only.
 */
export default function UnreadDivider({
  count = 0,
  label = 'Нові повідомлення',
  className = '',
}) {
  if (count <= 0) return null;

  return (
    <div
      role="separator"
      aria-label={`${label}: ${count}`}
      className={`flex w-full items-center gap-2.5 py-1 ${className}`}
    >
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-ink/15" />
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ink shadow-sm ring-1 ring-black/[0.05]">
        <span>{label}</span>
        <Counter value={count} size="sm" appearance="solid" />
      </span>
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-ink/15" />
    </div>
  );
}
