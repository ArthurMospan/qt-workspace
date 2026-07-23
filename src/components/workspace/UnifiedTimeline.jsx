'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, CheckCheck, MessageSquare, Paperclip, Pencil, Reply, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import AttachmentViewer from '@/components/workspace/AttachmentViewer';
import { ChatAttachmentList, PendingChatAttachments } from '@/components/workspace/ChatAttachments';
import Button from '@/components/ui/Button';
import { useConfirm } from '@/components/ui';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import { useAppContext } from '@/lib/context/AppContext';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import { uploadFile } from '@/lib/utils/uploadFile';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import MentionText from '@/components/workspace/MentionText';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { extractMentionedUserIds } from '@/lib/utils/mentions';

const FIELD_LABELS = {
  status: 'статус',
  columnId: 'статус',
  priority: 'пріоритет',
  title: 'назву',
  assigneeIds: 'виконавця',
};

const STATUS_LABELS = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  'code-review': 'Code Review',
  qa: 'QA',
  'client-approval': 'Client Approval',
  done: 'Done',
};

function fmtTime(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}хв`;
  if (rest === 0) return `${hours}г`;
  return `${hours}г ${rest}хв`;
}

function fmtClock(timestamp) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function timestampDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(timestamp) {
  const date = timestampDate(timestamp);
  if (!date) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(timestamp) {
  const date = timestampDate(timestamp);
  if (!date) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Сьогодні';
  if (dayKey(date) === dayKey(yesterday)) return 'Вчора';
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function parseArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatAuditValue(field, value, members) {
  if (value === null || value === undefined || value === '') return 'не вказано';
  if (field === 'assigneeIds') {
    const ids = parseArrayValue(value) || [value];
    if (ids.length === 0) return 'не призначено';
    return ids.map(id => members.find(member => (member.id || member.uid) === id)?.name || 'учасника').join(', ');
  }
  if (field === 'status' || field === 'columnId') return STATUS_LABELS[value] || value;
  return String(value);
}

function formatAuditEvent(item, members) {
  const field = item.field || item.action?.replace(/^changed_/, '');
  if (item.action === 'created') return 'Створено завдання';
  if (!field || !FIELD_LABELS[field]) return 'Оновлено завдання';
  const fieldLabel = `${FIELD_LABELS[field][0].toUpperCase()}${FIELD_LABELS[field].slice(1)}`;
  const from = formatAuditValue(field, item.from ?? item.oldValue, members);
  const to = formatAuditValue(field, item.to ?? item.newValue, members);
  if (from === to || from === 'не вказано') return `${fieldLabel} змінено на «${to}»`;
  return `${fieldLabel} змінено: «${from}» → «${to}»`;
}

function ReplyQuote({ replyTo, dark = false }) {
  if (!replyTo) return null;
  return (
    <div className={`mb-2 rounded-[7px] px-2.5 py-2 text-[11px] leading-4 ${dark ? 'bg-white/10 text-white/75' : 'bg-black/[0.05] text-muted'}`}>
      <div className={`mb-0.5 font-bold ${dark ? 'text-white' : 'text-ink'}`}>{replyTo.authorName || 'Учасник'}</div>
      <div className="line-clamp-2 whitespace-pre-wrap">{replyTo.text || 'Вкладення'}</div>
    </div>
  );
}

function StatusEmoji({ member }) {
  if (!member?.statusEmoji) return null;
  return (
    <span
      className="cursor-help"
      title={member.status || 'Статус користувача'}
      aria-label={member.status || 'Статус користувача'}
    >
      {member.statusEmoji}
    </span>
  );
}

function EventMessage({ text, time, actor, isMine = false }) {
  return (
    <div className={`flex items-end gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
      {!isMine && <div className="mb-5 shrink-0"><UserAvatar user={actor} size={28} /></div>}
      <div className={`flex max-w-[84%] min-w-0 flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && (
          <span className="mb-1 ml-1 flex items-center gap-1 text-[11px] font-bold text-ink">
            {actor?.name || 'Система'}
            <StatusEmoji member={actor} />
          </span>
        )}
        <div className={`max-w-full rounded-[16px] px-3 py-2.5 text-[14px] leading-[22px] ${
          isMine
            ? 'rounded-br-none bg-[#303030] text-white'
            : 'rounded-bl-none bg-[#f2f2f7] text-ink'
        }`}>
          {text}
        </div>
        <span className="mt-1 px-1 text-[10px] font-medium text-[#a1a1a1]">{time}</span>
      </div>
    </div>
  );
}

function DaySeparator({ timestamp }) {
  const label = dayLabel(timestamp);
  if (!label) return null;
  return (
    <div className="flex justify-center py-3" aria-label={`Дата: ${label}`}>
      <span className="rounded-full bg-white/75 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted">
        {label}
      </span>
    </div>
  );
}

export default function UnifiedTimeline({ issueId, projectId, isArchived, org, members = [] }) {
  const router = useRouter();
  const { currentUser, projects = [] } = useAppContext();
  const showToast = useWorkspaceStore(state => state.showToast);
  const confirmDialog = useConfirm();
  const project = projects.find(item => item.id === projectId);

  const { comments, addComment, updateComment, deleteComment, markCommentsRead } = useComments(issueId);
  const { entries: auditLogs } = useAuditLog(issueId);
  const { logs: timeLogs } = useTimeLogs(issueId);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);

  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    startIndex: -1,
    cursorIndex: -1,
    selectedIndex: 0,
    ignoreIndex: -1,
  });

  const filteredMembers = useMemo(() => {
    if (!mentionState.active) return [];
    const query = mentionState.query.toLowerCase();
    return members.filter(member => member.name?.toLowerCase().includes(query));
  }, [mentionState.active, mentionState.query, members]);

  const timeline = useMemo(() => {
    const items = [];
    comments.forEach(comment => items.push({
      _type: 'comment',
      _time: comment.createdAt?.toMillis ? comment.createdAt.toMillis() : 0,
      ...comment,
    }));
    auditLogs.forEach(entry => items.push({
      _type: 'audit',
      _time: entry.createdAt?.toMillis ? entry.createdAt.toMillis() : 0,
      ...entry,
    }));
    timeLogs.forEach(log => items.push({
      _type: 'time',
      _time: log.loggedAt?.toMillis ? log.loggedAt.toMillis() : 0,
      ...log,
    }));
    return items.sort((a, b) => a._time - b._time);
  }, [comments, auditLogs, timeLogs]);

  const resetComposer = () => {
    setInput('');
    setPendingFiles([]);
    setReplyTo(null);
    setEditingComment(null);
    if (inputRef.current) inputRef.current.style.height = '32px';
  };

  const focusComposer = () => setTimeout(() => inputRef.current?.focus(), 0);

  const beginReply = comment => {
    setEditingComment(null);
    setReplyTo({ id: comment.id, authorName: comment.authorName, text: comment.text });
    focusComposer();
  };

  const beginEdit = comment => {
    setReplyTo(null);
    setPendingFiles([]);
    setEditingComment(comment);
    setInput(comment.text || '');
    focusComposer();
  };

  const handleDelete = async comment => {
    const hasFiles = Array.isArray(comment.attachments) && comment.attachments.length > 0;
    const confirmed = await confirmDialog({
      title: 'Видалити повідомлення?',
      message: hasFiles
        ? 'Повідомлення та прикріплені файли буде видалено остаточно, зокрема зі сховища.'
        : 'Цю дію неможливо скасувати.',
      confirmText: 'Видалити',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteComment(comment.id, comment.attachments);
      if (editingComment?.id === comment.id || replyTo?.id === comment.id) resetComposer();
    } catch (error) {
      showToast(`Не вдалося видалити повідомлення: ${error.message}`, 'error');
    }
  };

  const checkMentions = (text, cursorPosition) => {
    setMentionState(previous => {
      const lastAtIndex = text.lastIndexOf('@', cursorPosition - 1);
      const lastQuoteIndex = text.lastIndexOf('"', cursorPosition - 1);
      const triggerIndex = Math.max(lastAtIndex, lastQuoteIndex);
      if (triggerIndex === -1) return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      const precedingChar = triggerIndex > 0 ? text[triggerIndex - 1] : '';
      if (precedingChar && !/[\s([{]/.test(precedingChar)) {
        return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      }
      const textBetween = text.slice(triggerIndex + 1, cursorPosition);
      if (/[\n@"]/.test(textBetween)) return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      if (previous.ignoreIndex === triggerIndex) return previous;
      return {
        active: true,
        query: textBetween,
        startIndex: triggerIndex,
        cursorIndex: cursorPosition,
        selectedIndex: previous.active && previous.startIndex === triggerIndex ? previous.selectedIndex : 0,
        ignoreIndex: -1,
      };
    });
  };

  const selectMention = member => {
    const textBefore = input.slice(0, mentionState.startIndex);
    const textAfter = input.slice(mentionState.cursorIndex);
    const mentionText = `@${member.name} `;
    setInput(textBefore + mentionText + textAfter);
    setMentionState({ active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 });
    setTimeout(() => {
      if (!inputRef.current) return;
      const cursorPosition = textBefore.length + mentionText.length;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  };

  useEffect(() => {
    if (!mentionState.active) return undefined;
    const handleOutsideClick = event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setMentionState({ active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 });
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mentionState.active]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline.length]);

  // Read receipts: while the chat is open, mark every visible comment from
  // other people that this user hasn't read yet. Best-effort (see hook).
  const myId = currentUser?.uid || currentUser?.id;
  useEffect(() => {
    if (!myId) return;
    const unread = comments
      .filter(comment => comment.authorId !== myId && !(comment.readBy || []).includes(myId))
      .map(comment => comment.id);
    if (unread.length) markCommentsRead(unread, myId);
  }, [comments, myId, markCommentsRead]);

  const addPendingFiles = fileList => {
    const files = Array.from(fileList || []);
    const accepted = files.filter(file => file.size <= 20 * 1024 * 1024).slice(0, Math.max(0, 5 - pendingFiles.length));
    if (accepted.length !== files.length) showToast('До 5 файлів, максимум 20 МБ кожен', 'error');
    setPendingFiles(previous => [...previous, ...accepted]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || sending) return;
    setSending(true);
    try {
      if (editingComment) {
        await updateComment(editingComment.id, text);
      } else {
        const folder = `organizations/${project?.organizationId || 'shared'}/comments`;
        const attachments = [];
        for (const file of pendingFiles) attachments.push(await uploadFile(file, folder));
        const mentionedUserIds = extractMentionedUserIds(text, members, myId);
        await addComment(issueId, text, currentUser, attachments, replyTo, { mentionedUserIds });
        if (mentionedUserIds.length > 0) {
          try {
            await sendNotification({
              userIds: mentionedUserIds,
              type: 'mentioned',
              title: `${currentUser?.name || 'Колега'} згадав вас у завданні`,
              body: text.slice(0, 500),
              link: `/${projectId}/issue/${issueId}`,
              issueId,
              projectId,
              organizationId: project?.organizationId || org?.id || '',
            });
          } catch (notificationError) {
            console.error('[task-chat] mention notification failed:', notificationError);
            showToast('Повідомлення надіслано, але сповіщення про згадку не доставлено', 'error');
          }
        }
      }
      resetComposer();
    } catch (error) {
      showToast(`Помилка надсилання: ${error.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-canvas">
      {viewerAttachment && <AttachmentViewer attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} />}
      <div ref={scrollRef} className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
        {timeline.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="Ще немає повідомлень"
            description="Почніть обговорення завдання з командою."
            className="flex-1"
          />
        )}

        {timeline.map((item, index) => {
          const itemTimestamp = item._type === 'time' ? item.loggedAt : item.createdAt;
          const previousItem = timeline[index - 1];
          const previousTimestamp = previousItem?._type === 'time' ? previousItem.loggedAt : previousItem?.createdAt;
          const separator = index === 0 || dayKey(itemTimestamp) !== dayKey(previousTimestamp)
            ? <DaySeparator timestamp={itemTimestamp} />
            : null;

          if (item._type === 'comment') {
            const isMe = item.authorId === currentUser?.uid || item.authorId === currentUser?.id;
            const authorMember = members.find(candidate => (candidate.id || candidate.uid) === item.authorId);
            return (
              <Fragment key={`comment-${item.id}`}>
              {separator}
              <div className={`group flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  className="mb-5 mt-auto shrink-0 transition-opacity hover:opacity-80"
                  onClick={() => router.push(`?member=${item.authorId}`)}
                  aria-label={`Профіль: ${item.authorName || 'учасник'}`}
                >
                  <UserAvatar user={{ id: item.authorId, name: item.authorName, avatar: item.authorAvatar }} size={28} />
                </button>
                <div className={`flex max-w-[84%] min-w-0 flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="mb-1 ml-1 flex items-center gap-1 text-[11px] font-bold text-ink">
                      {item.authorName}
                      <StatusEmoji member={authorMember} />
                    </span>
                  )}
                  <div className={`max-w-full break-words p-3 text-[14px] leading-[22px] ${isMe ? 'rounded-[16px] rounded-br-none bg-[#303030] text-white' : 'rounded-[16px] rounded-bl-none bg-white text-ink'}`}>
                    <ReplyQuote replyTo={item.replyTo} dark={isMe} />
                    {item.text && (
                      <div className="whitespace-pre-wrap">
                        <MentionText text={item.text} members={members} dark={isMe} />
                      </div>
                    )}
                    <ChatAttachmentList
                      attachments={item.attachments}
                      dark={isMe}
                      compact
                      className="max-w-[280px]"
                      onOpen={setViewerAttachment}
                    />
                  </div>
                  <div className={`mt-1 flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="px-1 text-[10px] font-medium text-[#a1a1a1]">
                      {fmtClock(item.createdAt)}{item.editedAt ? ' · змінено' : ''}
                    </span>
                    {/* Read receipt на своїх повідомленнях: ✓ надіслано / ✓✓ прочитано іншими */}
                    {isMe && (
                      (item.readBy || []).some(readerId => readerId !== item.authorId)
                        ? <CheckCheck size={13} className="text-muted" aria-label="Прочитано" />
                        : <Check size={13} className="text-[#a1a1a1]" aria-label="Надіслано" />
                    )}
                    {!isArchived && (
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100">
                        <button type="button" onClick={() => beginReply(item)} className="rounded-[6px] p-1 text-muted hover:bg-black/[0.06] hover:text-ink" aria-label="Відповісти" title="Відповісти"><Reply size={12} /></button>
                        {isMe && <button type="button" onClick={() => beginEdit(item)} className="rounded-[6px] p-1 text-muted hover:bg-black/[0.06] hover:text-ink" aria-label="Редагувати повідомлення" title="Редагувати"><Pencil size={12} /></button>}
                        {isMe && <button type="button" onClick={() => handleDelete(item)} className="rounded-[6px] p-1 text-muted hover:bg-red-100 hover:text-red-500" aria-label="Видалити повідомлення" title="Видалити"><Trash2 size={12} /></button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </Fragment>
            );
          }

          if (item._type === 'time') {
            const member = members.find(candidate => (candidate.id || candidate.uid) === item.userId);
            const text = `Списано ${fmtTime(item.spentMinutes)}${item.description ? ` · ${item.description}` : ''}`;
            const actor = member
              ? { ...member, id: member.id || member.uid, avatar: member.avatar || member.photoURL }
              : { id: item.userId, name: item.userName || 'Учасник' };
            return <Fragment key={`time-${item.id}`}>{separator}<EventMessage text={text} time={fmtClock(item.loggedAt)} actor={actor} isMine={item.userId === myId} /></Fragment>;
          }

          if (item._type === 'audit') {
            const member = members.find(candidate => (candidate.id || candidate.uid) === item.userId);
            const actor = item.userId
              ? { ...member, id: item.userId, name: item.userName || member?.name || 'Учасник', avatar: member?.avatar || member?.photoURL }
              : { id: org?.id, name: org?.name || 'Організація', avatar: org?.logo || org?.logoUrl };
            return <Fragment key={`audit-${item.id}`}>{separator}<EventMessage text={formatAuditEvent(item, members)} time={fmtClock(item.createdAt)} actor={actor} isMine={item.userId === myId} /></Fragment>;
          }
          return null;
        })}
      </div>

      {!isArchived && (
        <div className="relative shrink-0 bg-gradient-to-b from-transparent via-canvas/90 via-[45%] to-canvas px-4 pb-5 pt-3" ref={wrapperRef}>
          {mentionState.active && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 z-[60] mb-2 max-h-[160px] overflow-y-auto rounded-[10px] border border-[#d7d7d7] bg-white p-1">
              {filteredMembers.map((member, index) => (
                <button
                  key={member.id || member.uid}
                  type="button"
                  onClick={() => selectMention(member)}
                  className={`flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[13px] font-medium ${index === mentionState.selectedIndex ? 'bg-canvas text-ink' : 'text-muted hover:bg-[#f7f7f7]'}`}
                >
                  <UserAvatar user={member} size={20} />
                  <span>{member.name}</span>
                </button>
              ))}
            </div>
          )}

          {(replyTo || editingComment) && (
            <div className="mb-2 flex items-start gap-2 rounded-[10px] bg-black/[0.05] px-3 py-2">
              <div className="min-w-0 flex-1 border-l-2 border-[#8d8d8d] pl-2">
                <div className="text-[11px] font-bold text-ink">{editingComment ? 'Редагування повідомлення' : `Відповідь для ${replyTo.authorName || 'учасника'}`}</div>
                <div className="truncate text-[11px] text-muted">{editingComment?.text || replyTo?.text || 'Вкладення'}</div>
              </div>
              <button type="button" onClick={resetComposer} className="rounded-[6px] p-1 text-muted hover:bg-black/[0.06] hover:text-ink" aria-label="Скасувати"><X size={13} /></button>
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={event => { addPendingFiles(event.target.files); event.target.value = ''; }} />
          <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.04] transition-all hover:ring-black/10 focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            {pendingFiles.length > 0 && (
              <div className="border-b border-black/[0.05] p-2">
                <PendingChatAttachments
                  files={pendingFiles}
                  onRemove={index => setPendingFiles(files => files.filter((_, fileIndex) => fileIndex !== index))}
                />
              </div>
            )}
            <div className="flex min-h-[44px] items-end gap-1 p-1">
              {!editingComment && <Button className="self-center" style="ghost" size="icon" icon={Paperclip} type="button" onClick={() => fileInputRef.current?.click()} aria-label="Додати файл" title="Додати файл" />}
              <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={event => {
                setInput(event.target.value);
                checkMentions(event.target.value, event.target.selectionStart);
                event.target.style.height = 'auto';
                event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
              }}
              onClick={event => checkMentions(event.target.value, event.target.selectionStart)}
              onKeyDown={event => {
                if (mentionState.active && filteredMembers.length > 0) {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const delta = event.key === 'ArrowDown' ? 1 : -1;
                    setMentionState(previous => ({ ...previous, selectedIndex: (previous.selectedIndex + delta + filteredMembers.length) % filteredMembers.length }));
                    return;
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    selectMention(filteredMembers[mentionState.selectedIndex]);
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setMentionState(previous => ({ ...previous, active: false, ignoreIndex: previous.startIndex }));
                    return;
                  }
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder={editingComment ? 'Змінити повідомлення...' : 'Написати повідомлення...'}
              className="custom-scrollbar min-h-[36px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[14px] leading-5 text-ink outline-none placeholder:text-muted"
              style={{ height: '32px' }}
              />
              <button
              type="button"
              disabled={(!input.trim() && pendingFiles.length === 0) || sending}
              onClick={handleSend}
              aria-label={editingComment ? 'Зберегти зміни' : 'Надіслати'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105 disabled:bg-[#cfcfcf] disabled:hover:scale-100"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
