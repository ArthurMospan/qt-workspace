'use client';
import { useState } from 'react';
import { Trash2, Check, CheckCheck } from 'lucide-react';
import { formatMsgTime } from '@/lib/portal/qtplusChatView.mjs';

function Avatar({ name, url }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (url) {
    return <img src={url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded-full bg-canvas text-muted text-[11px] font-semibold flex items-center justify-center shrink-0">
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
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-muted bg-canvas rounded-full px-3 py-1 max-w-[80%] text-center">{view.text}</span>
      </div>
    );
  }

  const time = formatMsgTime(view.createdAtMs);
  // Прочитано всіма іншими учасниками, якщо в readBy є хтось окрім мене.
  const readByOthers = view.readBy.filter((id) => id !== view.senderId).length > 0;

  if (view.mine) {
    return (
      <div className="flex justify-end gap-2 group">
        <div className="flex flex-col items-end max-w-[78%] min-w-0">
          <div className="rounded-[14px] rounded-tr-[4px] bg-ink text-white px-3 py-2">
            <p className="text-[13px] whitespace-pre-wrap break-words">{view.text}</p>
          </div>
          <div className="flex items-center gap-1 mt-[2px] pr-1">
            {time && <span className="text-[10px] text-faint">{time}</span>}
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
    <div className="flex gap-2">
      <Avatar name={view.senderName} url={view.avatarUrl} />
      <div className="flex flex-col items-start max-w-[78%] min-w-0">
        {othersCount > 1 && <span className="text-[11px] text-muted mb-[1px] pl-1">{view.senderName}</span>}
        <div className="rounded-[14px] rounded-tl-[4px] bg-canvas text-ink px-3 py-2">
          <p className="text-[13px] whitespace-pre-wrap break-words">{view.text}</p>
        </div>
        {time && <span className="text-[10px] text-faint mt-[2px] pl-1">{time}</span>}
      </div>
    </div>
  );
}
