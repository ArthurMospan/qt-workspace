import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Send, Activity, MessageSquare } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import useWorkspaceStore from '@/store/useWorkspaceStore';

function fmtTime(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h === 0) return `${m}хв`;
  if (m === 0) return `${h}г`;
  return `${h}г ${m}хв`;
}

function fmtClock(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export default function UnifiedTimeline({ issueId, projectId }) {
  const { currentUser } = useAppContext();
  const { members } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);

  const { comments, addComment } = useComments(issueId);
  const { entries: auditLogs } = useAuditLog(issueId);
  const { logs: timeLogs } = useTimeLogs(issueId);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Combine and sort
  const timeline = useMemo(() => {
    const items = [];

    comments.forEach(c => items.push({
      _type: 'comment',
      _time: c.createdAt?.toMillis ? c.createdAt.toMillis() : Date.now(),
      ...c
    }));

    auditLogs.forEach(a => items.push({
      _type: 'audit',
      _time: a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now(),
      ...a
    }));

    timeLogs.forEach(t => items.push({
      _type: 'time',
      _time: t.loggedAt?.toMillis ? t.loggedAt.toMillis() : Date.now(),
      ...t
    }));

    return items.sort((a, b) => a._time - b._time);
  }, [comments, auditLogs, timeLogs]);

  // Scroll to bottom on new items
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await addComment(issueId, text, currentUser);
      setInput('');
    } catch (err) {
      showToast('Помилка надсилання: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">

      {/* Scrollable Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar flex flex-col gap-3">
        {timeline.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex items-center justify-center">
              <MessageSquare size={18} className="text-[#9a9a9a]" />
            </div>
            <p className="text-[12px] font-medium text-[#9a9a9a]">Поки що немає повідомлень</p>
            <p className="text-[11px] text-[#cfcfcf]">Напиши перше — команда побачить</p>
          </div>
        )}

        {timeline.map(item => {
          // ── Comment ─────────────────────────────────────
          if (item._type === 'comment') {
            const isMe = item.authorId === currentUser?.uid || item.authorId === currentUser?.id;
            return (
              <div key={`comment-${item.id}`} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 mt-auto mb-5">
                  <UserAvatar
                    user={{ id: item.authorId, name: item.authorName, avatar: item.authorAvatar }}
                    size={28}
                  />
                </div>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[82%] min-w-0`}>
                  {!isMe && (
                    <span className="text-[11px] font-bold text-[#1f1f1f] mb-1 ml-1">{item.authorName}</span>
                  )}
                  <div className={`px-[12px] py-[9px] text-[13px] leading-[20px] break-words whitespace-pre-wrap ${
                    isMe
                      ? 'bg-[#1f1f1f] text-white rounded-[14px] rounded-br-[4px]'
                      : 'bg-white text-[#1f1f1f] rounded-[14px] rounded-bl-[4px]'
                  }`}>
                    {item.text}
                  </div>
                  <span className="text-[10px] text-[#cfcfcf] mt-[3px] font-medium">
                    {fmtClock(item.createdAt)}
                  </span>
                </div>
              </div>
            );
          }

          // ── Time log ─────────────────────────────────────
          if (item._type === 'time') {
            const member = members.find(m => m.id === item.userId);
            return (
              <div key={`time-${item.id}`} className="flex justify-center">
                <div className="flex items-center gap-[6px] bg-[#eff6ff] text-[#3b82f6] px-3 py-[5px] rounded-full text-[11px] font-semibold">
                  <Clock size={11} />
                  <span>{member?.name || 'Хтось'} списав <strong>{fmtTime(item.spentMinutes)}</strong>{item.description ? ` — ${item.description}` : ''}</span>
                </div>
              </div>
            );
          }

          // ── Audit log ─────────────────────────────────────
          if (item._type === 'audit') {
            return (
              <div key={`audit-${item.id}`} className="flex justify-center">
                <div className="flex items-center gap-[5px] text-[#9a9a9a] text-[11px] font-medium">
                  <Activity size={10} className="shrink-0" />
                  <span>
                    <strong className="text-[#1f1f1f]">{item.byName || 'Система'}</strong>{' '}
                    {item.action === 'update'
                      ? `змінив ${item.field}${item.newValue ? ` → ${item.newValue}` : ''}`
                      : 'зробив зміну'}
                  </span>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Input Area — main accent */}
      <div className="px-3 pb-3 shrink-0">
        <div className={`flex items-end gap-2 bg-white rounded-[14px] px-3 py-2 transition-all border ${input ? 'border-[#d9d9d9]' : 'border-transparent'}`}>
          <div className="shrink-0 mt-[2px]">
            <UserAvatar
              user={{ id: currentUser?.uid || currentUser?.id, name: currentUser?.name, avatar: currentUser?.avatar }}
              size={24}
            />
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              // Auto-grow
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Написати повідомлення..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#1f1f1f] placeholder:text-[#cfcfcf] font-normal resize-none leading-[20px] py-[4px] min-h-[28px] max-h-[120px] custom-scrollbar"
            style={{ height: '28px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-[30px] h-[30px] bg-[#1f1f1f] disabled:bg-[#ebebeb] disabled:text-[#cfcfcf] rounded-[8px] flex items-center justify-center text-white shrink-0 hover:bg-[#303030] active:scale-95 transition-all mb-[1px]"
          >
            <Send size={13} className="ml-[1px]" />
          </button>
        </div>
        <p className="text-[10px] text-[#cfcfcf] text-center mt-1">Enter — надіслати · Shift+Enter — новий рядок</p>
      </div>
    </div>
  );
}
