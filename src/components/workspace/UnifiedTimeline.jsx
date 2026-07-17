'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, Eye, FileText, Paperclip, Pencil, Reply, Send, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import AttachmentViewer from '@/components/workspace/AttachmentViewer';
import Button from '@/components/ui/Button';
import { useConfirm } from '@/components/ui';
import { useAppContext } from '@/lib/context/AppContext';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import { uploadFile } from '@/lib/utils/uploadFile';
import useWorkspaceStore from '@/store/useWorkspaceStore';

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

function attachmentUrl(attachment) {
  return attachment?.previewUrl || attachment?.url || attachment?.downloadUrl || attachment?.downloadURL || attachment?.audioUrl || '';
}

function isImageAttachment(attachment) {
  const declaredType = (attachment?.resourceType || attachment?.mimeType || attachment?.type || '').toLowerCase();
  if (declaredType === 'image' || declaredType.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif|tiff?)(?:[?#]|$)/i.test(`${attachment?.name || ''} ${attachmentUrl(attachment)}`);
}

function fmtBytes(bytes) {
  if (!bytes || bytes < 0) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex > 0 && value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

function AttachmentPreview({ attachment, dark = false, previewUrl, onRemove, onOpen }) {
  const url = previewUrl || attachmentUrl(attachment);
  const name = attachment.name || 'Файл';
  const image = isImageAttachment(attachment) && url;
  const sizeLabel = fmtBytes(attachment.size);

  if (image) {
    const imageContent = (
      <>
        <span className="relative block h-[140px] w-full overflow-hidden bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          {!onRemove && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white"><Eye size={15} /></span>
            </span>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label={`Прибрати ${name}`} className="absolute right-2 top-2 z-10 rounded-[7px] bg-black/55 p-1.5 text-white hover:bg-black/70"><X size={14} /></button>
          )}
        </span>
        <span className={`flex items-center gap-2 px-3 py-2 ${dark ? 'bg-white/10' : 'bg-white/90'}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold">{name}</span>
            {sizeLabel && <span className={`block text-[10px] ${dark ? 'text-white/55' : 'text-faint'}`}>{sizeLabel}</span>}
          </span>
          {!onRemove && <Eye size={14} className={dark ? 'text-white/55' : 'text-faint'} />}
        </span>
      </>
    );

    const imageClassName = `group block w-full overflow-hidden rounded-[10px] border text-left transition-colors ${dark ? 'border-white/10 text-white hover:border-white/20' : 'border-black/[0.06] text-ink hover:border-[#d7d7d7]'}`;
    return onRemove
      ? <div className={imageClassName}>{imageContent}</div>
      : <button type="button" onClick={() => onOpen?.({ ...attachment, previewUrl: url })} className={imageClassName} aria-label={`Переглянути ${name}`}>{imageContent}</button>;
  }

  const className = `flex min-w-0 w-full items-center gap-3 rounded-[8px] border border-transparent px-2 py-2 text-left transition-colors ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white/80 text-ink hover:border-[#d7d7d7] hover:bg-white'}`;
  const content = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[6px] ${dark ? 'bg-white/10' : 'bg-canvas'}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : <FileText size={16} className={dark ? 'text-white/65' : 'text-muted'} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold">{name}</span>
        {sizeLabel && <span className={`block text-[10px] ${dark ? 'text-white/55' : 'text-faint'}`}>{sizeLabel}</span>}
      </span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Прибрати ${name}`} className={`shrink-0 rounded-[6px] p-1 ${dark ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-faint hover:bg-canvas hover:text-ink'}`}><X size={13} /></button>
      ) : <Eye size={14} className={`shrink-0 ${dark ? 'text-white/45' : 'text-faint'}`} />}
    </>
  );

  return url && !onRemove ? (
    <button type="button" onClick={() => onOpen?.({ ...attachment, previewUrl: url })} className={className} aria-label={`Переглянути ${name}`}>{content}</button>
  ) : <div className={className}>{content}</div>;
}

function PendingAttachmentPreview({ file, onRemove }) {
  const [previewUrl] = useState(() => file?.type?.startsWith('image/') ? URL.createObjectURL(file) : '');
  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  return <AttachmentPreview attachment={file} previewUrl={previewUrl} onRemove={onRemove} />;
}

function CommentAttachments({ attachments = [], dark = false, onOpen }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex min-w-[210px] max-w-[280px] flex-col gap-1.5">
      {attachments.map((attachment, index) => (
        <AttachmentPreview key={`${attachment.name || 'file'}-${index}`} attachment={attachment} dark={dark} onOpen={onOpen} />
      ))}
    </div>
  );
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

function EventMessage({ text, time, actor }) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="mb-5 shrink-0"><UserAvatar user={actor} size={28} /></div>
      <div className="flex max-w-[84%] min-w-0 flex-col items-start">
        <span className="mb-1 ml-1 text-[11px] font-bold text-ink">{actor?.name || 'Система'}</span>
        <div className="max-w-full rounded-[12px] bg-white/75 px-3 py-2.5 text-[12px] leading-5 text-[#555]">
          {text}
        </div>
        <span className="mt-1 text-[10px] font-medium text-[#a1a1a1]">{time}</span>
      </div>
    </div>
  );
}

function DaySeparator({ timestamp }) {
  const label = dayLabel(timestamp);
  if (!label) return null;
  return (
    <div className="flex items-center gap-3 py-1" aria-label={`Дата: ${label}`}>
      <span className="h-px flex-1 bg-black/[0.06]" />
      <span className="text-[10px] font-semibold text-[#999]">{label}</span>
      <span className="h-px flex-1 bg-black/[0.06]" />
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
      if (lastAtIndex === -1) return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      const textBetween = text.slice(lastAtIndex, cursorPosition);
      if (/\s/.test(textBetween)) return { active: false, query: '', startIndex: -1, cursorIndex: -1, selectedIndex: 0, ignoreIndex: -1 };
      if (previous.ignoreIndex === lastAtIndex) return previous;
      return {
        active: true,
        query: textBetween.slice(1),
        startIndex: lastAtIndex,
        cursorIndex: cursorPosition,
        selectedIndex: previous.active && previous.startIndex === lastAtIndex ? previous.selectedIndex : 0,
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
        await addComment(issueId, text, currentUser, attachments, replyTo);
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
          <div className="flex flex-1 items-center justify-center py-12 text-center">
            <p className="text-[12px] font-medium text-muted">Поки що немає повідомлень</p>
          </div>
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
            return (
              <Fragment key={`comment-${item.id}`}>
              {separator}
              <div className={`group flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  className="mb-6 mt-auto shrink-0 transition-opacity hover:opacity-80"
                  onClick={() => router.push(`?member=${item.authorId}`)}
                  aria-label={`Профіль: ${item.authorName || 'учасник'}`}
                >
                  <UserAvatar user={{ id: item.authorId, name: item.authorName, avatar: item.authorAvatar }} size={28} />
                </button>
                <div className={`flex max-w-[84%] min-w-0 flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="mb-1 ml-1 text-[11px] font-bold text-ink">{item.authorName}</span>}
                  {/* Асиметричний кут-«хвостик» до аватара — як у QuickTeam+ */}
                  <div className={`max-w-full break-words px-3 py-2.5 text-[13px] leading-5 ${isMe ? 'rounded-[14px] rounded-tr-[4px] bg-ink text-white' : 'rounded-[14px] rounded-tl-[4px] bg-white text-ink'}`}>
                    <ReplyQuote replyTo={item.replyTo} dark={isMe} />
                    {item.text && <div className="whitespace-pre-wrap">{item.text}</div>}
                    <CommentAttachments attachments={item.attachments} dark={isMe} onOpen={setViewerAttachment} />
                  </div>
                  <div className={`mt-1 flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="px-1 text-[10px] font-medium text-[#a1a1a1]">
                      {fmtClock(item.createdAt)}{item.editedAt ? ' · змінено' : ''}
                    </span>
                    {/* Read receipt на своїх повідомленнях: ✓ надіслано / ✓✓ прочитано іншими */}
                    {isMe && (
                      (item.readBy || []).some(readerId => readerId !== item.authorId)
                        ? <CheckCheck size={13} className="text-[#6366f1]" aria-label="Прочитано" />
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
            return <Fragment key={`time-${item.id}`}>{separator}<EventMessage text={text} time={fmtClock(item.loggedAt)} actor={actor} /></Fragment>;
          }

          if (item._type === 'audit') {
            const member = members.find(candidate => (candidate.id || candidate.uid) === item.userId);
            const actor = item.userId
              ? { ...member, id: item.userId, name: item.userName || member?.name || 'Учасник', avatar: member?.avatar || member?.photoURL }
              : { id: org?.id, name: org?.name || 'Організація', avatar: org?.logo || org?.logoUrl };
            return <Fragment key={`audit-${item.id}`}>{separator}<EventMessage text={formatAuditEvent(item, members)} time={fmtClock(item.createdAt)} actor={actor} /></Fragment>;
          }
          return null;
        })}
      </div>

      {!isArchived && (
        <div className="relative shrink-0 bg-canvas px-3 pb-3 pt-2" ref={wrapperRef}>
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

          {pendingFiles.length > 0 && (
            <div className="mb-2 flex max-w-[320px] flex-col gap-1.5">
              {pendingFiles.map((file, index) => (
                <PendingAttachmentPreview key={`${file.name}-${index}`} file={file} onRemove={() => setPendingFiles(files => files.filter((_, fileIndex) => fileIndex !== index))} />
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={event => { addPendingFiles(event.target.files); event.target.value = ''; }} />
          <div className="flex items-center gap-1 rounded-[16px] border-[4px] border-[#e3e3e3] bg-white p-1 transition-colors focus-within:border-[#d8d8d8]">
            {!editingComment && <Button style="ghost" size="icon" icon={Paperclip} type="button" onClick={() => fileInputRef.current?.click()} aria-label="Додати файл" title="Додати файл" />}
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
              className="custom-scrollbar min-h-[32px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-1 py-[6px] text-[13px] font-medium leading-5 text-ink outline-none placeholder:text-[#a1a1aa]"
              style={{ height: '32px' }}
            />
            <Button style="primary" size="icon" disabled={(!input.trim() && pendingFiles.length === 0) || sending} loading={sending} onClick={handleSend} icon={Send} aria-label={editingComment ? 'Зберегти зміни' : 'Надіслати'} />
          </div>
        </div>
      )}
    </div>
  );
}
