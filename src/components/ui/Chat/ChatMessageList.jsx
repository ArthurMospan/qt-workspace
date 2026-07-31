'use client';

import React from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import EmptyState from '../Feedback/EmptyState';
import Pill from '../DataDisplay/Pill';
import MessageBubble from './MessageBubble';

// ─── UI Kit: Chat Message List ───────────────────────────────────────────────
// The scrolling body of a conversation: day separators, message rows, the
// "load older" control, the typing indicator and the jump-to-latest badge.
//
// `MessageBubble` moved into the kit before this did, which left the catalogue
// able to show one message but not a conversation — and the four controls that
// make a list a list (older history, unread badge) stayed hand-written on the
// page. The bubble is the atom; this is the thing users actually look at.
//
// The badge renders as a sibling of the scroll box, not inside it: it is
// positioned against the whole conversation pane, so a wrapper here would have
// re-anchored it a hundred pixels down.

function formatDateSep(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today - msgDay;
  if (diff === 0) return 'Сьогодні';
  if (diff === 86400000) return 'Вчора';
  return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = a?.toDate ? a.toDate() : new Date(a);
  const db = b?.toDate ? b.toDate() : new Date(b);
  return da.toDateString() === db.toDateString();
}

export default function ChatMessageList({
  scrollRef,
  endRef,
  registerMessageRef,
  messages = [],
  loading = false,
  searchTerm = '',
  hasMore = false,
  onLoadMore,
  typingUsers = [],
  unreadCount = 0,
  onJumpToLatest,
  myUid,
  members,
  onReact,
  onEdit,
  onDelete,
  onThread,
  onPin,
  onOpenAttachment,
}) {
  return (
    <>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-4 pb-12 pt-2 scroll-pb-12"
      >
        {loading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-line border-t-ink rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <EmptyState
              icon={MessageSquare}
              title={searchTerm ? 'Нічого не знайдено' : 'Ще немає повідомлень'}
              description={searchTerm ? `За запитом «${searchTerm}»` : 'Почніть розмову! 👋'}
            />
          </div>
        ) : (
          <>
            {/* Only the latest window is subscribed; older history loads on
                demand so opening a busy channel is not an unbounded read. */}
            {hasMore && !searchTerm.trim() && (
              <div className="flex justify-center pb-2 pt-1">
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-full bg-canvas px-3 py-1 text-[12px] font-semibold text-muted transition-colors hover:bg-[#ebebeb] hover:text-ink"
                >
                  Показати давніші повідомлення
                </button>
              </div>
            )}
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const showDateSep = !isSameDay(prev?.createdAt, msg.createdAt);
              return (
                <div key={msg.id} ref={element => registerMessageRef?.(msg.id, element)}>
                  {showDateSep && msg.createdAt && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-line" />
                      <Pill size="md" className="shrink-0">{formatDateSep(msg.createdAt)}</Pill>
                      <div className="flex-1 h-px bg-line" />
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    prevMsg={prev}
                    myUid={myUid}
                    members={members}
                    onReact={onReact}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onThread={onThread}
                    onPin={onPin}
                    onOpenAttachment={onOpenAttachment}
                    searchTerm={searchTerm}
                  />
                </div>
              );
            })}
          </>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 mt-1">
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-[12px] text-muted italic">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'друкує' : 'друкують'}...
            </span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* New messages badge */}
      {unreadCount > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={onJumpToLatest}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-full shadow-xl text-[12px] font-bold hover:bg-[#333] transition-all active:scale-95"
          >
            <ChevronDown size={14} />
            {unreadCount} нових
          </button>
        </div>
      )}
    </>
  );
}
