'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronDown, Paperclip, Pencil, Reply, Trash2, X } from 'lucide-react';
import { ChatIcon } from '@/lib/design/icons';
import { useRouter } from 'next/navigation';
import AvatarButton from '@/components/ui/DataDisplay/AvatarButton';
import MentionMenu from '@/components/ui/Chat/MentionMenu';
import FileInput from '@/components/ui/Forms/FileInput';
import AttachmentViewer from '@/components/ui/AttachmentViewer';
import { ChatAttachmentList, PendingChatAttachments } from '@/components/ui/Chat/ChatAttachmentList';
import Button from '@/components/ui/Button';
import ChatComposerDock from '@/components/ui/ChatComposerDock';
import ChatComposerCore from '@/components/ui/ChatComposerCore';
import UnreadDivider from '@/components/ui/Chat/UnreadDivider';
import { IconAction, Pill, Popover, useConfirm } from '@/components/ui';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import { useAppContext } from '@/lib/context/AppContext';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import { uploadFile } from '@/lib/utils/uploadFile';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import MentionText from '@/components/workspace/MentionText';
import { issueParticipants } from '@/lib/utils/issueParticipants.mjs';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { extractMentionedUserIds, filterMentionCandidates } from '@/lib/utils/mentions';
import { issuePath } from '@/lib/utils/issueKeys.mjs';
import {
  ATTACHMENT_UPLOAD_ACCEPT,
  uploadFilePolicy,
} from '@/lib/utils/uploadPolicy.mjs';

const FIELD_LABELS = {
  status: 'статус',
  columnId: 'статус',
  priority: 'пріоритет',
  title: 'назву',
  assigneeIds: 'виконавця',
};

