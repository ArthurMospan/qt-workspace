'use client';

// The chat message row: avatar, author, body, attachments, reactions and the
// hover actions. It lived inside src/app/(app)/chat/page.js, which meant the
// single most-repeated visual unit in the product had no representation in the
// kit at all — /ui-kit could only ever show an empty grey box where the
// conversation goes. Moved verbatim; the page passes exactly the props it did.

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import Button from '@/components/ui/Button';
import IconAction from '@/components/ui/IconAction';
import Pill from '@/components/ui/DataDisplay/Pill';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import MessageContent from '@/components/workspace/MessageContent';
import { ChatAttachmentList } from '@/components/workspace/ChatAttachments';
import { useFloatingOverlay } from '@/lib/hooks/useFloatingOverlay';

// ─── Message Bubble ─────────────────────────────────────────────────────────
export default function MessageBubble({
  msg, prevMsg, myUid, members, onReact, onEdit, onDelete, onThread,
  onPin, onOpenAttachment, isThread = false, searchTerm = ''
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text || '');
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiPickerPosition = useFloatingOverlay({
    open: showEmoji,
    anchorRef: emojiButtonRef,
    overlayRef: emojiPickerRef,
    preferredPlacement: 'top',
    align: 'end',
  });
  const router = useRouter();
  const confirmDialog = useConfirm();

  const showHeader = !prevMsg
    || prevMsg.senderId !== msg.senderId
    || msg.isSystem
    || prevMsg.isSystem
    || ((msg.createdAt?.toMillis?.() ?? 0) - (prevMsg.createdAt?.toMillis?.() ?? 0) > 300000);

  const isMe = msg.senderId === myUid;
  const senderMember = members?.find(member => (member.id || member.uid) === msg.senderId);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(e.target) &&
        emojiButtonRef.current && !emojiButtonRef.current.contains(e.target)
      ) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  if (msg.isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[12px] text-muted bg-white px-3 py-1 rounded-full border border-[#f0f0f0]">
          {msg.text}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex gap-3 px-4 py-1 group hover:bg-black/[0.02] transition-colors rounded-xl -mx-2 ${showHeader ? 'mt-4' : 'mt-0.5'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!showEmoji) setShowActions(false); }}
    >
      {/* Avatar or time gutter */}
      <div className="w-9 shrink-0 flex justify-end items-start pt-0.5">
        {showHeader ? (
          senderMember ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`?member=${msg.senderId}`);
              }}
              className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              title="Переглянути профіль"
            >
              <UserAvatar user={{ name: msg.user, avatar: senderMember.avatar || msg.avatar }} size="chat-message" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl overflow-hidden">
              <UserAvatar user={{ name: msg.user, avatar: msg.avatar }} size="chat-message" />
            </div>
          )
        ) : (
          <span className={`text-[10px] text-muted leading-[1.8] pt-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            {msg.time}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-[14px] text-ink flex items-center gap-1">
              {msg.user}
              {senderMember?.statusEmoji && (
                <span className="cursor-help" title={senderMember.status || 'Статус користувача'}>
                  {senderMember.statusEmoji}
                </span>
              )}
            </span>
            <span className="text-[11px] text-muted">{msg.time}</span>
            {msg.isPinned && (
              <Pill size="sm">📌 Закріплено</Pill>
            )}
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-2 mt-1">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEdit(msg.id, editText); setEditing(false); }
                if (e.key === 'Escape') { setEditing(false); setEditText(msg.text); }
              }}
              autoFocus
              className="w-full bg-white border border-ink/20 focus:border-ink rounded-xl p-3 text-[14px] outline-none resize-none transition-colors"
              rows={2}
            />
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-muted">Enter — зберегти, Esc — скасувати</span>
              <button onClick={() => { onEdit(msg.id, editText); setEditing(false); }} className="font-semibold text-ink hover:underline">Зберегти</button>
              <button onClick={() => { setEditing(false); setEditText(msg.text); }} className="font-semibold text-muted hover:text-ink">Скасувати</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[14px] text-ink leading-relaxed break-words">
              <MessageContent text={msg.text} members={members} searchTerm={searchTerm} />
              {msg.isEdited && <span className="text-[11px] text-muted ml-1">(редаговано)</span>}
            </div>

            {/* Attachments */}
            <ChatAttachmentList
              attachments={msg.attachments}
              onOpen={onOpenAttachment}
            />

            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(msg.reactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => {
                  const reacted = users.includes(myUid);
                  return (
                    <button
                      key={emoji}
                      onClick={() => onReact(msg.id, emoji, reacted)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] border transition-all hover:scale-105 active:scale-95 ${
                        reacted
                          ? 'bg-canvas border-ink/20 text-ink'
                          : 'bg-white border-line text-ink hover:border-muted'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="text-[11px] font-bold">{users.length}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Thread reply count */}
            {!isThread && msg.replyCount > 0 && (
              <button
                onClick={() => onThread(msg.id)}
                className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink hover:underline transition-colors"
              >
                <MessageSquare size={12} />
                {msg.replyCount} {msg.replyCount === 1 ? 'відповідь' : msg.replyCount < 5 ? 'відповіді' : 'відповідей'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action toolbar */}
      {(showActions || showEmoji) && !editing && (
        <div data-ui-surface="local" className="absolute right-4 -top-4 bg-white border border-line rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center p-1 gap-0.5 z-20">
          {/* Emoji */}
          <div className="relative">
            <IconAction
              buttonRef={emojiButtonRef}
              onClick={() => setShowEmoji(v => !v)}
              icon={Smile}
              label="Реакція"
              size="sm"
              appearance="soft"
              composition="chat-message-action"
            />
            {showEmoji && typeof document !== 'undefined' && createPortal(
              <div
                ref={emojiPickerRef}
                className="fixed z-[1000] max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl shadow-2xl"
                style={{
                  top: emojiPickerPosition.top,
                  left: emojiPickerPosition.left,
                  visibility: emojiPickerPosition.ready ? 'visible' : 'hidden',
                }}
              >
                <EmojiPicker
                  onEmojiClick={(d) => { onReact(msg.id, d.emoji); setShowEmoji(false); setShowActions(false); }}
                  autoFocusSearch={false}
                  skinTonesDisabled
                  width={300}
                  height={360}
                  emojiStyle="native"
                />
              </div>,
              document.body,
            )}
          </div>

          {/* Thread (only for main chat messages) */}
          {!isThread && (
            <Button
              onClick={() => onThread(msg.id)}
              style="ghost" size="icon-sm" composition="chat-message-action" icon={MessageSquare}
              title="Відповісти в гілку"
            />
          )}

          {/* Pin */}
          {!isThread && (
            <Button
              onClick={() => onPin(msg.id, !msg.isPinned)}
              style="ghost" size="icon-sm" composition="chat-message-action" icon={Pin}
              surface={msg.isPinned ? 'canvas' : 'default'}
              title={msg.isPinned ? 'Відкріпити' : 'Закріпити'}
            />
          )}

          {/* Edit & Delete (own messages only) */}
          {isMe && (
            <>
              <div className="w-px h-4 bg-line mx-0.5" />
              <Button
                onClick={() => { setEditing(true); setEditText(msg.text); }}
                style="ghost" size="icon-sm" icon={Edit2}
                title="Редагувати"
              />
              <Button
                onClick={async () => {
                  if (await confirmDialog({ title: 'Видалити повідомлення?', confirmText: 'Видалити', danger: true })) onDelete(msg.id);
                }}
                style="ghost" color="red" size="icon-sm" icon={Trash2}
                title="Видалити"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
