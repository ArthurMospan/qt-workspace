import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, Clock, Plus, Send, Activity, History } from 'lucide-react';
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

export default function UnifiedTimeline({ issueId, projectId }) {
  const { currentUser } = useAppContext();
  const { members } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);

  const { comments, addComment } = useComments(issueId);
  const { entries: auditLogs } = useAuditLog(issueId);
  const { logs: timeLogs } = useTimeLogs(issueId);

  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  // Combine and sort
  const timeline = useMemo(() => {
    const items = [];
    
    comments.forEach(c => {
      items.push({
        _type: 'comment',
        _time: c.createdAt?.toMillis ? c.createdAt.toMillis() : Date.now(),
        ...c
      });
    });

    auditLogs.forEach(a => {
      items.push({
        _type: 'audit',
        _time: a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now(),
        ...a
      });
    });

    timeLogs.forEach(t => {
      items.push({
        _type: 'time',
        _time: t.loggedAt?.toMillis ? t.loggedAt.toMillis() : Date.now(),
        ...t
      });
    });

    // Sort ascending (oldest first)
    return items.sort((a, b) => a._time - b._time);
  }, [comments, auditLogs, timeLogs]);

  // Scroll to bottom on new items
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline.length]);

  const handleSend = async () => {
    if (!input.trim()) return;
    try {
      await addComment(issueId, input, currentUser);
      setInput('');
    } catch (err) {
      showToast('Помилка надсилання: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fcfcfc]">
      
      {/* Scrollable Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-[20px] py-[24px] space-y-[20px] custom-scrollbar">
        {timeline.map(item => {
          if (item._type === 'comment') {
            const isMe = item.authorId === currentUser?.uid || item.authorId === currentUser?.id;
            return (
              <div key={`comment-${item.id}`} className={`flex gap-[12px] ${isMe ? 'flex-row-reverse' : ''}`}>
                <UserAvatar user={{ id: item.authorId, name: item.authorName, avatar: item.authorAvatar }} size={32} className="mt-auto mb-[20px] shrink-0" />
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] min-w-0`}>
                  {!isMe && <span className="text-[11px] font-bold text-[#1f1f1f] mb-[4px] ml-[4px]">{item.authorName}</span>}
                  <div className={`p-[12px] rounded-[16px] text-[14px] leading-[22px] break-words whitespace-pre-wrap ${
                    isMe 
                      ? 'bg-[#1f1f1f] text-white rounded-br-none' 
                      : 'bg-[#f0f0f0] text-[#1f1f1f] rounded-bl-none'
                  }`}>
                    {item.text}
                  </div>
                  <span className="text-[10px] text-[#9a9a9a] mt-[4px] font-medium">
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            );
          }

          if (item._type === 'time') {
            const member = members.find(m => m.id === item.userId);
            return (
              <div key={`time-${item.id}`} className="flex justify-center my-[16px]">
                <div className="bg-[#eef2ff] text-[#6366f1] px-[16px] py-[8px] rounded-[14px] text-[12px] font-medium text-center flex items-center gap-[8px]">
                  <Clock size={14} />
                  <span>
                    <strong>{member?.name || 'Хтось'}</strong> списав <strong>{fmtTime(item.spentMinutes)}</strong>
                    {item.description ? `: ${item.description}` : ''}
                  </span>
                </div>
              </div>
            );
          }

          if (item._type === 'audit') {
            return (
              <div key={`audit-${item.id}`} className="flex justify-center my-[16px]">
                <div className="bg-[#f7f7f7] text-[#9a9a9a] px-[16px] py-[6px] rounded-[12px] text-[11px] font-medium text-center flex items-center gap-[6px]">
                  <Activity size={12} />
                  <span>
                    <strong>{item.byName || 'Система'}</strong>{' '}
                    {item.action === 'update' ? `змінив ${item.field} на ${item.newValue || 'пусто'}` : 'зробив зміну'}
                  </span>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Input Area */}
      <div className="p-[16px] bg-white border-t border-[#f0f0f0] shrink-0">
        <div className="flex bg-[#f7f7f7] rounded-[24px] pl-[20px] pr-[4px] py-[4px] items-center gap-[8px] min-h-[48px]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Написати повідомлення..."
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-[#1f1f1f] placeholder:text-[#9a9a9a] font-normal"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-[40px] h-[40px] bg-[#1f1f1f] disabled:bg-[#e9e9e9] disabled:text-[#9a9a9a] rounded-full flex items-center justify-center text-white shrink-0 hover:bg-[#303030] transition-colors"
          >
            <Send size={16} className="ml-[2px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
