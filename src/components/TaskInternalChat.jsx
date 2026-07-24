'use client';
// src/components/TaskInternalChat.jsx — Team-only comment thread
import { useState, useRef, useEffect } from 'react';
import UserAvatar from './UserAvatar';
import ChatComposerDock from './ui/ChatComposerDock';
import { useTaskChat } from '@/lib/hooks/useTaskChat';
import { useAppContext } from '@/lib/context/AppContext';

export default function TaskInternalChat({ taskId }) {
  const { currentUser } = useAppContext();
  const { comments, loading, sendComment, deleteComment } = useTaskChat(taskId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try { await sendComment(text, currentUser); setText(''); }
    finally { setSending(false); }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-[24px] h-[24px] border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Internal badge */}
      <div className="flex items-center gap-[8px] mb-[14px]">
        <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-[8px] py-[3px] rounded-full flex items-center gap-[5px]">
          🔒 Тільки для команди
        </span>
        <span className="text-white/20 text-[10px]">Клієнт не бачить</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-[12px] pb-[48px] pr-[2px]">
        {comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-[40px] text-center">
            <div className="text-[30px] mb-[8px]">💬</div>
            <p className="text-white/25 text-[12px]">Обговорюйте завдання тут</p>
          </div>
        )}
        {comments.map(comment => {
          const isMe = comment.senderId === currentUser?.id;
          const time = comment.createdAt?.toDate
            ? comment.createdAt.toDate().toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })
            : '';
          return (
            <div key={comment.id} className={`flex gap-[9px] group ${isMe ? 'flex-row-reverse' : ''}`}>
              <UserAvatar
                user={{ avatar: comment.senderAvatar, name: comment.senderName, id: comment.senderId }}
                className="w-[28px] h-[28px] shrink-0 mt-[2px]"
              />
              <div className={`flex flex-col gap-[2px] max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-[6px] ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-white/50 text-[10px] font-semibold">{comment.senderName}</span>
                  <span className="text-white/20 text-[10px]">{time}</span>
                  {isMe && (
                    <button onClick={() => deleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all text-[10px]">✕</button>
                  )}
                </div>
                <div className={`px-[11px] py-[7px] rounded-[12px] text-[12px] leading-relaxed break-words ${
                  isMe ? 'bg-blue-600/25 text-white rounded-tr-[3px]' : 'bg-white/[0.06] text-white/80 rounded-tl-[3px]'
                }`}>
                  {comment.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatComposerDock
        as="form"
        scrollRef={scrollRef}
        onSubmit={handleSend}
        className="flex gap-[8px] pt-[12px]"
        style={{ '--chat-composer-surface': '#171717' }}
      >
        <UserAvatar user={currentUser} className="w-[28px] h-[28px] shrink-0" />
        <div className="flex-1 flex items-center gap-[8px] bg-white/[0.05] border border-white/[0.08] rounded-[10px] px-[11px] py-[7px]">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Коментар для команди..."
            className="flex-1 bg-transparent text-white text-[12px] placeholder-white/20 min-w-0"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          />
          <button type="submit" disabled={!text.trim() || sending} className="text-blue-400 hover:text-blue-300 disabled:text-white/20 transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </ChatComposerDock>
    </div>
  );
}
