'use client';
// src/app/workspace/chat/page.js — Rebuilt from scratch
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Hash, MessageSquare, Send, Smile, Paperclip, Plus, Edit2,
  Trash2, X, Pin, ChevronDown, Info, UserPlus, ArrowLeft, Search
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import Button from '@/components/ui/Button';
import ChatComposerDock from '@/components/ui/ChatComposerDock';
import Dialog from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { useConfirm, EmptyState, Counter } from '@/components/ui';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { useWorkspaceChat } from '@/lib/hooks/useWorkspaceChat';
import { useMobilePaneBack } from '@/lib/hooks/useMobilePaneBack';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import MessageContent from '@/components/workspace/MessageContent';
import AttachmentViewer from '@/components/workspace/AttachmentViewer';
import { ChatAttachmentList, PendingChatAttachments } from '@/components/workspace/ChatAttachments';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, updateDoc, doc, setDoc
} from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';
import EmojiPicker from 'emoji-picker-react';
import { activeTypingUserIds, channelUnreadCount, directMessageRoomId } from '@/lib/utils/workspaceChat.mjs';
import { extractMentionedUserIds } from '@/lib/utils/mentions';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { useFloatingOverlay } from '@/lib/hooks/useFloatingOverlay';
import {
  collectChatAttachments,
  isChatMediaAttachment,
  messageMatchesChatSearch,
} from '@/lib/utils/chatAttachments.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'щойно';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} хв`;
  if (diff < 86400000) return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

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
  const db2 = b?.toDate ? b.toDate() : new Date(b);
  return da.toDateString() === db2.toDateString();
}

