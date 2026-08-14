'use client';

import { AtSign, Paperclip } from 'lucide-react';
import { ChatIcon } from '@/lib/design/icons';
import Counter from '@/components/ui/DataDisplay/Counter';
import { plural } from '@/lib/utils/plural.mjs';

const SIZES = {
  sm: { gap: 'gap-[8px]', text: 'text-[10px]', icon: 11 },
  md: { gap: 'gap-[10px]', text: 'text-[11px]', icon: 12 },
};

/**
 * What a task carries, counted at the edge of its card or row: files, times you
 * were named, messages — and one dot for "something in here is new".
 *
 * The card and the row each drew this by hand, which is how they ended up
 * disagreeing about the same three facts. The unread signal in particular was
 * drawn twice on one card, once beside the key and once on the chat counter,
 * from the same comment; it is a single mark now, last in the row, and it
 * covers every kind of activity rather than messages alone.
 *
 * A mention is a counter like the others rather than a pill: it is the same
 * kind of fact — how many of a thing there are — and only its ink is different,
 * because being named is the one of the three addressed to you personally.
 *
 * @param {number} props.attachments Files on the task.
 * @param {number} props.mentions Unread messages naming the current user.
 * @param {number} props.messages Messages in the task chat.
 * @param {boolean} props.unread Whether anything on the task is new to this user.
 * @param {'sm'|'md'} props.size `sm` for a list row, `md` for a board card.
 * @param {string} props.className Placement in the parent only.
 */
export default function TaskCounters({
  attachments = 0,
  mentions = 0,
  messages = 0,
  unread = false,
  size = 'md',
  className = '',
}) {
  const scale = SIZES[size] || SIZES.md;
  if (!attachments && !mentions && !messages && !unread) return null;

  return (
    <div className={`flex items-center ${scale.gap} shrink-0 ${scale.text} font-bold select-none ${className}`}>
      {attachments > 0 && (
        <span className="flex items-center gap-[4px] text-muted" title={`${attachments} ${plural(attachments, ['вкладення', 'вкладення', 'вкладень'])}`}>
          <Paperclip size={scale.icon} strokeWidth={2} />
          <span>{attachments}</span>
        </span>
      )}
      {mentions > 0 && (
        <span className="flex items-center gap-[4px] text-ink" title={`Вас згадали: ${mentions}`}>
          <AtSign size={scale.icon} strokeWidth={2.4} />
          <span>{mentions}</span>
        </span>
      )}
      {messages > 0 && (
        <span className="flex items-center gap-[4px] text-muted" title={`${messages} ${plural(messages, ['повідомлення', 'повідомлення', 'повідомлень'])} в чаті`}>
          <ChatIcon size={scale.icon + 1} />
          <span>{messages}</span>
        </span>
      )}
      {unread && (
        <span role="status" aria-label="Є нове в задачі" title="Є нове в задачі">
          <Counter variant="dot" size="sm" status="info" />
        </span>
      )}
    </div>
  );
}
