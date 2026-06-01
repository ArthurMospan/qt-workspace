import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Send, Activity, MessageSquare } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
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

  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    startIndex: -1,
    cursorIndex: -1,
    selectedIndex: 0,
    ignoreIndex: -1
  });
  const wrapperRef = useRef(null);

  const filteredMembers = useMemo(() => {
    if (!mentionState.active) return [];
    const q = mentionState.query.toLowerCase();
    return members.filter(m => m.name?.toLowerCase().includes(q));
  }, [mentionState.active, mentionState.query, members]);

  const checkMentions = (text, cursorPosition) => {
    setMentionState(prev => {
      const lastAtIdx = text.lastIndexOf('@', cursorPosition - 1);
      if (lastAtIdx === -1) {
        return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      }
      const textBetween = text.slice(lastAtIdx, cursorPosition);
      if (/\s/.test(textBetween)) {
        return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      }
      if (prev.ignoreIndex === lastAtIdx) {
        return prev;
      }
      return {
        active: true,
        query: textBetween.slice(1),
        startIndex: lastAtIdx,
        cursorIndex: cursorPosition,
        selectedIndex: prev.active && prev.startIndex === lastAtIdx ? prev.selectedIndex : 0,
        ignoreIndex: -1
      };
    });
  };

  const selectMention = (member) => {
    const textBefore = input.slice(0, mentionState.startIndex);
    const textAfter = input.slice(mentionState.cursorIndex);
    const mentionText = `@${member.name} `;
    const nextInput = textBefore + mentionText + textAfter;
    setInput(nextInput);
    
    setMentionState({ active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 });
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPosition = textBefore.length + mentionText.length;
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
      }
    }, 0);
  };

  useEffect(() => {
    if (!mentionState.active) return;
    const handleOutsideClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMentionState({ active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 });
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mentionState.active]);

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
                <button 
                  className="shrink-0 mt-auto mb-5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`?member=${item.authorId}`);
                  }}
                  title="Переглянути профіль"
                >
                  <UserAvatar
                    user={{ id: item.authorId, name: item.authorName, avatar: item.authorAvatar }}
                    size={28}
                  />
                </button>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[82%] min-w-0`}>
                  {!isMe && (
                    <span className="text-[11px] font-bold text-[#1f1f1f] mb-1 ml-1 flex items-center gap-1">
                      {item.authorName}
                      {members.find(m => (m.id || m.uid) === item.authorId)?.statusEmoji && <span>{members.find(m => (m.id || m.uid) === item.authorId).statusEmoji}</span>}
                    </span>
                  )}
                  <div className={`px-[14px] py-[10px] text-[13px] leading-[20px] break-words whitespace-pre-wrap shadow-sm border ${
                    isMe
                      ? 'bg-[#1f1f1f] text-white border-[#1f1f1f] rounded-[16px] rounded-br-[4px]'
                      : 'bg-white text-[#1f1f1f] border-[#e4e4e7] rounded-[16px] rounded-bl-[4px]'
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
              <div key={`time-${item.id}`} className="flex justify-center my-1">
                <div className="flex items-center gap-[6px] bg-white border border-[#e4e4e7] shadow-sm text-[#52525b] px-3 py-[6px] rounded-full text-[11px] font-medium">
                  <div className="w-[16px] h-[16px] rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0">
                    <Clock size={10} className="text-[#1f1f1f]" />
                  </div>
                  <span><strong className="text-[#1f1f1f]">{member?.name || 'Хтось'}</strong> списав <strong className="text-[#1f1f1f]">{fmtTime(item.spentMinutes)}</strong>{item.description ? ` — ${item.description}` : ''}</span>
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
      <div className="px-3 pb-3 shrink-0 relative" ref={wrapperRef}>
        {/* Autocomplete Mentions Dropdown */}
        {mentionState.active && filteredMembers.length > 0 && (
          <div className="absolute bottom-[100%] left-3 right-3 mb-2 bg-white border border-[#e9e9e9] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[60] overflow-hidden max-h-[160px] overflow-y-auto">
            {filteredMembers.map((member, index) => {
              const isSelected = index === mentionState.selectedIndex;
              return (
                <button
                  key={member.id || member.uid}
                  onClick={() => selectMention(member)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                    isSelected ? 'bg-[#f4f4f5] text-[#1f1f1f] font-bold' : 'text-[#4b5563] hover:bg-[#fafafa]'
                  }`}
                >
                  <UserAvatar user={member} size={20} />
                  <span>{member.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className={`flex items-end gap-2 bg-white rounded-[16px] px-3 py-[10px] transition-all shadow-sm border ${input ? 'border-[#cfcfcf]' : 'border-[#e4e4e7]'}`}>
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
              checkMentions(e.target.value, e.target.selectionStart);
              // Auto-grow
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onClick={e => {
              checkMentions(e.target.value, e.target.selectionStart);
            }}
            onKeyUp={e => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter' && e.key !== 'Escape') {
                checkMentions(e.target.value, e.target.selectionStart);
              }
            }}
            onKeyDown={e => {
              if (mentionState.active && filteredMembers.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionState(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex + 1) % filteredMembers.length
                  }));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionState(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex - 1 + filteredMembers.length) % filteredMembers.length
                  }));
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  selectMention(filteredMembers[mentionState.selectedIndex]);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setMentionState(prev => ({ ...prev, active: false, ignoreIndex: prev.startIndex }));
                  return;
                }
              }

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Написати повідомлення..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#1f1f1f] placeholder:text-[#a1a1aa] font-medium resize-none leading-[20px] py-[4px] min-h-[28px] max-h-[120px] custom-scrollbar"
            style={{ height: '28px' }}
          />
          <Button
            style="primary"
            size="icon"
            disabled={!input.trim() || sending}
            loading={sending}
            onClick={handleSend}
            className="mb-[1px]"
            icon={Send}
          />
        </div>
        <p className="text-[10px] text-[#cfcfcf] text-center mt-1">Enter — надіслати · Shift+Enter — новий рядок</p>
      </div>
    </div>
  );
}