const STATUS_LABELS = {
  backlog: 'Беклог',
  todo: 'До виконання',
  'in-progress': 'У роботі',
  'code-review': 'Код-ревʼю',
  qa: 'QA',
  'client-approval': 'Погодження клієнтом',
  done: 'Готово',
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

function SystemEventMessage({ text, time, actorName }) {
  return (
    <div className="flex justify-center px-3">
      <div data-ui-surface="system-message" className="ui-surface flex max-w-[92%] items-center gap-2 text-[11px] text-muted">
        <span className="min-w-0 text-center leading-4">
          {actorName && <strong className="font-bold text-ink">{actorName} · </strong>}
          {text}
        </span>
        <span className="shrink-0 text-[10px] font-medium text-[#a1a1a1]">{time}</span>
      </div>
    </div>
  );
}

function DaySeparator({ timestamp }) {
  const label = dayLabel(timestamp);
  if (!label) return null;
  return (
    <div className="flex justify-center py-2.5" aria-label={`Дата: ${label}`}>
      {/* A date marker is a landmark, not content: bold + widest tracking made
          it heavier than the messages it separates. */}
      <Pill tone="surface" size="chat-day" weight="medium" uppercase>
        {label}
      </Pill>
    </div>
  );
}

export default function UnifiedTimeline({
  issueId,
  projectId,
  issue,
  isArchived,
  org,
  members = [],
  isActive = true,
  onUnreadCountChange,
}) {
  const router = useRouter();
  const { currentUser, projects = [] } = useAppContext();
  const showToast = useWorkspaceStore(state => state.showToast);
  const confirmDialog = useConfirm();
  const project = projects.find(item => item.id === projectId);

  const { comments, addComment, updateComment, deleteComment, markCommentsRead } = useComments(issueId);
  const { entries: auditLogs } = useAuditLog(issueId);
  const { logs: timeLogs } = useTimeLogs(issueId, projectId);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const unreadMarkerRef = useRef(null);
  const wasNearBottomRef = useRef(true);
  const wasActiveRef = useRef(false);
  const previousTimelineLengthRef = useRef(0);
  const positionedIssueRef = useRef(null);
  const [isUnreadMarkerVisible, setIsUnreadMarkerVisible] = useState(false);

  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    startIndex: -1,
    cursorIndex: -1,
    selectedIndex: 0,
    ignoreIndex: -1,
  });
  const myId = currentUser?.uid || currentUser?.id;
  const unreadCommentIds = useMemo(() => {
    if (!myId) return [];
    return comments
      .filter(comment => comment.authorId !== myId && !(comment.readBy || []).includes(myId))
      .map(comment => comment.id);
  }, [comments, myId]);
  const firstUnreadCommentId = unreadCommentIds[0] || null;

  const filteredMembers = useMemo(() => {
    if (!mentionState.active) return [];
    return filterMentionCandidates(members, myId, mentionState.query);
  }, [mentionState.active, mentionState.query, members, myId]);

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
    if ((member?.id || member?.uid) === myId) return;
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

  const scrollToUnread = (behavior = 'smooth') => {
    unreadMarkerRef.current?.scrollIntoView({ behavior, block: 'center' });
  };

  useEffect(() => {
    const previousLength = previousTimelineLengthRef.current;
    previousTimelineLengthRef.current = timeline.length;
    const becameActive = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;
    if (!isActive || timeline.length === 0) return undefined;
    const isFirstPositionForIssue = positionedIssueRef.current !== issueId;
    if (isFirstPositionForIssue) positionedIssueRef.current = issueId;
    const shouldPositionConversation = isFirstPositionForIssue || becameActive;

    const frame = requestAnimationFrame(() => {
      if (shouldPositionConversation && firstUnreadCommentId) {
        scrollToUnread(previousLength === 0 ? 'auto' : 'smooth');
        return;
      }
      if (shouldPositionConversation || wasNearBottomRef.current) {
        const scroll = scrollRef.current;
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [firstUnreadCommentId, isActive, issueId, timeline.length]);

  // A compact task screen keeps the timeline mounted while its chat pane is
  // hidden. That preserves the live unread badge without falsely consuming the
  // messages before the reader actually opens the chat.
  useEffect(() => {
    onUnreadCountChange?.(unreadCommentIds.length);
  }, [onUnreadCountChange, unreadCommentIds.length]);

  // Read receipts: a visible pane alone is not enough. The unread boundary has
  // to enter the scroll viewport, so opening a long task chat cannot consume
  // messages that remained above or below the fold.
  useEffect(() => {
    const marker = unreadMarkerRef.current;
    const scroll = scrollRef.current;
    if (!isActive || !myId || unreadCommentIds.length === 0 || !marker || !scroll) {
      return undefined;
    }

    let readTimer = null;
    const observer = new IntersectionObserver(([entry]) => {
      setIsUnreadMarkerVisible(entry.isIntersecting);
      if (!entry.isIntersecting || readTimer) return;
      readTimer = window.setTimeout(() => {
        markCommentsRead(unreadCommentIds, myId);
      }, 500);
    }, { root: scroll, threshold: 0.8 });

    observer.observe(marker);
    return () => {
      observer.disconnect();
      if (readTimer) window.clearTimeout(readTimer);
    };
  }, [isActive, markCommentsRead, myId, unreadCommentIds]);

  const addPendingFiles = fileList => {
    const files = Array.from(fileList || []);
    const accepted = files
      .filter(file => !uploadFilePolicy(file, { maxBytes: 20 * 1024 * 1024 }).error)
      .slice(0, Math.max(0, 5 - pendingFiles.length));
    if (accepted.length !== files.length) showToast('До 5 файлів, максимум 20 МБ кожен', 'error');
    setPendingFiles(previous => [...previous, ...accepted]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || sendingRef.current) return;
    sendingRef.current = true;
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
        const taskChatLink = `${issuePath(issue, project || projectId)}?view=chat`;
        if (mentionedUserIds.length > 0) {
          try {
            await sendNotification({
              userIds: mentionedUserIds,
              type: 'mentioned',
              title: `${currentUser?.name || 'Колега'} згадав вас у завданні`,
              body: text.slice(0, 500),
              link: taskChatLink,
              issueId,
              projectId,
              organizationId: project?.organizationId || org?.id || '',
            });
          } catch (notificationError) {
            console.error('[task-chat] mention notification failed:', notificationError);
            showToast('Повідомлення надіслано, але сповіщення про згадку не доставлено', 'error');
          }
        }

        // Everyone with a stake in the task hears about a new comment. Nothing
        // sent this type before — «Новий коментар» sat in Settings as a switch
        // wired to no sender at all, so it silently did nothing. Mentioned
        // people are excluded: they already get the mention, which says the
        // same thing more precisely.
        const commentRecipients = issueParticipants(issue, {
          actorId: myId,
          commentAuthorIds: comments.map(item => item.authorId),
          exclude: mentionedUserIds,
        });
        if (commentRecipients.length > 0) {
          sendNotification({
            userIds: commentRecipients,
            type: 'commented',
            title: `${currentUser?.name || 'Колега'} прокоментував завдання`,
            body: text.slice(0, 500) || 'Вкладення',
            link: taskChatLink,
            issueId,
            projectId,
            organizationId: project?.organizationId || org?.id || '',
          }).catch(error => console.error('[task-chat] comment notification failed:', error));
        }
      }
      resetComposer();
    } catch (error) {
      showToast(`Помилка надсилання: ${error.message}`, 'error');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-canvas">
      {viewerAttachment && <AttachmentViewer attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} />}
      <div
        ref={scrollRef}
        onScroll={event => {
          const scroll = event.currentTarget;
          wasNearBottomRef.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 72;
        }}
        className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-5"
      >
        {timeline.length === 0 && (
          <EmptyState
            icon={ChatIcon}
            title="Ще немає повідомлень"
            description="Почніть обговорення завдання з командою."
            context="flexible"
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
            const isExternalAuthor = !isMe && !authorMember;
            // Prefer the live profile over `item.authorAvatar`. That field is a
            // snapshot taken when the comment was written: imports (YouTrack)
            // never set it, and for everyone else it goes stale as soon as they
            // change their photo. Only genuinely external authors — who have no
            // profile to read — fall back to what the document carries.
            const authorProfile = (isMe ? currentUser : authorMember) || null;
            const authorUser = authorProfile
              ? { ...authorProfile, name: authorProfile.name || item.authorName }
              : { id: item.authorId, name: item.authorName, avatar: item.authorAvatar };
            return (
              <Fragment key={`comment-${item.id}`}>
              {separator}
              {item.id === firstUnreadCommentId && (
                <div ref={unreadMarkerRef}>
                  <UnreadDivider count={unreadCommentIds.length} />
                </div>
              )}
              <div className={`group grid items-end gap-x-2.5 ${isMe ? 'grid-cols-[minmax(0,1fr)_28px]' : 'grid-cols-[28px_minmax(0,1fr)]'}`}>
                {isExternalAuthor ? (
                  <Popover
                    position="top"
                    hideCloseIcon
                    className="col-start-1 row-start-1 self-end"
                    trigger={(
                      <AvatarButton
                        user={authorUser}
                        size="chat-member"
                        label={`Інформація про зовнішнього автора: ${item.authorName || 'користувач'}`}
                      />
                    )}
                  >
                    <div className="w-[240px]">
                      <p className="text-[13px] font-bold text-ink">Зовнішній автор</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted">
                        {item.source === 'youtrack'
                          ? 'Коментар перенесено з YouTrack.'
                          : 'Коментар додано через зовнішню інтеграцію.'}
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-faint">
                        Це не учасник організації, тому профіль та особистий чат недоступні.
                      </p>
                    </div>
                  </Popover>
                ) : (
                  <AvatarButton
                    user={authorUser}
                    size="chat-member"
                    className={`${isMe ? 'col-start-2' : 'col-start-1'} row-start-1 self-end`}
                    onClick={() => router.push(`?member=${item.authorId}`)}
                    label={`Профіль: ${item.authorName || 'учасник'}`}
                  />
                )}
                <div className={`row-start-1 flex max-w-[84%] min-w-0 flex-col ${isMe ? 'col-start-1 items-end justify-self-end' : 'col-start-2 items-start'}`}>
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
                        <MentionText text={item.text} members={members} dark={isMe} excludeMemberId={item.authorId} />
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
                </div>
                <div className={`row-start-2 mt-1 flex items-center gap-1 ${isMe ? 'col-start-1 justify-self-end flex-row-reverse' : 'col-start-2 justify-self-start'}`}>
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
                        <IconAction label="Відповісти" icon={Reply} size="micro" composition="chat-micro-action" appearance="quiet" shape="micro" onClick={() => beginReply(item)} title="Відповісти" />
                        {isMe && <IconAction label="Редагувати повідомлення" icon={Pencil} size="micro" composition="chat-micro-action" appearance="quiet" shape="micro" onClick={() => beginEdit(item)} title="Редагувати" />}
                        {isMe && <IconAction label="Видалити повідомлення" icon={Trash2} size="micro" composition="chat-micro-action" appearance="quiet-danger" shape="micro" onClick={() => handleDelete(item)} title="Видалити" />}
                      </div>
                    )}
                </div>
              </div>
              </Fragment>
            );
          }

          if (item._type === 'time') {
            const member = members.find(candidate => (candidate.id || candidate.uid) === item.userId);
            const text = `Списано ${fmtTime(item.spentMinutes)}${item.description ? ` · ${item.description}` : ''}`;
            const actorName = member?.name || item.userName || item.externalActor?.name || org?.name || 'Система';
            return (
              <Fragment key={`time-${item.id}`}>
                {separator}
                <SystemEventMessage text={text} time={fmtClock(item.loggedAt)} actorName={actorName} />
              </Fragment>
            );
          }

          if (item._type === 'audit') {
            const member = members.find(candidate => (candidate.id || candidate.uid) === item.userId);
            const actorName = item.userName || member?.name || org?.name || 'Система';
            return (
              <Fragment key={`audit-${item.id}`}>
                {separator}
                <SystemEventMessage
                  text={formatAuditEvent(item, members)}
                  time={fmtClock(item.createdAt)}
                  actorName={actorName}
                />
              </Fragment>
            );
          }
          return null;
        })}
      </div>

      {!isArchived && (
        <ChatComposerDock ref={wrapperRef} scrollRef={scrollRef} composition="timeline-composer">
          {unreadCommentIds.length > 0 && !isUnreadMarkerVisible && (
            <div className="absolute inset-x-0 -top-10 z-20 flex justify-center">
              <Button
                style="primary"
                size="sm"
                icon={ChevronDown}
                onClick={() => scrollToUnread()}
              >
                {unreadCommentIds.length} нових
              </Button>
            </div>
          )}
          {mentionState.active && filteredMembers.length > 0 && (
            <MentionMenu
              density="timeline"
              members={filteredMembers}
              selectedIndex={mentionState.selectedIndex}
              onSelect={selectMention}
              className="absolute bottom-full left-3 right-3 z-[60] mb-2"
            />
          )}

          {/* The dock's top half is a transparent gradient, so a 5% black tint
              here was not a panel — it was the last message showing through its
              own reply preview, at almost full contrast. Same treatment the chat
              header uses for exactly this problem: a near-opaque canvas over a
              real blur, with a hairline to end it. */}
          {(replyTo || editingComment) && (
            <div data-ui-surface="local" className="mb-2 flex items-start gap-2 rounded-[10px] border border-line/70 bg-canvas/90 px-3 py-2 backdrop-blur-xl">
              <div className="min-w-0 flex-1 border-l-2 border-[#8d8d8d] pl-2">
                <div className="text-[11px] font-bold text-ink">{editingComment ? 'Редагування повідомлення' : `Відповідь для ${replyTo.authorName || 'учасника'}`}</div>
                <div className="truncate text-[11px] text-muted">{editingComment?.text || replyTo?.text || 'Вкладення'}</div>
              </div>
              <IconAction label="Скасувати" icon={X} size="micro" composition="chat-composer-cancel" appearance="quiet" shape="micro" onClick={resetComposer} />
            </div>
          )}

          <FileInput accept={ATTACHMENT_UPLOAD_ACCEPT} ref={fileInputRef} multiple onChange={event => { addPendingFiles(event.target.files); event.target.value = ''; }} />
          <ChatComposerCore
            variant="timeline"
            textareaRef={inputRef}
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
            textareaStyle={{ height: '32px' }}
            attachments={pendingFiles.length > 0 ? (
              <div className="border-b border-black/[0.05] p-2">
                <PendingChatAttachments
                  files={pendingFiles}
                  onRemove={index => setPendingFiles(files => files.filter((_, fileIndex) => fileIndex !== index))}
                />
              </div>
            ) : null}
            leading={!editingComment ? <Button className="self-center" shape="circle" style="ghost" size="icon" composition="chat-composer-action" icon={Paperclip} type="button" onClick={() => fileInputRef.current?.click()} aria-label="Додати файл" title="Додати файл" /> : null}
            onSubmit={handleSend}
            canSubmit={Boolean(input.trim() || pendingFiles.length > 0)}
            sending={sending}
            sendAriaLabel={editingComment ? 'Зберегти зміни' : 'Надіслати'}
          />
        </ChatComposerDock>
      )}
    </div>
  );
}
