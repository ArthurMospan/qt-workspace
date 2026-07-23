'use client';
// src/app/workspace/chat/page.js — Rebuilt from scratch
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Hash, MessageSquare, Send, Smile, Paperclip, Plus, Edit2,
  Trash2, X, Pin, ChevronDown, Info, Users, UserPlus, ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import Button from '@/components/ui/Button';
import { useConfirm, EmptyState } from '@/components/ui';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { useWorkspaceChat } from '@/lib/hooks/useWorkspaceChat';
import { useMobilePaneBack } from '@/lib/hooks/useMobilePaneBack';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import MessageContent from '@/components/workspace/MessageContent';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, updateDoc, doc, setDoc
} from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';
import EmojiPicker from 'emoji-picker-react';

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
  onPin, channelId, orgId, isThread = false, sprints = [], searchTerm = ''
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text || '');
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const router = useRouter();
  const confirmDialog = useConfirm();

  const showHeader = !prevMsg
    || prevMsg.senderId !== msg.senderId
    || msg.isSystem
    || prevMsg.isSystem
    || ((msg.createdAt?.toMillis?.() ?? 0) - (prevMsg.createdAt?.toMillis?.() ?? 0) > 300000);

  const isMe = msg.senderId === myUid;

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
      onMouseLeave={() => { setShowActions(false); if (!showEmoji) {} }}
    >
      {/* Avatar or time gutter */}
      <div className="w-9 shrink-0 flex justify-end items-start pt-0.5">
        {showHeader ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              router.push(`?member=${msg.senderId}`);
            }}
            className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            title="Переглянути профіль"
          >
            <UserAvatar user={{ name: msg.user, avatar: members?.find(m => (m.id || m.uid) === msg.senderId)?.avatar || msg.avatar }} size={36} />
          </button>
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
              {members?.find(m => (m.id || m.uid) === msg.senderId)?.statusEmoji && <span>{members.find(m => (m.id || m.uid) === msg.senderId).statusEmoji}</span>}
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
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.attachments.map((att, i) => (
                  att.type?.startsWith('image/') ? (
                    <a key={i} href={att.url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.url} alt={att.name} className="rounded-xl border border-line max-h-[240px] max-w-[360px] object-cover hover:opacity-90 transition-opacity cursor-zoom-in" />
                    </a>
                  ) : (
                    <a key={i} href={att.url} target="_blank" rel="noopener"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-line rounded-xl text-[13px] hover:bg-canvas transition-colors">
                      <Paperclip size={14} className="text-muted shrink-0" />
                      <span className="font-medium text-ink truncate max-w-[200px]">{att.name}</span>
                      {att.size && <span className="text-muted text-[11px] shrink-0">{Math.round(att.size / 1024)}KB</span>}
                    </a>
                  )
                ))}
              </div>
            )}

            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(msg.reactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => {
                  const reacted = users.includes(myUid);
                  return (
                    <button
                      key={emoji}
                      onClick={() => onReact(msg.id, emoji)}
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
      {showActions && !editing && (
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
            {showEmoji && (
              <div ref={emojiPickerRef} className="absolute right-0 top-[calc(100%+8px)] z-50 shadow-2xl rounded-2xl overflow-hidden">
                <EmojiPicker
                  onEmojiClick={(d) => { onReact(msg.id, d.emoji); setShowEmoji(false); setShowActions(false); }}
                  autoFocusSearch={false}
                  skinTonesDisabled
                  width={300}
                  height={360}
                  emojiStyle="native"
                />
              </div>
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
function MessageInput({ onSend, onTyping, placeholder = 'Написати повідомлення...', members = [] }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionType, setMentionType] = useState(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursor, setMentionCursor] = useState(0);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const emojiRef = useRef(null);
  const emojiBtnRef = useRef(null);

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
    const matchUser = before.match(/@([a-zA-Zа-яА-ЯіІїЇєЄ0-9_]*)$/);
    if (matchUser) {
      setMentionType('user');
      setMentionQuery(matchUser[1].toLowerCase());
      setMentionCursor(cursor);
    } else {
      setMentionType(null);
      setMentionQuery('');
    }
    // Notify parent about typing
    if (onTyping) onTyping();
  };

  const handleKey = (e) => {
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
    if (!text.trim() && attachments.length === 0) return;
    setUploading(true);
    let uploaded = [];
    if (attachments.length > 0) {
      try {
        uploaded = await Promise.all(attachments.map(a => uploadFile(a.file, 'chat/attachments')));
      } catch (e) {
        console.error('Upload error', e);
        setUploading(false);
        return;
      }
    }
    await onSend(text, uploaded);
    setText('');
    setAttachments([]);
    setUploading(false);
    setMentionType(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachments(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f), type: f.type, name: f.name, size: f.size }))]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const insertMention = (member) => {
    const name = member.name || member.email;
    const before = text.slice(0, mentionCursor - mentionQuery.length - 1);
    const after = text.slice(mentionCursor);
    const newText = `${before}@${name} ${after}`;
    setText(newText);
    setMentionType(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredMembers = mentionType === 'user'
    ? members.filter(m => (m.name || m.email || '').toLowerCase().includes(mentionQuery))
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
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full left-4 mb-2 z-30 shadow-2xl rounded-2xl overflow-hidden">
          <EmojiPicker
            onEmojiClick={(d) => { setText(prev => prev + d.emoji); setShowEmoji(false); textareaRef.current?.focus(); }}
            autoFocusSearch={false}
            skinTonesDisabled
            width={320}
            height={380}
            emojiStyle="native"
          />
        </div>
      )}

      {/* Input card */}
      <div className={`bg-white rounded-2xl border transition-colors ${text.trim() || attachments.length > 0 ? 'border-[#d0d0d0]' : 'border-line'}`}>
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <div key={i} className="relative">
                {att.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.url} alt={att.name} className="h-16 rounded-xl object-cover border border-line" />
                ) : (
                  <div className="h-12 px-3 flex items-center gap-2 bg-canvas rounded-xl border border-line">
                    <Paperclip size={14} className="text-muted" />
                    <span className="text-[12px] font-medium text-ink max-w-[120px] truncate">{att.name}</span>
                  </div>
                )}
                <button
                  onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink rounded-full flex items-center justify-center text-white hover:bg-[#ef4444] transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
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
              ref={emojiBtnRef}
              onClick={() => setShowEmoji(v => !v)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showEmoji ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas hover:text-ink'}`}
              title="Emoji"
            >
              <Smile size={17} />
            </button>
            <input type="file" multiple ref={fileRef} onChange={handleFiles} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
              title="Прикріпити файл"
            >
              <Paperclip size={17} />
            </button>
          </div>

          <button
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
  parentMsg, replies, myUid, members, onSend, onDeleteReply, onClose, loading
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
      <div className="flex items-center justify-between px-5 h-[56px] shrink-0 border-b border-line/70">
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
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-white transition-colors"
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 flex flex-col gap-0.5">
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
                {reply.attachments?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {reply.attachments.map((att, j) => (
                      att.type?.startsWith('image/') ? (
                        <a key={j} href={att.url} target="_blank" rel="noopener">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={att.url} alt={att.name} className="rounded-xl border border-line max-h-[120px] object-cover" />
                        </a>
                      ) : (
                        <a key={j} href={att.url} target="_blank" rel="noopener"
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-line rounded-xl text-[11px] hover:bg-canvas transition-colors">
                          <Paperclip size={11} className="text-muted" />
                          <span className="font-medium text-ink">{att.name}</span>
                        </a>
                      )
                    ))}
                  </div>
                )}
              </div>
              {reply.senderId === myUid && (
                <button
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Видалити відповідь?', confirmText: 'Видалити', danger: true })) onDeleteReply(reply.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-[#ef4444] hover:bg-red-50 transition-all shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Thread Input */}
      <div className="px-4 pb-4 shrink-0">
        <MessageInput onSend={onSend} placeholder="Відповісти в гілку..." members={members} />
      </div>
    </div>
  );
}

// ─── Channel Info Sidebar ───────────────────────────────────────────────────
function ChannelInfoSidebar({
  channel,
  members,
  onClose,
  activeOrgId,
  isAdminOrOwner
}) {
  const [description, setDescription] = useState(channel?.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  
  const channelMembers = channel?.members || [];
  const myUid = doc.id; // not used directly, safe
  
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
    }
  };

  const handleRemoveMember = async (uid) => {
    try {
      let currentList = [...channelMembers];
      if (currentList.length === 0) {
        currentList = members.map(m => m.id || m.uid);
      }
      const updatedList = currentList.filter(id => id !== uid);
      await setDoc(doc(db, 'organizations', activeOrgId, 'channels', channel.id), {
        members: updatedList
      }, { merge: true });
    } catch (e) {
      console.error(e);
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
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
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
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { currentUser, projects, activeOrgId } = useAppContext();
  const { members } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);
  const chatSearch = useWorkspaceStore(s => s.chatSearch);
  const setChatSearch = useWorkspaceStore(s => s.setChatSearch);
  const setChatOnlineUsers = useWorkspaceStore(s => s.setChatOnlineUsers);

  const [activeChannel, setActiveChannel] = useState({ id: 'general', type: 'channel' });
  // Mobile single-pane mode: 'list' (channels) або 'chat' (розмова); md+ показує обидві панелі
  const [mobilePane, setMobilePane] = useState('list');
  const openChannel = (ch) => { setActiveChannel(ch); setMobilePane('chat'); };
  // Системний «назад» на телефоні повертає до списку чатів, а не виходить зі сторінки
  const requestPaneClose = useMobilePaneBack(mobilePane === 'chat', () => setMobilePane('list'));
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [presenceMap, setPresenceMap] = useState({});
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadBadge, setUnreadBadge] = useState(0);
  const [lastMsgCount, setLastMsgCount] = useState(0);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
    const other = activeChannel.id;
    if (!myUid || !other) return 'general';
    return [myUid, other].sort().join('_');
  }, [activeChannel, myUid]);

  const {
    channels, messages, loading, activeChannelData,
    activeThreadId, threadMessages, activeDMs, readState,
    sendMessage, deleteMessage, editMessage, toggleReaction,
    createChannel, setTyping, openThread, closeThread,
    sendThreadMessage, markAsRead, deleteReply
  } = useWorkspaceChat(getRoomId(), activeChannel.type);

  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const typingRef = useRef(null);
  const channelInputRef = useRef(null);

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const count = messages.length;
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: count <= 1 ? 'instant' : 'smooth' });
    } else if (count > lastMsgCount && lastMsgCount > 0) {
      queueMicrotask(() => setUnreadBadge(v => v + (count - lastMsgCount)));
    }
    queueMicrotask(() => setLastMsgCount(count));
  }, [messages.length]); // eslint-disable-line

  // Mark as read + scroll to bottom when switching channel
  useEffect(() => {
    markAsRead(getRoomId());
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

  // DMs list
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
        online: lastActive && (now - new Date(lastActive).getTime() < 120000),
        avatar: m.avatar,
        isActive: activeDMSet.has(id),
        statusEmoji: m.statusEmoji
      };
    })
    .sort((a, b) => {
      if (a.online !== b.online) return b.online ? 1 : -1;
      if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeDMs, activeChannel.id, activeChannel.type, members, myUid, now, presenceMap]);

  const isActive = (id) => activeChannel.id === id;
  const activeThreadParent = activeThreadId ? messages.find(m => m.id === activeThreadId) : null;
  const currentChannel = channels.find(c => c.id === activeChannel.id);

  // Sync online users to global header
  const onlineUsersForHeader = useMemo(() => dms
      .filter(u => u.online)
      .map(u => ({ name: u.name, avatar: u.avatar })), [dms]);
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
    }
  };

  const handleCreateChannel = async (e) => {
    if (e.key === 'Enter' && newChannelName.trim()) {
      const id = await createChannel(newChannelName.trim());
      if (id) {
        setIsCreatingChannel(false);
        setNewChannelName('');
        openChannel({ id, type: 'channel' });
        showToast('Канал створено ✓');
      } else {
        showToast('Помилка при створенні каналу');
      }
    } else if (e.key === 'Escape') {
      setIsCreatingChannel(false);
      setNewChannelName('');
    }
  };

  const handleSendMessage = async (text, attachments) => {
    clearTimeout(typingRef.current);
    setTyping(false);
    await sendMessage(text, attachments);
  };

  const handleTyping = () => {
    setTyping(true);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => setTyping(false), 2000);
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
    ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase()))
    : messages;

  const typingUsers = (activeChannelData?.typing || [])
    .filter(uid => uid !== myUid)
    .map(uid => members.find(m => (m.id || m.uid) === uid)?.name || 'Хтось');

  const handleOpenThread = (msgId) => {
    setShowChannelInfo(false);
    openThread(msgId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
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
                    onClick={() => setIsCreatingChannel(true)}
                    className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors"
                    title="Новий канал"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {isCreatingChannel && (
                <div className="mb-1.5 px-3">
                  <input
                    ref={channelInputRef}
                    autoFocus
                    type="text"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    onKeyDown={handleCreateChannel}
                    onBlur={() => { setIsCreatingChannel(false); setNewChannelName(''); }}
                    placeholder="назва-каналу"
                    className="w-full text-[13px] bg-white border border-line focus:border-ink rounded-xl px-3 py-2 outline-none transition-colors"
                  />
                </div>
              )}

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
                    const hasUnread = readState[c.id] && c.lastMessageAt &&
                      (c.lastMessageAt?.toMillis?.() ?? 0) > (readState[c.id]?.toMillis?.() ?? 0);
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
                          <span className="w-2 h-2 rounded-full bg-ink shrink-0" />
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
                          {u.statusEmoji && <span>{u.statusEmoji}</span>}
                        </span>
                        {u.online && !active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />
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
          <div className="flex-1 bg-canvas rounded-[16px] flex flex-col overflow-hidden min-w-0 relative">
            
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 md:px-6 h-14 shrink-0 border-b border-line/70">
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
                        {dms.find(d => d.id === activeChannel.id)?.statusEmoji && <span>{dms.find(d => d.id === activeChannel.id).statusEmoji}</span>}
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
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl border border-line text-[12px] font-medium text-ink">
                  <Pin size={12} />
                  <span>{messages.filter(m => m.isPinned).length} закріплено</span>
                </div>
              )}

              {/* Channel Info Toggle Button */}
              {activeChannel.type === 'channel' && (
                <button
                  onClick={() => {
                    setShowChannelInfo(v => !v);
                    closeThread();
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    showChannelInfo
                      ? 'text-ink bg-canvas'
                      : 'text-muted hover:text-ink hover:bg-canvas'
                  }`}
                  title="Про канал"
                >
                  <Info size={16} />
                </button>
              )}
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
              className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2"
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
                displayMessages.map((msg, i) => {
                  const prev = i > 0 ? displayMessages[i - 1] : null;
                  const showDateSep = !isSameDay(prev?.createdAt, msg.createdAt);
                  return (
                    <React.Fragment key={msg.id}>
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
                        onReact={toggleReaction}
                        onEdit={editMessage}
                        onDelete={deleteMessage}
                        onThread={handleOpenThread}
                        onPin={handlePin}
                        channelId={getRoomId()}
                        orgId={activeOrgId}
                        searchTerm={chatSearch}
                      />
                    </React.Fragment>
                  );
                })
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
            <MessageInput
              onSend={handleSendMessage}
              onTyping={handleMainTyping}
              placeholder={`Написати в ${activeChannel.type === 'channel' ? '#' : ''}${activeChannel.type === 'channel' ? (channels.find(c => c.id === activeChannel.id)?.name || 'general') : (dms.find(d => d.id === activeChannel.id)?.name || 'Особисті')}...`}
              members={members}
            />
          </div>

          {/* Thread sidebar */}
          {activeThreadId && activeThreadParent && (
            <ThreadSidebar
              parentMsg={activeThreadParent}
              replies={threadMessages}
              myUid={myUid}
              members={members}
              onSend={handleSendThread}
              onDeleteReply={(replyId) => deleteReply(activeThreadId, replyId)}
              onClose={closeThread}
              loading={loading}
            />
          )}

          {/* Channel Info sidebar */}
          {showChannelInfo && activeChannel.type === 'channel' && (
            <ChannelInfoSidebar
              channel={{
                id: activeChannel.id,
                ...(activeChannelData || channels.find(c => c.id === activeChannel.id) || { name: activeChannel.id, type: 'public', description: activeChannel.id === 'general' ? 'Загальний канал для всієї команди' : '', members: [] })
              }}
              members={members}
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