// ─── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({
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
              <UserAvatar user={{ name: msg.user, avatar: senderMember.avatar || msg.avatar }} size={36} />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl overflow-hidden">
              <UserAvatar user={{ name: msg.user, avatar: msg.avatar }} size={36} />
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
              <span className="text-[10px] font-bold text-ink bg-canvas px-2 py-0.5 rounded-full">📌 Закріплено</span>
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
        <div className="absolute right-4 -top-4 bg-white border border-line rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex items-center p-1 gap-0.5 z-20">
          {/* Emoji */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              onClick={() => setShowEmoji(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-canvas transition-colors text-[16px]"
              title="Реакція"
            >
              <Smile size={15} />
            </button>
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
              style="ghost" size="icon-sm" icon={MessageSquare} iconSize={15}
              title="Відповісти в гілку"
            />
          )}

          {/* Pin */}
          {!isThread && (
            <Button
              onClick={() => onPin(msg.id, !msg.isPinned)}
              style="ghost" size="icon-sm" icon={Pin} iconSize={15}
              className={msg.isPinned ? '!text-ink !bg-canvas' : ''}
              title={msg.isPinned ? 'Відкріпити' : 'Закріпити'}
            />
          )}

          {/* Edit & Delete (own messages only) */}
          {isMe && (
            <>
              <div className="w-px h-4 bg-line mx-0.5" />
              <Button
                onClick={() => { setEditing(true); setEditText(msg.text); }}
                style="ghost" size="icon-sm" icon={Edit2} iconSize={14}
                title="Редагувати"
              />
              <Button
                onClick={async () => {
                  if (await confirmDialog({ title: 'Видалити повідомлення?', confirmText: 'Видалити', danger: true })) onDelete(msg.id);
                }}
                style="ghost" color="red" size="icon-sm" icon={Trash2} iconSize={14}
                title="Видалити"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Message Input ───────────────────────────────────────────────────────────
function MessageInput({
  onSend,
  onTyping,
  onError,
  placeholder = 'Написати повідомлення...',
  members = [],
}) {
  const { activeOrgId } = useAppContext();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionType, setMentionType] = useState(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const emojiRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const emojiPosition = useFloatingOverlay({
    open: showEmoji,
    anchorRef: emojiBtnRef,
    overlayRef: emojiRef,
    preferredPlacement: 'top',
    align: 'start',
  });
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target) && emojiBtnRef.current && !emojiBtnRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
    // Mention detection
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const matchUser = before.match(/(?:^|[\s([{])([@"])([^@\n"]*)$/u);
    if (matchUser) {
      setMentionType('user');
      setMentionQuery(matchUser[2].toLowerCase());
      setMentionCursor(cursor);
      setMentionStart(cursor - matchUser[2].length - 1);
    } else {
      setMentionType(null);
      setMentionQuery('');
      setMentionStart(-1);
    }
    // Notify parent about typing
    if (onTyping) onTyping();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && mentionType === 'user' && filteredMembers.length > 0) {
      e.preventDefault();
      insertMention(filteredMembers[0]);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setMentionType(null);
      setShowEmoji(false);
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && attachments.length === 0) || sendingRef.current) return;
    sendingRef.current = true;
    setUploading(true);
    let uploaded = [];
    if (attachments.length > 0) {
      try {
        // Organization-scoped so ownership stays provable when the file is
        // later released by /api/upload/delete.
        uploaded = await Promise.all(attachments.map(file =>
          uploadFile(file, `organizations/${activeOrgId}/chat`)));
      } catch (e) {
        console.error('Upload error', e);
        onError?.('Не вдалося завантажити вкладення');
        setUploading(false);
        sendingRef.current = false;
        return;
      }
    }
    try {
      await onSend(text, uploaded);
      setText('');
      setAttachments([]);
      setMentionType(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (error) {
      console.error('[workspace-chat] Send failed:', error);
      onError?.('Не вдалося надіслати повідомлення');
    } finally {
      setUploading(false);
      sendingRef.current = false;
    }
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const roomLeft = Math.max(0, 5 - attachments.length);
    const accepted = files
      .filter(file => file.size <= 20 * 1024 * 1024)
      .slice(0, roomLeft);
    if (accepted.length !== files.length) {
      onError?.('До 5 файлів, максимум 20 МБ кожен');
    }
    setAttachments(previous => [...previous, ...accepted]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const insertMention = (member) => {
    const name = member.name || member.email;
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionCursor);
    const newText = `${before}@${name} ${after}`;
    setText(newText);
    setMentionType(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredMembers = mentionType === 'user'
    ? members.filter(m => `${m.name || m.displayName || ''} ${m.email || ''}`.toLowerCase().includes(mentionQuery.trim()))
    : [];

  const canSend = (text.trim() || attachments.length > 0) && !uploading;

  return (
    <div className="relative px-4 pb-4">
      {/* Mention dropdown */}
      {mentionType === 'user' && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-line rounded-2xl shadow-xl overflow-hidden max-h-[200px] overflow-y-auto z-30">
          {filteredMembers.map(m => (
            <button
              key={m.id || m.uid}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-canvas transition-colors text-left"
            >
              <UserAvatar user={{ name: m.name, avatar: m.avatar }} size={28} />
              <div>
                <p className="text-[13px] font-semibold text-ink">{m.name || m.email}</p>
                {m.email && m.name && <p className="text-[11px] text-muted">{m.email}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && typeof document !== 'undefined' && createPortal(
        <div
          ref={emojiRef}
          className="fixed z-[1000] max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl shadow-2xl"
          style={{
            top: emojiPosition.top,
            left: emojiPosition.left,
            visibility: emojiPosition.ready ? 'visible' : 'hidden',
          }}
        >
          <EmojiPicker
            onEmojiClick={(d) => { setText(prev => prev + d.emoji); setShowEmoji(false); textareaRef.current?.focus(); }}
            autoFocusSearch={false}
            skinTonesDisabled
            width={320}
            height={380}
            emojiStyle="native"
          />
        </div>,
        document.body,
      )}

      {/* Input card */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white transition-all hover:border-[#cfcfcf] focus-within:border-[#cfcfcf] focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="border-b border-black/[0.05] p-2">
            <PendingChatAttachments
              files={attachments}
              onRemove={index => setAttachments(previous => previous.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          className="w-full px-4 py-3.5 text-[14px] text-ink placeholder-[#b0b0b0] bg-transparent outline-none resize-none max-h-[200px] leading-relaxed"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 border-t border-[#f0f0f0] pt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              ref={emojiBtnRef}
              onClick={() => setShowEmoji(v => !v)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showEmoji ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas hover:text-ink'}`}
              title="Emoji"
            >
              <Smile size={17} />
            </button>
            <input type="file" multiple ref={fileRef} onChange={handleFiles} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
              title="Прикріпити файл"
            >
              <Paperclip size={17} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all ${
              canSend
                ? 'bg-ink text-white hover:bg-[#333] active:scale-95 shadow-sm'
                : 'bg-[#f0f0f0] text-[#b0b0b0] cursor-not-allowed'
            }`}
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>Надіслати</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Thread Sidebar ──────────────────────────────────────────────────────────
function ThreadSidebar({
  parentMsg,
  replies,
  myUid,
  members,
  onSend,
  onDeleteReply,
  onOpenAttachment,
  onError,
  onClose,
  loading,
}) {
  const scrollRef = useRef(null);
  const confirmDialog = useConfirm();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  if (!parentMsg) return null;

  return (
    <div className="fixed inset-0 z-50 md:static md:z-auto md:w-[360px] md:rounded-[16px] shrink-0 bg-canvas flex flex-col overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex h-[56px] shrink-0 items-center justify-between border-b border-line/70 bg-canvas/90 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-muted" />
          <h3 className="font-bold text-[14px] text-ink">Гілка</h3>
          {replies.length > 0 && (
            <span className="text-[11px] text-muted bg-white px-2 py-0.5 rounded-full">
              {replies.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-white transition-colors"
          aria-label="Закрити гілку"
          title="Закрити"
        >
          <X size={16} />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-5 py-4 border-b border-line/70 bg-white/40">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0">
            <UserAvatar user={{ name: parentMsg.user, avatar: parentMsg.avatar }} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-[13px] text-ink">{parentMsg.user}</span>
              <span className="text-[10px] text-muted">{parentMsg.time}</span>
            </div>
            <p className="text-[13px] text-[#333] leading-relaxed line-clamp-4">{parentMsg.text}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 pb-12 pt-4 flex flex-col gap-0.5">
        {replies.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={32} className="text-faint mb-3" />
            <p className="text-[13px] text-muted font-medium">Ще немає відповідей</p>
            <p className="text-[12px] text-faint mt-1">Будь першим!</p>
          </div>
        )}
        {replies.map((reply, i) => {
          const prevReply = i > 0 ? replies[i - 1] : null;
          const showHead = !prevReply || prevReply.senderId !== reply.senderId
            || ((reply.createdAt?.toMillis?.() ?? 0) - (prevReply.createdAt?.toMillis?.() ?? 0) > 300000);

          return (
            <div key={reply.id} className={`relative flex gap-2.5 group px-2 py-1 rounded-xl hover:bg-black/[0.03] transition-colors ${showHead ? 'mt-3' : 'mt-0.5'}`}>
              <div className="w-8 shrink-0 flex justify-end items-start pt-0.5">
                {showHead ? (
                  <div className="w-8 h-8 rounded-xl overflow-hidden">
                    <UserAvatar user={{ name: reply.user, avatar: members?.find(m => (m.id || m.uid) === reply.senderId)?.avatar || reply.avatar }} size={32} />
                  </div>
                ) : (
                  <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 pt-1 transition-opacity">{reply.time}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {showHead && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-[13px] text-ink flex items-center gap-1">
                      {reply.user}
                      {members?.find(m => (m.id || m.uid) === reply.senderId)?.statusEmoji && <span>{members.find(m => (m.id || m.uid) === reply.senderId).statusEmoji}</span>}
                    </span>
                    <span className="text-[10px] text-muted">{reply.time}</span>
                  </div>
                )}
                <p className="text-[13px] text-ink leading-relaxed">{reply.text}</p>
                <ChatAttachmentList
                  attachments={reply.attachments}
                  compact
                  className="max-w-[260px] sm:grid-cols-1"
                  onOpen={onOpenAttachment}
                />
              </div>
              {reply.senderId === myUid && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Видалити відповідь?', confirmText: 'Видалити', danger: true })) onDeleteReply(reply.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-[#ef4444] hover:bg-red-50 transition-all shrink-0"
                  aria-label="Видалити відповідь"
                  title="Видалити"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Thread Input */}
      <ChatComposerDock scrollRef={scrollRef}>
        <MessageInput
          onSend={onSend}
          onError={onError}
          placeholder="Відповісти в гілку..."
          members={members}
        />
      </ChatComposerDock>
    </div>
  );
}

// ─── Channel Info Sidebar ───────────────────────────────────────────────────
function ChannelInfoSidebar({
  channel,
  members,
  messages,
  activeTab,
  onTabChange,
  onOpenAttachment,
  onJumpToMessage,
  onError,
  onClose,
  activeOrgId,
  isAdminOrOwner
}) {
  const [description, setDescription] = useState(channel?.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');

  const channelMembers = channel?.members || [];
  const pinnedMessages = messages.filter(message => message.isPinned);
  const attachments = collectChatAttachments(messages);
  const visibleAttachments = attachments.filter(attachment => {
    if (materialFilter === 'media' && !isChatMediaAttachment(attachment)) return false;
    if (materialFilter === 'files' && isChatMediaAttachment(attachment)) return false;
    const queryValue = materialSearch.trim().toLocaleLowerCase('uk-UA');
    if (!queryValue) return true;
    return `${attachment.name || ''} ${attachment.senderName || ''}`
      .toLocaleLowerCase('uk-UA')
      .includes(queryValue);
  });
  
  // Calculate who is in and who is out
  const membersInChannel = members.filter(m => {
    const id = m.id || m.uid;
    // If channel.members array is empty/doesn't exist, treat everyone as a member
    if (!channelMembers || channelMembers.length === 0) return true;
    return channelMembers.includes(id);
  });
  
  const membersOutChannel = members.filter(m => {
    const id = m.id || m.uid;
    if (!channelMembers || channelMembers.length === 0) return false;
    return !channelMembers.includes(id);
  });

  const handleSaveDescription = async () => {
    try {
      await setDoc(doc(db, 'organizations', activeOrgId, 'channels', channel.id), {
        description: description.trim()
      }, { merge: true });
      setIsEditingDesc(false);
    } catch (e) {
      console.error(e);
      onError?.('Не вдалося оновити опис каналу');
    }
  };

  const handleAddMember = async (uid) => {
    try {
      let currentList = [...channelMembers];
      if (currentList.length === 0) {
        currentList = members.map(m => m.id || m.uid);
      }
      if (!currentList.includes(uid)) {
        currentList.push(uid);
      }
      await setDoc(doc(db, 'organizations', activeOrgId, 'channels', channel.id), {
        members: currentList
      }, { merge: true });
    } catch (e) {
      console.error(e);
      onError?.('Не вдалося додати учасника');
    }
  };

  const handleAddAllMembers = async () => {
    try {
      const allUids = members.map(m => m.id || m.uid);
      await setDoc(doc(db, 'organizations', activeOrgId, 'channels', channel.id), {
        members: allUids
      }, { merge: true });
      setShowAddMembers(false);
    } catch (e) {
      console.error(e);
      onError?.('Не вдалося додати учасників');
    }
  };

  const handleRemoveMember = async (uid) => {
    try {
      let currentList = [...channelMembers];
      if (currentList.length === 0) {
        currentList = members.map(m => m.id || m.uid);
      }
      const updatedList = currentList.filter(id => id !== uid);
      if (updatedList.length === 0) {
        onError?.('У каналі має залишитися хоча б один учасник');
        return;
      }
      await setDoc(doc(db, 'organizations', activeOrgId, 'channels', channel.id), {
        members: updatedList
      }, { merge: true });
    } catch (e) {
      console.error(e);
      onError?.('Не вдалося видалити учасника');
    }
  };

  return (
    <div className="fixed inset-0 z-50 md:static md:z-auto md:w-[360px] md:rounded-[16px] shrink-0 bg-canvas flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-[56px] shrink-0 border-b border-line/70">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-muted" />
          <h3 className="font-bold text-[14px] text-ink">Про канал</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-white transition-colors"
          aria-label="Закрити інформацію про канал"
          title="Закрити"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-line/70 px-3 py-2">
        {[
          ['info', 'Про канал'],
          ['pinned', `Закріплені${pinnedMessages.length ? ` · ${pinnedMessages.length}` : ''}`],
          ['materials', `Матеріали${attachments.length ? ` · ${attachments.length}` : ''}`],
        ].map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => onTabChange(tabId)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              activeTab === tabId ? 'bg-white text-ink' : 'text-muted hover:bg-white/60 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
        {activeTab === 'info' && (
          <>
        {/* Basic Info */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Hash size={18} className="text-ink shrink-0" />
            <h4 className="font-bold text-[16px] text-ink truncate">
              {channel.name}
            </h4>
          </div>
          
          <div className="mt-2 bg-white rounded-2xl p-4 border border-line/70">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Опис</p>
            {isEditingDesc ? (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-white border border-ink/20 focus:border-ink rounded-xl p-2.5 text-[13px] outline-none resize-none transition-colors"
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditingDesc(false)} className="text-[12px] font-semibold text-muted hover:text-ink">Скасувати</button>
                  <button onClick={handleSaveDescription} className="text-[12px] font-semibold text-ink hover:underline">Зберегти</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start gap-4">
                <p className="text-[13px] text-ink leading-relaxed">
                  {channel.description || <span className="italic text-[#b0b0b0]">Опис відсутній</span>}
                </p>
                {isAdminOrOwner && (
                  <button onClick={() => setIsEditingDesc(true)} className="text-muted hover:text-ink text-[12px] font-semibold">Редагувати</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
              Учасники ({membersInChannel.length})
            </span>
            {isAdminOrOwner && (
              <button
                onClick={() => setShowAddMembers(v => !v)}
                className="text-[11px] font-semibold text-ink hover:underline flex items-center gap-1"
              >
                <UserPlus size={13} />
                Додати
              </button>
            )}
          </div>

          {showAddMembers && (
            <div className="mb-4 bg-white rounded-2xl p-3 border border-line/70 flex flex-col gap-2">
              <button
                onClick={handleAddAllMembers}
                className="w-full text-center py-2 bg-ink hover:bg-ink-hover text-white rounded-xl text-[12px] font-semibold transition-colors"
              >
                Додати всіх учасників
              </button>
              {membersOutChannel.length > 0 && (
                <div className="border-t border-[#f0f0f0] pt-2 max-h-[140px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                  {membersOutChannel.map(m => (
                    <button
                      key={m.id || m.uid}
                      onClick={() => handleAddMember(m.id || m.uid)}
                      className="w-full flex items-center justify-between text-left px-2 py-1.5 hover:bg-canvas rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar user={{ name: m.name, avatar: m.avatar }} size={20} />
                        <span className="text-[12px] font-medium text-ink">{m.name || m.email}</span>
                      </div>
                      <Plus size={14} className="text-muted" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-line/70 p-3 max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {membersInChannel.map(m => (
              <div key={m.id || m.uid} className="flex items-center justify-between py-0.5 group/m">
                <div className="flex items-center gap-2">
                  <UserAvatar user={{ name: m.name, avatar: m.avatar }} size={24} />
                  <span className="text-[13px] font-medium text-ink truncate max-w-[180px]">{m.name || m.email}</span>
                </div>
                {isAdminOrOwner && channelMembers.length > 0 && (
                  <button
                    onClick={() => handleRemoveMember(m.id || m.uid)}
                    className="opacity-0 group-hover/m:opacity-100 text-red-500 hover:text-red-700 text-[11px] font-semibold transition-opacity"
                  >
                    Видалити
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
          </>
        )}

        {activeTab === 'pinned' && (
          <div className="flex flex-col gap-2">
            {pinnedMessages.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Pin size={28} className="mb-3 text-faint" />
                <p className="text-[13px] font-semibold text-muted">Немає закріплених повідомлень</p>
              </div>
            ) : pinnedMessages.map(message => (
              <button
                key={message.id}
                type="button"
                onClick={() => onJumpToMessage(message.id)}
                className="rounded-xl border border-line/70 bg-white p-3 text-left transition-colors hover:border-[#cfcfcf]"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-muted">{message.user}</span>
                  <span className="shrink-0 text-[10px] text-faint">{message.time}</span>
                </div>
                <p className="line-clamp-3 text-[12px] leading-5 text-ink">
                  {message.text || (message.attachments?.length ? 'Вкладення' : 'Повідомлення')}
                </p>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={materialSearch}
                onChange={event => setMaterialSearch(event.target.value)}
                placeholder="Пошук матеріалів..."
                className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-[12px] text-ink outline-none transition-colors hover:border-[#cfcfcf] focus:border-[#cfcfcf]"
              />
            </label>
            <div className="flex gap-1">
              {[
                ['all', 'Усі'],
                ['media', 'Медіа'],
                ['files', 'Файли'],
              ].map(([filterId, label]) => (
                <button
                  key={filterId}
                  type="button"
                  onClick={() => setMaterialFilter(filterId)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    materialFilter === filterId ? 'bg-ink text-white' : 'bg-white text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {visibleAttachments.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Paperclip size={28} className="mb-3 text-faint" />
                <p className="text-[13px] font-semibold text-muted">
                  {materialSearch ? 'Матеріали не знайдено' : 'У чаті ще немає матеріалів'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleAttachments.map(attachment => (
                  <div key={attachment.chatAttachmentKey} className="rounded-xl border border-line/70 bg-white p-2">
                    <ChatAttachmentList
                      attachments={[attachment]}
                      compact
                      className="mt-0 min-w-0 max-w-none sm:grid-cols-1"
                      onOpen={onOpenAttachment}
                    />
                    <button
                      type="button"
                      onClick={() => onJumpToMessage(attachment.messageId)}
                      className="mt-1 w-full truncate px-1 text-left text-[10px] text-muted hover:text-ink"
                    >
                      {attachment.senderName || 'Учасник'} · перейти до повідомлення
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { currentUser, projects, activeOrgId } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { members } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);
  const chatSearch = useWorkspaceStore(s => s.chatSearch);
  const setChatSearch = useWorkspaceStore(s => s.setChatSearch);
  const setChatOnlineUsers = useWorkspaceStore(s => s.setChatOnlineUsers);
  const notifications = useWorkspaceStore(s => s.notifications);
  const markNotificationRead = useWorkspaceStore(s => s.notificationActions?.markRead);

  const [activeChannel, setActiveChannel] = useState({ id: 'general', type: 'channel' });
  // Mobile single-pane mode: 'list' (channels) або 'chat' (розмова); md+ показує обидві панелі
  const [mobilePane, setMobilePane] = useState('list');
  const openChannel = (ch) => { setActiveChannel(ch); setMobilePane('chat'); };
  // Системний «назад» на телефоні повертає до списку чатів, а не виходить зі сторінки
  const requestPaneClose = useMobilePaneBack(mobilePane === 'chat', () => setMobilePane('list'));
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelMemberIds, setNewChannelMemberIds] = useState([]);
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false);
  const [presenceMap, setPresenceMap] = useState({});
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadBadge, setUnreadBadge] = useState(0);
  const [lastMsgCount, setLastMsgCount] = useState(0);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [channelInfoTab, setChannelInfoTab] = useState('info');
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [typingNow, setTypingNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const myUid = currentUser?.uid || currentUser?.id;
  const myMemberInfo = members.find(m => (m.id || m.uid) === myUid);
  const myRole = myMemberInfo?.role || 'member';
  const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';

  const getRoomId = useCallback(() => {
    if (activeChannel.type === 'channel') return activeChannel.id;
    return directMessageRoomId(myUid, activeChannel.id) || 'general';
  }, [activeChannel, myUid]);

  const {
    channels, dmChannels, messages, loading, activeChannelData,
    activeThreadId, threadMessages, activeDMs, readState,
    hasMoreMessages, loadOlderMessages,
    sendMessage, deleteMessage, editMessage, toggleReaction,
    createChannel, setTyping, openThread, closeThread,
    sendThreadMessage, markAsRead, deleteReply
  } = useWorkspaceChat(getRoomId(), activeChannel.type, activeChannel.type === 'dm' ? activeChannel.id : null);

  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const composerRef = useRef(null);
  const messageRefs = useRef(new Map());
  const typingRef = useRef(null);
  const lastTailIdRef = useRef(null);
  const pendingHistoryHeightRef = useRef(null);
  // Notification links open the exact conversation instead of dropping the
  // user on #general.
  useEffect(() => {
    const dmUserId = searchParams.get('dm');
    const channelId = searchParams.get('channel');
    if (dmUserId && dmUserId !== myUid) {
      queueMicrotask(() => openChannel({ id: dmUserId, type: 'dm' }));
    } else if (channelId) {
      queueMicrotask(() => openChannel({ id: channelId, type: 'channel' }));
    }
  }, [myUid, searchParams]);

  // Presence
  useEffect(() => {
    if (!activeOrgId) return;
    const q = query(collection(db, 'organizations', activeOrgId, 'presence'));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.forEach(d => {
        const presence = d.data();
        const lastSeen = presence.lastSeen?.toMillis?.() ?? 0;
        // Fresh lastSeen is authoritative. A boolean written by another tab
        // can become stale when one tab closes while another remains open.
        map[d.id] = lastSeen;
      });
      setPresenceMap(map);
    }, err => {
      reportLoadError('[ChatPage] presence', err);
    });
    return () => unsub();
  }, [activeOrgId]);

  // Scroll handling
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const handler = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsScrolledUp(!atBottom);
      if (atBottom) setUnreadBadge(0);
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Auto-scroll to bottom on new messages.
  // Growing the history window prepends older messages: that is neither new
  // activity (no unread badge) nor a reason to jump — the previous reading
  // position is restored by compensating for the added height.
  useEffect(() => {
    const count = messages.length;
    const tailId = messages[count - 1]?.id ?? null;
    const previousTailId = lastTailIdRef.current;
    const hasNewTail = tailId !== null && tailId !== previousTailId;
    lastTailIdRef.current = tailId;

    const scrollElement = chatScrollRef.current;
    const heightBeforeRender = pendingHistoryHeightRef.current;
    if (heightBeforeRender !== null) {
      pendingHistoryHeightRef.current = null;
      if (scrollElement) {
        scrollElement.scrollTop += scrollElement.scrollHeight - heightBeforeRender;
      }
      queueMicrotask(() => setLastMsgCount(count));
      return;
    }

    if (!isScrolledUp) {
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: count <= 1 ? 'instant' : 'smooth',
        });
      }
    } else if (hasNewTail && previousTailId !== null && count > lastMsgCount && lastMsgCount > 0) {
      queueMicrotask(() => setUnreadBadge(v => v + (count - lastMsgCount)));
    }
    queueMicrotask(() => setLastMsgCount(count));
  }, [messages]); // eslint-disable-line

  const handleLoadOlderMessages = () => {
    pendingHistoryHeightRef.current = chatScrollRef.current?.scrollHeight ?? null;
    loadOlderMessages();
  };

  // Keep the last message visible when attachment previews or a growing
  // textarea change the composer height.
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (isScrolledUp) return;
      requestAnimationFrame(() => {
        const scrollElement = chatScrollRef.current;
        scrollElement?.scrollTo({ top: scrollElement.scrollHeight, behavior: 'instant' });
      });
    });
    observer.observe(composer);
    return () => observer.disconnect();
  }, [isScrolledUp]);

  // Mark as read + scroll to bottom when switching channel
  useEffect(() => {
    markAsRead(getRoomId());
    lastTailIdRef.current = null;
    pendingHistoryHeightRef.current = null;
    queueMicrotask(() => {
      setIsScrolledUp(false);
      setUnreadBadge(0);
      setLastMsgCount(0);
    });
    // Force scroll to bottom on channel switch
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }, 100);
  }, [activeChannel.id, activeChannel.type]); // eslint-disable-line

  // Messages received while the conversation is already open are read
  // immediately; they must not reappear as a phantom sidebar badge.
  useEffect(() => {
    if (!messages.length || document.visibilityState !== 'visible') return;
    markAsRead(getRoomId());
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeChannel.type !== 'dm' || document.visibilityState !== 'visible' || !markNotificationRead) return;
    const unreadForConversation = notifications.filter(notification =>
      notification.type === 'chat_message'
      && !notification.read
      && notification.organizationId === activeOrgId
      && notification.actorId === activeChannel.id);
    if (unreadForConversation.length === 0) return;
    Promise.allSettled(unreadForConversation.map(notification => markNotificationRead(notification.id)));
  }, [activeChannel.id, activeChannel.type, activeOrgId, markNotificationRead, notifications]);

  // DMs list
  const unreadDMNotifications = useMemo(() => {
    const counts = new Map();
    notifications.forEach(notification => {
      if (
        notification.type !== 'chat_message'
        || notification.read
        || notification.organizationId !== activeOrgId
        || !notification.actorId
      ) return;
      counts.set(notification.actorId, (counts.get(notification.actorId) || 0) + 1);
    });
    return counts;
  }, [activeOrgId, notifications]);

  const dms = useMemo(() => {
    const activeDMSet = new Set(activeDMs);
    if (activeChannel.type === 'dm') activeDMSet.add(activeChannel.id);
    return members
    .filter(m => (m.uid || m.id) !== myUid)
    .map(m => {
      const id = m.uid || m.id;
      const hasPresence = Object.prototype.hasOwnProperty.call(presenceMap, id);
      const lastActive = hasPresence ? presenceMap[id] : m.lastActive;
      return {
        id,
        name: m.name || m.email,
        online: lastActive && (now - new Date(lastActive).getTime() < 15 * 60 * 1000),
        avatar: m.avatar,
        isActive: activeDMSet.has(id),
        statusEmoji: m.statusEmoji,
        status: m.status,
        unreadCount: Math.max(
          unreadDMNotifications.get(id) || 0,
          channelUnreadCount(
            dmChannels.find(channel => channel.id === directMessageRoomId(myUid, id)),
            readState[directMessageRoomId(myUid, id)],
            myUid,
          ),
        ),
      };
    })
    .sort((a, b) => {
      if (a.online !== b.online) return b.online ? 1 : -1;
      if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeDMs, activeChannel.id, activeChannel.type, dmChannels, members, myUid, now, presenceMap, readState, unreadDMNotifications]);

  const isActive = (id) => activeChannel.id === id;
  const activeThreadParent = activeThreadId ? messages.find(m => m.id === activeThreadId) : null;
  const currentChannel = channels.find(c => c.id === activeChannel.id);
  const mentionMembers = useMemo(() => {
    if (activeChannel.type === 'dm') {
      return members.filter(member => (member.id || member.uid) === activeChannel.id);
    }
    if (currentChannel?.members?.length) {
      return members.filter(member => currentChannel.members.includes(member.id || member.uid));
    }
    return members;
  }, [activeChannel.id, activeChannel.type, currentChannel, members]);

  // Sync online users to global header
  const onlineUsersForHeader = useMemo(() => dms
      .filter(u => u.online)
      .map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        status: u.status,
        statusEmoji: u.statusEmoji,
      })), [dms]);
  useEffect(() => {
    setChatOnlineUsers(onlineUsersForHeader);
  }, [onlineUsersForHeader, setChatOnlineUsers]);

  const handlePin = async (msgId, pin) => {
    if (!activeOrgId || !getRoomId()) return;
    try {
      await updateDoc(doc(db, 'organizations', activeOrgId, 'channels', getRoomId(), 'messages', msgId), {
        isPinned: pin
      });
      showToast(pin ? 'Повідомлення закріплено ✓' : 'Знято з закріплення');
    } catch (e) {
      console.error(e);
      showToast('Не вдалося змінити закріплення', 'error');
    }
  };

  const handleReaction = async (msgId, emoji, hasReacted) => {
    try {
      await toggleReaction(msgId, emoji, hasReacted);
    } catch {
      showToast('Не вдалося змінити реакцію', 'error');
    }
  };

  const handleEditMessage = async (msgId, text) => {
    try {
      await editMessage(msgId, text);
    } catch {
      showToast('Не вдалося відредагувати повідомлення', 'error');
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await deleteMessage(msgId);
    } catch {
      showToast('Не вдалося видалити повідомлення', 'error');
    }
  };

  const handleDeleteReply = async (replyId) => {
    try {
      await deleteReply(activeThreadId, replyId);
    } catch {
      showToast('Не вдалося видалити відповідь', 'error');
    }
  };

  const resetChannelDraft = () => {
    setNewChannelName('');
    setNewChannelDescription('');
    setNewChannelMemberIds([]);
  };

  const closeCreateChannelDialog = () => {
    if (isSubmittingChannel) return;
    setIsCreatingChannel(false);
    resetChannelDraft();
  };

  const handleCreateChannel = async (event) => {
    event.preventDefault();
    if (!newChannelName.trim() || isSubmittingChannel) return;

    setIsSubmittingChannel(true);
    try {
      const id = await createChannel(newChannelName.trim(), {
        description: newChannelDescription.trim(),
        members: [myUid, ...newChannelMemberIds].filter(Boolean),
      });
      setIsCreatingChannel(false);
      resetChannelDraft();
      openChannel({ id, type: 'channel' });
      showToast('Канал створено ✓');
    } catch (channelError) {
      // createChannel now reports *why* it refused (duplicate name, unusable
      // slug, denied write) instead of silently returning null.
      showToast(channelError.message || 'Помилка при створенні каналу', 'error');
    } finally {
      setIsSubmittingChannel(false);
    }
  };

  const channelMemberOptions = useMemo(() => members
    .filter(member => (member.id || member.uid) !== myUid)
    .map(member => ({
      value: member.id || member.uid,
      label: member.name || member.displayName || member.email || 'Учасник',
      avatar: member.avatar || member.photoURL || '',
    })), [members, myUid]);

  const handleSendMessage = async (text, attachments) => {
    clearTimeout(typingRef.current);
    setTyping(false);
    try {
      await sendMessage(text, attachments);
      if (activeChannel.type === 'channel') {
        const mentionedUserIds = extractMentionedUserIds(text, mentionMembers, myUid);
        if (mentionedUserIds.length) {
          void sendNotification({
              userIds: mentionedUserIds,
              type: 'mentioned',
              title: `${currentUser?.name || 'Колега'} згадав вас у чаті`,
              body: text.trim().slice(0, 500),
              link: `/chat?channel=${encodeURIComponent(activeChannel.id)}`,
              organizationId: activeOrgId,
              dedupeKey: `channel_mention_${activeChannel.id}_${Date.now()}`,
            }).catch(notificationError => {
            console.error('[workspace-chat] Mention notification failed:', notificationError);
            showToast('Повідомлення надіслано, але сповіщення про згадку не доставлено', 'error');
            });
        }
      }
    } catch (error) {
      showToast(
        error?.code === 'permission-denied'
          ? 'Немає дозволу на надсилання в цей чат'
          : 'Не вдалося надіслати повідомлення',
        'error',
      );
      throw error;
    }
  };

  const handleSendThread = async (text, attachments) => {
    await sendThreadMessage(text, attachments);
  };

  const handleMainTyping = () => {
    setTyping(true);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => setTyping(false), 2000);
  };

  // Display messages (filtered by search)
  const displayMessages = chatSearch.trim()
    ? messages.filter(message => messageMatchesChatSearch(message, chatSearch))
    : messages;

  // Stale flags (crashed tab, hard reload) are discarded by TTL rather than
  // leaving "X друкує…" on screen forever. The clearing write normally arrives
  // via snapshot; this ticker only covers the case where it never comes.
  const typingFlagCount = activeChannelData?.typing?.length || 0;
  useEffect(() => {
    if (!typingFlagCount) return undefined;
    const timer = setInterval(() => setTypingNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [typingFlagCount]);

  const typingUsers = useMemo(
    () => activeTypingUserIds(activeChannelData, { now: typingNow, exclude: myUid })
      .map(uid => members.find(m => (m.id || m.uid) === uid)?.name || 'Хтось'),
    [activeChannelData, members, myUid, typingNow],
  );

  const handleOpenThread = (msgId) => {
    setShowChannelInfo(false);
    openThread(msgId);
  };

  const handleOpenChannelInfo = (tab = 'info') => {
    setChannelInfoTab(tab);
    setShowChannelInfo(true);
    closeThread();
  };

  const handleJumpToMessage = (messageId) => {
    setChatSearch('');
    setShowChannelInfo(false);
    requestAnimationFrame(() => {
      const element = messageRefs.current.get(messageId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.animate(
        [
          { backgroundColor: 'rgba(31, 31, 31, 0.12)' },
          { backgroundColor: 'transparent' },
        ],
        { duration: 1200, easing: 'ease-out' },
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {viewerAttachment && (
        <AttachmentViewer
          attachment={viewerAttachment}
          onClose={() => setViewerAttachment(null)}
        />
      )}
      <Dialog
        isOpen={isCreatingChannel}
        onClose={closeCreateChannelDialog}
        title="Новий канал"
        presentation="dialog"
        size="md"
        footer={(
          <>
            <Button
              style="secondary"
              size="md"
              onClick={closeCreateChannelDialog}
              disabled={isSubmittingChannel}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              form="create-channel-form"
              size="md"
              loading={isSubmittingChannel}
              disabled={!newChannelName.trim()}
            >
              Створити канал
            </Button>
          </>
        )}
      >
        <form id="create-channel-form" onSubmit={handleCreateChannel} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="new-channel-name" className="block text-[11px] font-bold uppercase tracking-wide text-muted">
              Назва каналу
            </label>
            <Input
              id="new-channel-name"
              autoFocus
              value={newChannelName}
              onChange={event => setNewChannelName(event.target.value)}
              placeholder="наприклад, дизайн-команда"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-channel-description" className="block text-[11px] font-bold uppercase tracking-wide text-muted">
              Опис
            </label>
            <textarea
              id="new-channel-description"
              value={newChannelDescription}
              onChange={event => setNewChannelDescription(event.target.value)}
              placeholder="Про що цей канал?"
              rows={3}
              maxLength={240}
              className="w-full resize-none rounded-[10px] border border-transparent bg-canvas px-3 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-[#a3a3a3] focus:border-ink"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
              Учасники
            </label>
            <MultiSelect
              value={newChannelMemberIds}
              onChange={setNewChannelMemberIds}
              options={channelMemberOptions}
              placeholder="Додати учасників"
              searchPlaceholder="Знайти учасника..."
              triggerIcon={UserPlus}
              dropdownClassName="w-full max-w-none"
            />
            <p className="text-[11px] leading-4 text-muted">
              Ви будете додані автоматично. Інші учасники не додаються, доки ви їх не виберете.
            </p>
          </div>
        </form>
      </Dialog>
      {/* Two-zone layout */}
      <div className="flex-1 flex overflow-hidden gap-3 p-[12px] pt-[56px]">

        {/* LEFT: Sidebar (Settings layout styled) — mobile: full width, hidden when a chat is open */}
        <div className={`${mobilePane === 'chat' ? 'hidden' : 'flex'} md:flex w-full md:w-[280px] bg-canvas rounded-[16px] flex-col overflow-hidden shrink-0`}>
          <aside className="flex-1 overflow-y-auto custom-scrollbar px-[16px] py-[32px]">
            
            {/* Channels group */}
            <div className="mb-[24px]">
              <div className="flex items-center justify-between px-3 pb-[8px] group">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Канали</span>
                {isAdminOrOwner && (
                  <button
                    onClick={() => {
                      resetChannelDraft();
                      setIsCreatingChannel(true);
                    }}
                    className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors"
                    title="Новий канал"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-[2px]">
                {channels
                  .filter(c => {
                    if (c.status === 'archived') return false;
                    if (!c.name?.toLowerCase().includes(chatSearch.toLowerCase())) return false;
                    if (c.members && c.members.length > 0) {
                      return c.members.includes(myUid);
                    }
                    return true;
                  })
                  .map(c => {
                    const unreadCount = channelUnreadCount(c, readState[c.id], myUid);
                    const hasUnread = unreadCount > 0;
                    const active = isActive(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => openChannel({ id: c.id, type: 'channel' })}
                        className={`w-full flex items-center gap-[8px] px-3 py-2 rounded-xl text-left transition-all ${
                          active
                            ? 'bg-[#ebebeb] text-ink font-semibold'
                            : 'text-muted hover:bg-[#ebebeb]/50 hover:text-ink'
                        }`}
                      >
                        <Hash size={14} className={active ? 'text-ink' : 'text-muted'} />
                        <span className={`text-[13px] flex-1 truncate ${hasUnread && !active ? 'font-bold text-ink' : ''}`}>
                          {c.name}
                        </span>
                        {hasUnread && !active && (
                          <Counter value={unreadCount} size="sm" status="muted" className="shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* DMs group */}
            <div>
              <div className="flex items-center justify-between px-3 pb-[8px]">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Особисті</span>
              </div>
              <div className="flex flex-col gap-[2px]">
                {dms
                  .filter(u => u.name?.toLowerCase().includes(chatSearch.toLowerCase()))
                  .map(u => {
                    const active = isActive(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => openChannel({ id: u.id, type: 'dm' })}
                        className={`w-full flex items-center gap-[8px] px-3 py-2 rounded-xl text-left transition-all ${
                          active
                            ? 'bg-[#ebebeb] text-ink font-semibold'
                            : 'text-muted hover:bg-[#ebebeb]/50 hover:text-ink'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-[18px] h-[18px] rounded-full overflow-hidden">
                            <UserAvatar user={{ name: u.name, avatar: u.avatar }} size={18} />
                          </div>
                          {u.online && (
                            <span className="absolute -bottom-[1px] -right-[1px] w-2 h-2 rounded-full bg-[#10b981] border border-canvas" />
                          )}
                        </div>
                        <span className="text-[13px] flex-1 truncate flex items-center gap-1">
                          {u.name}
                          {u.statusEmoji && <span className="cursor-help" title={u.status || 'Статус користувача'}>{u.statusEmoji}</span>}
                        </span>
                        {u.unreadCount > 0 && !active && (
                          <Counter value={u.unreadCount} size="sm" status="muted" className="shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </aside>
        </div>

        {/* RIGHT: Chat + optional sidebar — mobile: shown only when a chat is open */}
        <div className={`${mobilePane === 'list' ? 'hidden' : 'flex'} md:flex flex-1 gap-3 min-w-0 overflow-hidden`}>

          {/* Main chat area */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-canvas">
            
            {/* Chat header */}
            <div className="relative z-10 flex min-h-[64px] shrink-0 items-center gap-2 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl">
              <button
                onClick={requestPaneClose}
                className="md:hidden -ml-1 p-1 text-muted hover:text-ink transition-colors shrink-0"
                title="До списку чатів"
              >
                <ArrowLeft size={18} />
              </button>
              {activeChannel.type === 'channel' ? (
                <Hash size={17} className="text-ink shrink-0" />
              ) : (
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <UserAvatar user={dms.find(d => d.id === activeChannel.id)} size={32} />
                  </div>
                  {dms.find(d => d.id === activeChannel.id)?.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] border-2 border-canvas" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-[15px] text-ink truncate flex items-center gap-1.5">
                  {activeChannel.type === 'channel'
                    ? (channels.find(c => c.id === activeChannel.id)?.name || activeChannel.id)
                    : (
                      <>
                        {dms.find(d => d.id === activeChannel.id)?.name || 'Особисті'}
                        {dms.find(d => d.id === activeChannel.id)?.statusEmoji && (
                          <span
                            className="cursor-help"
                            title={dms.find(d => d.id === activeChannel.id)?.status || 'Статус користувача'}
                          >
                            {dms.find(d => d.id === activeChannel.id).statusEmoji}
                          </span>
                        )}
                      </>
                    )}
                </h2>
                {activeChannel.type === 'dm' && (
                  <p className="text-[11px] text-muted">
                    {dms.find(d => d.id === activeChannel.id)?.online ? 'в мережі' : 'не в мережі'}
                  </p>
                )}
                {activeChannel.type === 'channel' && (activeChannelData?.description || currentChannel?.description) && (
                  <p className="text-[11px] text-muted truncate">
                    {activeChannelData?.description || currentChannel?.description}
                  </p>
                )}
              </div>

              {/* Pinned message count */}
              {activeChannel.type === 'channel' && messages.filter(m => m.isPinned).length > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenChannelInfo('pinned')}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-[#cfcfcf]"
                >
                  <Pin size={12} />
                  <span>{messages.filter(m => m.isPinned).length} закріплено</span>
                </button>
              )}

              {/* Conversation info */}
              <button
                  onClick={() => {
                    if (activeChannel.type === 'dm') {
                      router.push(`/chat?dm=${encodeURIComponent(activeChannel.id)}&member=${encodeURIComponent(activeChannel.id)}`);
                      return;
                    }
                    if (showChannelInfo) {
                      setShowChannelInfo(false);
                    } else {
                      handleOpenChannelInfo('info');
                    }
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    showChannelInfo
                      ? 'text-ink bg-canvas'
                      : 'text-muted hover:text-ink hover:bg-canvas'
                  }`}
                  title={activeChannel.type === 'dm' ? 'Про користувача' : 'Про канал'}
                >
                  <Info size={16} />
                </button>
            </div>

            {/* Search Results Banner */}
            {chatSearch.trim() && (
              <div className="bg-[#fffbe6] border-b border-[#ffe58f] px-6 py-2 flex items-center justify-between shrink-0">
                <p className="text-[13px] text-[#876800]">
                  Знайдено <strong>{displayMessages.length}</strong> {displayMessages.length === 1 ? 'повідомлення' : displayMessages.length < 5 ? 'повідомлення' : 'повідомлень'} за запитом <strong>«{chatSearch}»</strong>
                </p>
                <button onClick={() => setChatSearch('')} className="text-[#d4b106] hover:text-[#ad8b00] text-[13px] font-semibold underline">
                  Очистити
                </button>
              </div>
            )}

            {/* Messages list */}
            <div
              ref={chatScrollRef}
              className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-4 pb-12 pt-2 scroll-pb-12"
            >
              {loading && messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-3 border-line border-t-ink rounded-full animate-spin" />
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <EmptyState
                    icon={MessageSquare}
                    title={chatSearch ? 'Нічого не знайдено' : 'Ще немає повідомлень'}
                    description={chatSearch ? `За запитом «${chatSearch}»` : 'Почніть розмову! 👋'}
                  />
                </div>
              ) : (
                <>
                {/* Only the latest window is subscribed; older history loads on
                    demand so opening a busy channel is not an unbounded read. */}
                {hasMoreMessages && !chatSearch.trim() && (
                  <div className="flex justify-center pb-2 pt-1">
                    <button
                      type="button"
                      onClick={handleLoadOlderMessages}
                      className="rounded-full bg-canvas px-3 py-1 text-[12px] font-semibold text-muted transition-colors hover:bg-[#ebebeb] hover:text-ink"
                    >
                      Показати давніші повідомлення
                    </button>
                  </div>
                )}
                {displayMessages.map((msg, i) => {
                  const prev = i > 0 ? displayMessages[i - 1] : null;
                  const showDateSep = !isSameDay(prev?.createdAt, msg.createdAt);
                  return (
                    <div
                      key={msg.id}
                      ref={element => {
                        if (element) messageRefs.current.set(msg.id, element);
                        else messageRefs.current.delete(msg.id);
                      }}
                    >
                      {showDateSep && msg.createdAt && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-line" />
                          <span className="text-[11px] font-bold text-muted shrink-0 bg-canvas px-3 py-0.5 rounded-full">
                            {formatDateSep(msg.createdAt)}
                          </span>
                          <div className="flex-1 h-px bg-line" />
                        </div>
                      )}
                      <MessageBubble
                        msg={msg}
                        prevMsg={prev}
                        myUid={myUid}
                        members={members}
                        onReact={handleReaction}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                        onThread={handleOpenThread}
                        onPin={handlePin}
                        onOpenAttachment={setViewerAttachment}
                        searchTerm={chatSearch}
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

              <div ref={messagesEndRef} />
            </div>

            {/* New messages badge */}
            {unreadBadge > 0 && isScrolledUp && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
                <button
                  onClick={() => {
                    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
                    setUnreadBadge(0);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-full shadow-xl text-[12px] font-bold hover:bg-[#333] transition-all active:scale-95"
                >
                  <ChevronDown size={14} />
                  {unreadBadge} нових
                </button>
              </div>
            )}

            {/* Input */}
            <ChatComposerDock ref={composerRef} scrollRef={chatScrollRef}>
              <MessageInput
                onSend={handleSendMessage}
                onTyping={handleMainTyping}
                onError={message => showToast(message, 'error')}
                placeholder={activeChannel.type === 'channel'
                  ? `Написати в #${channels.find(c => c.id === activeChannel.id)?.name || 'general'}...`
                  : 'Написати повідомлення...'}
                members={mentionMembers}
              />
            </ChatComposerDock>
          </div>

          {/* Thread sidebar */}
          {activeThreadId && activeThreadParent && (
            <ThreadSidebar
              parentMsg={activeThreadParent}
              replies={threadMessages}
              myUid={myUid}
              members={mentionMembers}
              onSend={handleSendThread}
              onDeleteReply={handleDeleteReply}
              onOpenAttachment={setViewerAttachment}
              onError={message => showToast(message, 'error')}
              onClose={closeThread}
              loading={loading}
            />
          )}

          {/* Channel Info sidebar */}
          {showChannelInfo && activeChannel.type === 'channel' && (
            <ChannelInfoSidebar
              key={activeChannel.id}
              channel={{
                id: activeChannel.id,
                ...(activeChannelData || channels.find(c => c.id === activeChannel.id) || { name: activeChannel.id, type: 'public', description: activeChannel.id === 'general' ? 'Загальний канал для всієї команди' : '', members: [] })
              }}
              members={members}
              messages={messages}
              activeTab={channelInfoTab}
              onTabChange={setChannelInfoTab}
              onOpenAttachment={setViewerAttachment}
              onJumpToMessage={handleJumpToMessage}
              onError={message => showToast(message, 'error')}
              onClose={() => setShowChannelInfo(false)}
              activeOrgId={activeOrgId}
              isAdminOrOwner={isAdminOrOwner}
            />
          )}
        </div>
      </div>
    </div>
  );
}
