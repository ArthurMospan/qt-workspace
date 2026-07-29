'use client';
import { useState } from 'react';
import { Trash2, Check, CheckCheck } from 'lucide-react';
import { formatMsgTime } from '@/lib/portal/qtplusChatView.mjs';

function ChatAuthorAvatar({ name, url }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary identity providers, which next/image cannot whitelist
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-muted">
      {initial}
    </div>
  );
}

/**
 * Одне повідомлення чату. `view` — з toChatMessageView.
 * Системні повідомлення — центрований рядок. Свої — праворуч, з можливістю видалити.
 */
export default function ChatMessage({ view, othersCount, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  if (view.system) {
    const time = formatMsgTime(view.createdAtMs);
    return (
      <div className="flex justify-center px-3 py-1">
        <div data-ui-surface="system-message" className="ui-surface flex max-w-[92%] items-center gap-2 text-[11px] text-muted">
          <span className="min-w-0 text-center leading-4">
            {view.senderId && <strong className="font-bold text-ink">{view.senderName} · </strong>}
            {view.text}
          </span>
          {time && <span className="shrink-0 text-[10px] font-medium text-[#a1a1a1]">{time}</span>}
        </div>
      </div>
    );
  }

  const time = formatMsgTime(view.createdAtMs);
  // Прочитано всіма іншими учасниками, якщо в readBy є хтось окрім мене.
  const readByOthers = view.readBy.filter((id) => id !== view.senderId).length > 0;

  if (view.mine) {
    return (
      <div className="group flex flex-row-reverse gap-3">
        <div className="flex max-w-[85%] min-w-0 flex-col items-end">
          <div className="rounded-[16px] rounded-br-none bg-[#303030] p-3 text-white">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[22px]">{view.text}</p>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {time && <span className="text-[10px] font-medium text-faint">{time}</span>}
            {readByOthers
              ? <CheckCheck size={12} className="text-muted" />
              : <Check size={12} className="text-faint" />}
            {onDelete && (
              confirming ? (
                <button
                  type="button"
                  onClick={() => onDelete(view.id)}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  Видалити?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  onBlur={() => setConfirming(false)}
                  aria-label="Видалити повідомлення"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-faint hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3">
      <div className="mb-5"><ChatAuthorAvatar name={view.senderName} url={view.avatarUrl} /></div>
      <div className="flex max-w-[85%] min-w-0 flex-col items-start">
        {othersCount > 1 && <span className="mb-1 ml-1 text-[11px] font-bold text-ink">{view.senderName}</span>}
        <div data-ui-surface="local" className="rounded-[16px] rounded-bl-none bg-white p-3 text-ink">
          <p className="whitespace-pre-wrap break-words text-[14px] leading-[22px]">{view.text}</p>
        </div>
        {time && <span className="mt-1 pl-1 text-[10px] font-medium text-faint">{time}</span>}
      </div>
    </div>
  );
}
