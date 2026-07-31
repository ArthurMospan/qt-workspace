'use client';
// src/app/workspace/[projectId]/issue/[issueId]/page.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppContext }        from '@/lib/context/AppContext';
import { useIssues }           from '@/lib/hooks/useIssues';
import { useTimeLogs }         from '@/lib/hooks/useTimeLogs';
import { useOrganization }     from '@/lib/hooks/useOrganization';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { useSprints } from '@/lib/hooks/useSprints';
import { usePortalSession }    from '@/lib/portal/usePortalSession';
import QtPlusChatPanel from '@/components/workspace/qtplus/chat/QtPlusChatPanel';
import { useWorkflowConfig }   from '@/lib/hooks/useWorkflowConfig';
import { ISSUE_LINK_OPTIONS, issueLinkPerspective, useIssueLinks } from '@/lib/hooks/useIssueLinks';
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownViewer, { setTaskChecked } from '@/components/MarkdownViewer';
import AttachmentViewer from '@/components/workspace/AttachmentViewer';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import Tag from '@/components/ui/DataDisplay/Tag';
import UnifiedTimeline from '@/components/workspace/UnifiedTimeline';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import { useLocalization } from '@/lib/hooks/useLocalization';
import { fromDateInput, parseDueDate, toLocalDateInput } from '@/lib/utils/date';
import DatePicker from '@/components/ui/Forms/DatePicker';

import { can } from '@/lib/utils/can';
import { MultiSelect, Select } from '@/components/ui/Select';
import { ContextMenu, Dialog, getTaskAttributeChrome, IconAction, Pill, Popover, Segmented, Surface, TaskAttributesPanel, Tabs, Tooltip, useConfirm } from '@/components/ui';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DEFAULT_PRIORITIES, DEFAULT_TYPES, PRIORITY_ICONS, TYPE_ICONS } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore       from '@/store/useWorkspaceStore';
import { sendNotification }    from '@/lib/hooks/useNotifications';
import {
  Heart, MessageSquare, Clock, History, PanelRightClose, PanelRightOpen, ExternalLink, Download, X, Plus, Layers, Search, Settings2, Share2, Send, CheckSquare, Square, MoreHorizontal, Pencil, Check, Trash2, Paperclip, ChevronRight, Minus, Eye, EyeOff,
  CheckCircle, XCircle, Play, Square as StopIcon,
  FileText, Film, Music, Link2, Copy, Sparkles, Tag as TagIcon,
  ZoomIn, Maximize2, ListTree,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';
import { deleteFileFromCloudinary } from '@/lib/services/fileUpload';
import { downloadMaterial } from '@/lib/portal/downloadMaterial';
import { buildTaskAiPrompt } from '@/lib/utils/taskPrompt.mjs';
import { existingParentIssueId } from '@/lib/utils/issueHierarchyModel.mjs';
import { issueCompletionBlockers } from '@/lib/utils/issueExecution.mjs';

// ── Constants ──────────────────────────────────────────────────────

// Statuses are now loaded dynamically via useWorkflowConfig.

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || '';

// Таб «QuickTeam+» у чаті завдання. Окремий компонент, щоб usePortalSession
// (обмін токена з порталом) запускався лише коли таб реально відкрито.
function IssueQtPlusChat({ qtProjectId, currentUser }) {
  const { portalUser, loading } = usePortalSession();
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[12px] text-muted">Підключаємо QuickTeam+…</p>
      </div>
    );
  }
  if (!portalUser) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-[12px] text-muted">
          Підключіть свій акаунт QuickTeam+ у <Link href="/settings" className="font-semibold text-ink underline">Налаштуваннях</Link>, щоб бачити цей чат.
        </p>
      </div>
    );
  }
  return <QtPlusChatPanel qtProjectId={qtProjectId} portalUser={portalUser} currentUser={currentUser} embedded />;
}

// ── Helpers ────────────────────────────────────────────────────────

function fmtMin(min) {
  if (!min && min !== 0) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}хв`;
  if (m === 0) return `${h}г`;
  return `${h}г ${m}хв`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const d    = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'щойно';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'вчора';
  if (days < 5) return `${days} дні тому`;
  return `${days} днів тому`;
}

// Detect file type from name or URL
function detectFileType(mat) {
  const name = (mat.title || mat.name || '').toLowerCase();
  const url  = getMatFileUrl(mat).toLowerCase();
  const declaredType = (mat.resourceType || mat.mimeType || mat.type || '').toLowerCase();
  const src  = `${name} ${url}`;
  if (declaredType === 'image' || declaredType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|avif|svg|heic|heif|bmp|tiff?)(?:[?#]|$)/.test(src)) return 'image';
  if (declaredType === 'video' || declaredType.startsWith('video/')) return 'video';
  if (declaredType === 'audio' || declaredType.startsWith('audio/')) return 'audio';
  if (declaredType === 'application/pdf') return 'pdf';
  if (/\.pdf/.test(src))                                    return 'pdf';
  if (/\.(mp4|mov|avi|webm|mkv)/.test(src))                return 'video';
  if (/\.(mp3|wav|m4a|ogg|aac)/.test(src))                 return 'audio';
  if (/^https?:\/\//.test(mat.url || '') && mat.type === 'link') return 'link';
  if (mat.type) return mat.type; // note, checklist, poll
  return 'file';
}

function getMatFileUrl(mat) {
  return mat.previewUrl || mat.url || mat.downloadUrl || mat.downloadURL || mat.audioUrl || '';
}

function fmtBytes(bytes) {
  if (!bytes || bytes < 0) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i > 0 && n < 10 ? 1 : 0)} ${units[i]}`;
}

// Module-level id factory — keeps the impure Date.now()/Math.random() calls out
// of component render scope (react-compiler lint), while staying unique enough
// for an array element key on the issue document.
let _attSeq = 0;
function makeAttachmentId() {
  _attSeq += 1;
  return `att_${Date.now().toString(36)}_${_attSeq}`;
}
function nowMs() { return Date.now(); }

// ── Circular ring progress ─────────────────────────────────────────
function Ring({ pct, color, size = 36, stroke = 3.5 }) {
  const r    = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Material card (matches portal style) ──────────────────────────
function MaterialCard({ mat, onClick }) {
  const fileType = detectFileType(mat);
  const fileUrl  = getMatFileUrl(mat);
  const name     = mat.title || mat.name || 'Матеріал';
  const desc     = mat.desc || mat.description || mat.stageName || '';

  const statusIcon = mat.status === 'approved' ? { Icon: CheckCircle, color: '#10b981' }
    : mat.status === 'rejected'               ? { Icon: XCircle,     color: '#ef4444' }
    : mat.clientApprovalPending               ? { Icon: Clock,       color: '#f97316' }
    : null;

  const renderPreview = () => {
    if (fileType === 'image' && fileUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-faint text-[10px]">Немає превʼю</div>'; }}
        />
      );
    }
    if (fileType === 'pdf') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-red-50">
        <FileText size={28} className="text-red-400" />
        <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">PDF</span>
      </div>
    );
    if (fileType === 'video') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-orange-50">
        <Film size={28} className="text-orange-400" />
        <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">VIDEO</span>
      </div>
    );
    if (fileType === 'audio') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#f5f5f5]">
        <Music size={24} className="text-muted" />
        <span className="text-[9px] font-bold text-muted uppercase">AUDIO</span>
      </div>
    );
    if (fileType === 'link') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-blue-50">
        <Link2 size={24} className="text-blue-400" />
        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">LINK</span>
      </div>
    );
    if (fileType === 'note') return (
      <div className="w-full h-full bg-amber-50 p-2 overflow-hidden">
        <p className="text-[9px] text-amber-800 leading-tight line-clamp-5">{mat.content || '📝 Нотатка'}</p>
      </div>
    );
    if (fileType === 'checklist') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-green-50">
        <CheckSquare size={24} className="text-green-500" />
        <span className="text-[9px] font-bold text-green-500 uppercase">CHECKLIST</span>
      </div>
    );
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#f5f5f5]">
        <FileText size={24} className="text-faint" />
        <span className="text-[9px] text-faint uppercase">{name.split('.').pop()?.toUpperCase() || 'FILE'}</span>
      </div>
    );
  };

  return (
    <button onClick={onClick}
      className="group w-full bg-white border border-[#f0f0f0] rounded-[12px] overflow-hidden text-left hover:border-[#d0d0d0] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] transition-all duration-200">
      {/* Preview area — 140px tall, like portal */}
      <div className="h-[140px] relative overflow-hidden bg-[#f5f5f5]">
        {renderPreview()}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/12 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div data-ui-surface="local" className="w-9 h-9 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center border border-white/30 scale-90 group-hover:scale-100 transition-transform">
            {fileType === 'image' ? <ZoomIn size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
          </div>
        </div>
        {/* Status badge */}
        {statusIcon && (
          <div className="absolute top-2 right-2 z-10">
            <div data-ui-surface="local" className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
              <statusIcon.Icon size={12} style={{ color: statusIcon.color }} />
            </div>
          </div>
        )}
        {/* File type badge */}
        {fileType !== 'image' && fileType !== 'note' && fileUrl && (
          <div className="absolute bottom-2 left-2">
            <Pill tone="overlay" size="sm" uppercase>
              {fileType}
            </Pill>
          </div>
        )}
      </div>
      {/* Info row */}
      <div className="px-3 py-[9px] flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-ink truncate leading-tight">{name}</p>
          {desc && <p className="text-[10px] text-faint truncate mt-[1px]">{desc}</p>}
        </div>
        <ExternalLink size={11} className="text-faint shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// ── Section heading ────────────────────────────────────────────────
// Мітки, Вкладення, Підзадачі and Зв’язки all label a list on the same panel,
// so they get one heading instead of four near-identical ones. Local on
// purpose: it is a composition of kit primitives (icon + ui-type-item-title +
// Pill) bound to this detail view, not a new reusable visual component.
function SectionHeading({ icon: Icon, title, count, meta, action }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={13} className="shrink-0 text-muted" />
      <h3 className="ui-type-item-title text-ink">{title}</h3>
      {count > 0 && <Pill tone="ink-subtle" size="sm">{count}</Pill>}
      {meta && <span className="text-[10px] font-medium text-muted">{meta}</span>}
      {action}
    </div>
  );
}

// ── Attachment rows ────────────────────────────────────────────────
// Lives on the description's canvas panel, so each row is a white surface —
// the same card-on-canvas relationship the rest of the workspace uses. There
// is deliberately no rule above the list: the panel edge already separates
// attachments from the description text.
function AttachmentRows({ attachments, isEditing, isArchived, onOpen, onInsert, onDelete }) {
  if (attachments.length === 0) return null;
  return (
    <div>
      <SectionHeading icon={Paperclip} title="Вкладення" count={attachments.length} />
      <div className="flex flex-col gap-1.5">
        {attachments.map(attachment => {
          const url = getMatFileUrl(attachment);
          const fileType = detectFileType(attachment);
          return (
            <div key={attachment.id || url} data-ui-surface="nested-card" data-ui-padding="compact-row" className="ui-surface group flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => onOpen(attachment)}
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-canvas"
                aria-label={`Переглянути ${attachment.name}`}
              >
                {fileType === 'image' && url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : <FileText size={16} className="text-muted" />}
              </button>
              {/* The name opens the preview — the obvious target, and what the
                  thumbnail beside it already did. The row used to spend a slot
                  on an "open in a new tab" link instead, which is the one thing
                  the preview makes unnecessary; downloading is what was missing. */}
              <button
                type="button"
                onClick={() => onOpen(attachment)}
                className="min-w-0 flex-1 text-left"
                aria-label={`Переглянути ${attachment.name}`}
              >
                <p className="truncate text-[12px] font-semibold text-ink group-hover:underline">{attachment.name}</p>
                <p className="text-[10px] text-faint">{fmtBytes(attachment.size)}</p>
              </button>
              {isEditing && url && (
                <Button style="ghost" size="sm" onClick={() => onInsert(attachment, fileType, url)}>
                  Вставити в опис
                </Button>
              )}
              {url && (
                <button
                  type="button"
                  onClick={() => downloadMaterial(url, attachment.name)}
                  className="p-2 text-faint hover:text-ink"
                  aria-label={`Завантажити ${attachment.name}`}
                  title="Завантажити"
                >
                  <Download size={14} />
                </button>
              )}
              {!isArchived && (
                <button
                  type="button"
                  onClick={() => onDelete(attachment.id)}
                  className="p-2 text-faint hover:text-red-500"
                  aria-label={`Видалити ${attachment.name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Media viewer (lightbox) ────────────────────────────────────────
function MediaViewer({ mat, onClose }) {
  return (
    <AttachmentViewer
      attachment={{
        ...mat,
        name: mat.name || mat.title,
        previewUrl: getMatFileUrl(mat),
      }}
      onClose={onClose}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════

export default function IssueDetail({ issueId, projectId, isModal, onClose }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { formatDate } = useLocalization();
  const { projects, currentUser, activeOrg, orgRole } = useAppContext();
  const {
    issues,
    loading: issuesLoading,
    error: issuesError,
    createIssue,
    updateIssue,
    setIssueParent,
    deleteIssue,
    moveIssue,
  } = useIssues(projectId, { includeLinks: false });

  const showToast      = useWorkspaceStore(s => s.showToast);
  const confirmDialog  = useConfirm();
  const setBreadcrumbs = useWorkspaceStore(s => s.setBreadcrumbs);
  const startTimer     = useWorkspaceStore(s => s.startTimer);
  const stopTimer      = useWorkspaceStore(s => s.stopTimer);
  const activeTimer    = useWorkspaceStore(s => s.activeTimer);
  const timerElapsed   = useWorkspaceStore(s => s.timerElapsed);
  const formatElapsed  = useWorkspaceStore(s => s.formatElapsed);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  // Resolve author/assignee names from ALL organization members, not just the
  // project team. Scoping this to `project.team` was the "Автор: Невідомо" /
  // blank-assignee bug: anyone off the team (e.g. the creator of a task in a
  // project they aren't a team member of) was unresolvable and rendered empty.
  const { members } = useOrganization();
  const isArchived = project?.status === 'archived';

  const { stages }   = useStagesForProject(projectId);
  const { sprints = [] } = useSprints();

  // Чат завдання отримує другий таб «QuickTeam+», коли проєкт звʼязано з
  // проєктом порталу — портальний чат просто як додатковий (IssueQtPlusChat
  // монтується лише при відкритті таба, щоб не смикати сесію QT+ даремно).
  const qtplusLink = project?.qtplusLink || null;
  const [chatView, setChatView] = useState('chat');

  const { logs: timeLogs, totalMinutes: loggedMinutes, addTimeLog, updateTimeLog, deleteTimeLog } = useTimeLogs(issueId, projectId);
  const {
    links = [],
    refresh: refreshLinks,
    addLink,
    removeLink,
  } = useIssueLinks(issueId);

  const {
    types: rawTypes, priorities: rawPriorities, statuses: STATUSES, labels: availableLabels = [], doneStatusIds
  } = useWorkflowConfig();

  const activeHiddenCols = project?.hiddenColumns || [];
  const visibleStatuses = STATUSES.filter(s => !activeHiddenCols.includes(s.id));

  // Build TYPES and PRIORITIES with icon mapping preserved
  const TYPES = rawTypes.map(t => ({
    ...t,
    icon: TYPE_ICONS[t.id] || CheckSquare,
    color: t.color || DEFAULT_TYPES.find(d => d.id === t.id)?.color || '#9a9a9a',
  }));
  const PRIORITIES = rawPriorities.map(p => ({
    ...p,
    icon: PRIORITY_ICONS[p.id] || Minus,
    color: p.color || DEFAULT_PRIORITIES.find(d => d.id === p.id)?.color || '#9a9a9a',
  }));

  // ── UI state ──────────────────────────────────────────────────────
  const [showSubInput, setShowSubInput] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkRelation, setLinkRelation] = useState('relates-to');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [migratingChecklist, setMigratingChecklist] = useState(false);
  const [parentSaving, setParentSaving] = useState(false);
  const [timeLogsPage, setTimeLogsPage] = useState(1);
  const [logForm,      setLogForm]      = useState(null);
  const [logTab, setLogTab] = useState('spend');
  const [viewerMat,    setViewerMat]    = useState(null); // lightbox
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const leftScrollRef = useRef(null);
  const TIME_LOGS_PER_PAGE = 5;

  // ── Edit mode state ───────────────────────────────────────────────
  const [isEditing,    setIsEditing]   = useState(false);
  // Local editable fields (draft while in edit mode)
  const [draft, setDraft] = useState({});

  const issue = issues.find(i => i.id === issueId);

  useEffect(() => {
    const logTimeParam = searchParams.get('logTime');
    if (logTimeParam) {
      queueMicrotask(() => setLogForm({ minutes: parseInt(logTimeParam), desc: '' }));
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  const copyIssueLink = useCallback(async () => {
    const issueUrl = `${window.location.origin}/${projectId}/issue/${issueId}`;
    try {
      await navigator.clipboard.writeText(issueUrl);
      showToast('Посилання на завдання скопійовано');
    } catch {
      showToast('Не вдалося скопіювати посилання', 'error');
    }
  }, [issueId, projectId, showToast]);

  const copyAiPrompt = async () => {
    if (!issue) return;
    const taskUrl = `${window.location.origin}/${projectId}/issue/${issueId}`;
    const prompt = buildTaskAiPrompt({
      issue,
      projectName: project?.name || '',
      statusName: (() => {
        const item = STATUSES.find(
          option => option.id === (issue.status || issue.columnId),
        );
        return item?.label || item?.name || '';
      })(),
      priorityName: (() => {
        const item = PRIORITIES.find(option => option.id === issue.priority);
        return item?.label || item?.name || '';
      })(),
      typeName: (() => {
        const item = TYPES.find(option => option.id === issue.type);
        return item?.label || item?.name || '';
      })(),
      assigneeNames: (issue.assigneeIds || [])
        .map(uid => members.find(member => (member.id || member.uid) === uid))
        .filter(Boolean)
        .map(member => member.name || member.displayName || member.email || ''),
      taskUrl,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('AI-промпт скопійовано');
    } catch {
      showToast('Не вдалося скопіювати AI-промпт', 'error');
    }
  };

  // ── Breadcrumbs ───────────────────────────────────────────────────
  useEffect(() => {
    if (isModal) return;
    useWorkspaceStore.setState({
      breadcrumbs: [
        { label: 'Проєкти', href: '/' },
        { label: project?.name || '...', href: `/${projectId}` },
        { label: issue?.issueKey || '...', href: null, onClick: copyIssueLink, title: 'Копіювати посилання на завдання' },
      ]
    });
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, [project?.name, issue?.issueKey, projectId, isModal, copyIssueLink]);

  useEffect(() => {
    const fn = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (isEditing) { setIsEditing(false); return; }
        router.push(`/${projectId}`);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [router, projectId, isEditing]);

  if (!issue) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        {issuesLoading ? (
          <div className="w-7 h-7 border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
        ) : issuesError ? (
          <div className="max-w-[360px] px-6 text-center">
            <p className="text-[16px] font-bold text-ink mb-2">Не вдалося завантажити задачу</p>
            <p className="text-[13px] text-muted mb-4">Дані не видалені. Сервіс бази тимчасово недоступний.</p>
            <button onClick={() => window.location.reload()} className="text-[13px] font-semibold text-ink hover:underline">Спробувати ще раз</button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[16px] font-bold text-ink mb-2">Задачу не знайдено</p>
            <Link href={`/${projectId}`} className="text-[13px] text-ink hover:underline">← Повернутись</Link>
          </div>
        )}
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────
  const sorted = [...issues].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx    = sorted.findIndex(i => i.id === issueId);
  const prev   = idx > 0 ? sorted[idx - 1] : null;
  const next   = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  const selectedTypeId = isEditing ? draft.type : issue.type;
  const legacyEpicType = {
    id: 'epic',
    label: 'Епік (legacy)',
    color: '#8b5cf6',
    icon: TYPE_ICONS.epic || CheckSquare,
  };
  const creatableTypes = TYPES.filter(type => type.id !== 'epic');
  const EDITABLE_TYPES = issue.type === 'epic'
    ? [
        ...creatableTypes,
        TYPES.find(type => type.id === 'epic') || legacyEpicType,
      ]
    : creatableTypes;
  const typeCfg = EDITABLE_TYPES.find(t => t.id === selectedTypeId)
    || EDITABLE_TYPES.find(t => t.id === 'task')
    || EDITABLE_TYPES[0]
    || legacyEpicType;
  const priorityCfg = PRIORITIES.find(p => p.id === (isEditing ? draft.priority : issue.priority))
    || PRIORITIES.find(p => p.id === 'medium')
    || PRIORITIES[0];
  const statusCfg   = STATUSES.find(s => s.id === issue.columnId)                             || STATUSES[0];
  const TypeIcon    = typeCfg.icon;
  const PrioIcon    = priorityCfg.icon;

  const due       = parseDueDate(issue.dueDate);
  const isOverdue = due && due < new Date() && !doneStatusIds.includes(issue.columnId || issue.status);
  const dueStr    = due ? formatDate(due) : null;
  const {
    attributeItemClass,
    attributeLabelClass,
    compactInputClass,
    compactSelectClass,
    detailsButtonClass,
  } = getTaskAttributeChrome({ condensed: isHeaderScrolled });

  const assignees     = (issue.assigneeIds || []).map(uid => members.find(m => (m.id || m.uid) === uid)).filter(Boolean);
  const reporterMatchByEmail = issue.reporterName ? members.find(m => m.email && m.email.toLowerCase() === issue.reporterName.toLowerCase()) : null;
  const reporterMember = members.find(m => (m.id || m.uid) === issue.reporterId) || reporterMatchByEmail || null;
  const telegramUsername = String(issue.sourceMeta?.telegramUsername || '').replace(/^@/, '').trim();
  const externalReporterName = issue.source === 'telegram'
    ? telegramUsername
      ? `QuickTeam (@${telegramUsername})`
      : `QuickTeam (${issue.reporterName || 'користувач Telegram'})`
    : issue.source === 'buggybag'
      ? 'BuggyBag'
      : issue.reporterName || 'Зовнішній автор';
  const reporter = reporterMember || { name: externalReporterName };
  const isExternalReporter = !reporterMember;
  const externalReporterSource = issue.source === 'telegram'
    ? 'Цю задачу створено через Telegram-бота QuickTeam.'
    : issue.source === 'youtrack'
      ? 'Автора перенесено разом із задачею з YouTrack.'
      : issue.source === 'buggybag'
        ? 'Цю задачу створено через інтеграцію BuggyBag.'
        : 'Цю задачу створено зовнішньою інтеграцією.';
  const checklistDone = (issue.subtasks || []).filter(s => s.done).length;
  const checklistAll = (issue.subtasks || []).length;
  const parentIssueId = existingParentIssueId(issue);
  const parentIssue = issues.find(candidate => candidate.id === parentIssueId) || null;
  const childIssues = issues
    .filter(candidate => existingParentIssueId(candidate) === issueId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const childIssuesDone = childIssues.filter(child => doneStatusIds.includes(child.columnId || child.status)).length;
  const openChildCount = childIssues.length - childIssuesDone;
  const parentCandidates = issues.filter(candidate => (
    candidate.id !== issueId
    && !existingParentIssueId(candidate)
  ));
  const visibleAttachments = issue.attachments || [];
  const currentIssueLinks = links
    .map(link => ({ link, perspective: issueLinkPerspective(link, issueId) }))
    .filter(item => item.perspective);
  const linkedIssueIds = new Set(currentIssueLinks.map(item => item.perspective.otherIssueId));
  const availableLinkIssues = issues.filter(item => (
    item.id !== issueId
    && !linkedIssueIds.has(item.id)
  ));

  const spentMin  = loggedMinutes;
  const estimMin  = isEditing ? (draft.estimateMinutes ?? issue.estimateMinutes ?? 0) : (issue.estimateMinutes || 0);
  const timePct   = estimMin > 0 ? Math.round((spentMin / estimMin) * 100) : 0;
  const timeColor = timePct >= 100 ? '#dc2626' : timePct >= 75 ? '#f97316' : '#1f1f1f';

  const isTimerMine    = activeTimer?.issueId === issueId;
  const allMaterials   = stages.flatMap(s => (s.materials || []).map(m => ({ ...m, stageName: s.title || s.name })));
  const actor          = { userId: currentUser?.id || currentUser?.uid, userName: currentUser?.name };

  // ── Edit mode helpers ─────────────────────────────────────────────
  const enterEdit = () => {
    setDraft({
      title:           issue.title,
      type:            issue.type     || 'task',
      priority:        issue.priority || 'medium',
      estimateMinutes: issue.estimateMinutes || 0,
      dueDate:         toLocalDateInput(due),
      description:     issue.description || '',
    });
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = async () => {
    const patch = {};
    if (draft.title           !== issue.title)           patch.title = draft.title.trim();
    if (draft.type            !== issue.type)             patch.type = draft.type;
    if (draft.priority        !== issue.priority)         patch.priority = draft.priority;
    if (draft.estimateMinutes !== issue.estimateMinutes)  patch.estimateMinutes = draft.estimateMinutes;
    if (draft.description     !== (issue.description||''))patch.description = draft.description;
    // dueDate
    const originalDueInput = toLocalDateInput(due);
    if ((draft.dueDate || '') !== originalDueInput) {
      patch.dueDate = draft.dueDate
        ? fromDateInput(draft.dueDate, { endOfDay: true })
        : null;
    }
    if (Object.keys(patch).length > 0) {
      try { await updateIssue(issueId, patch, actor); showToast('Збережено ✓'); }
      catch (err) { showToast(err.message, 'error'); }
    }
    setIsEditing(false);
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const update = async (patch) => {
    try { await updateIssue(issueId, patch, actor); }
    catch (err) { showToast(err.message || 'Помилка', 'error'); }
  };

  const handleStatusChange = async (s) => {
    if (doneStatusIds.includes(s)) {
      const freshLinks = await refreshLinks();
      if (!freshLinks) {
        showToast('Не вдалося перевірити залежності. Оновіть сторінку й повторіть.', 'error');
        return;
      }
      const blockers = issueCompletionBlockers({
        issueId,
        issues,
        issueLinks: freshLinks,
        doneStatusIds,
      });
      if (blockers.dependencies.length > 0) {
        showToast(`Задачу ще блокують: ${blockers.dependencies.length}`, 'error');
        return;
      }
    }
    try { await moveIssue(issueId, s, issue.order ?? 0, actor); }
    catch (err) { showToast(err.message, 'error'); }
  };

  // Writes the whole assignee list in one go, then replays the per-person side
  // effects for everyone newly added. Doing it list-first (instead of once per
  // toggle) is what lets the multi-select hand over several changes at a time
  // without each write clobbering the previous one.
  const setAssignees = async (next) => {
    const cur = issue.assigneeIds || [];
    const added = next.filter(uid => !cur.includes(uid));
    if (added.length === 0 && next.length === cur.length) return;
    await update({ assigneeIds: next });

    // Under team-gated project visibility, an assignee who isn't on the
    // project team could not open the task they were just given. Add them to
    // the team so the assignment is actually usable. Best-effort: only
    // owners/admins may write `team` (Firestore rules), so a member assigner's
    // write is denied and swallowed — the assignment itself still stands.
    const missingFromTeam = added.filter(uid => !teamUids.includes(uid));
    if (missingFromTeam.length > 0) {
      try {
        await updateDoc(doc(db, 'projects', projectId), { team: arrayUnion(...missingFromTeam) });
      } catch { /* member assigner lacks team-write permission — non-fatal */ }
    }

    const myId = currentUser?.id || currentUser?.uid;
    const notifyIds = added.filter(uid => uid !== myId);
    if (notifyIds.length > 0) {
      await sendNotification({ userIds: notifyIds, type: 'assigned',
        title: `${currentUser?.name || 'Колега'} призначив вам ${issue.issueKey}`, body: issue.title,
        link: `/${projectId}/issue/${issueId}`, issueId, projectId,
        organizationId: activeOrg?.id || activeOrg?.organizationId || '',
        // `actor` is resolved server-side from the ID token; passing it here
        // was silently dropped by /api/notifications.
      }).catch(() => {});
    }
  };

  const toggleAssignee = async (uid) => {
    const cur = issue.assigneeIds || [];
    await setAssignees(cur.includes(uid) ? cur.filter(a => a !== uid) : [...cur, uid]);
  };

  // ── Watchers (follow a task you're not assigned to, to get its notifications) ──
  const myUid = currentUser?.id || currentUser?.uid;
  const isWatching = (issue.watcherIds || []).includes(myUid);
  const toggleWatch = async () => {
    if (!myUid) return;
    await update({ watcherIds: isWatching ? arrayRemove(myUid) : arrayUnion(myUid) });
  };

  const handleTimerToggle = async () => {
    if (isTimerMine) {
      const result = stopTimer();
      if (result?.minutes > 0) setLogForm({ minutes: result.minutes, desc: '' });
    } else {
      if (activeTimer) { showToast('Зупини поточний таймер спочатку', 'error'); return; }
      startTimer(issueId, projectId);
    }
  };

  const handleParentChange = async nextParentIssueId => {
    if (parentSaving) return;
    if (nextParentIssueId && childIssues.length > 0) {
      showToast('Задачу з підзадачами не можна зробити підзадачею', 'error');
      return;
    }
    try {
      setParentSaving(true);
      await setIssueParent(issueId, nextParentIssueId || null);
      showToast(nextParentIssueId ? 'Основну задачу змінено' : 'Задача стала самостійною');
    } catch (error) {
      showToast(error.message || 'Не вдалося змінити основну задачу', 'error');
    } finally {
      setParentSaving(false);
    }
  };

  const handleLogTime = async () => {
    if (!logForm) return;

    if (logForm.estim !== undefined && logForm.estim !== (estimMin || 0)) {
      await update({ estimateMinutes: logForm.estim });
    }

    // The issue's denormalised `spentMinutes` mirror is maintained inside
    // useTimeLogs, in the same batch as the log itself — writing it here as
    // well raced with concurrent logs and could drop one of them.
    if (logForm.minutes > 0) {
      try {
        if (logForm.id) {
          await updateTimeLog(logForm.id, { spentMinutes: logForm.minutes, description: logForm.desc });
          showToast('Запис оновлено ✓');
        } else {
          const uid = currentUser?.id || currentUser?.uid;
          await addTimeLog(issueId, projectId, uid, logForm.minutes, logForm.desc);
          showToast(`${logForm.minutes} хв списано ✓`);
        }
      } catch (err) {
        showToast(err.message || 'Не вдалося зберегти час', 'error');
        return;
      }
    } else if (logForm.minutes === 0 && logForm.estim !== undefined && logForm.estim !== (estimMin || 0)) {
      showToast('Оцінку часу оновлено ✓');
    }
    setLogForm(null);
  };

  const handleDeleteTimeLog = async (log) => {
    if (!(await confirmDialog({
      title: 'Видалити запис часу?',
      message: 'Ви впевнені, що хочете видалити цей запис часу?',
      confirmText: 'Видалити', danger: true,
    }))) return;
    try {
      await deleteTimeLog(log.id);
      showToast('Запис часу видалено ✓');
    } catch (err) {
      showToast('Помилка видалення: ' + err.message, 'error');
    }
  };

  // ── Attachments (first-class files on the task, separate from comments) ──
  const handleUploadAttachments = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadingAttach(true);
    try {
      const orgId = project?.organizationId || '';
      // Uploaded in parallel, and appended with arrayUnion so two people
      // attaching files at the same time cannot overwrite each other's list.
      const uploaded = await Promise.all(files.map(async file => ({
        id: makeAttachmentId(),
        ...await uploadFile(file, `organizations/${orgId}/attachments`), // { name, url, size, type }
        uploadedById: currentUser?.id || currentUser?.uid || '',
        uploadedByName: currentUser?.name || currentUser?.email || '',
        uploadedAt: nowMs(),
      })));
      await update({ attachments: arrayUnion(...uploaded) });
      showToast(`Додано вкладень: ${uploaded.length} ✓`);
      return uploaded;
    } catch (err) {
      showToast('Помилка завантаження файлу', 'error');
      return [];
    } finally {
      setUploadingAttach(false);
    }
  };

  const handleDeleteAttachment = async (id) => {
    const target = (issue.attachments || []).find(a => a.id === id);
    if (!(await confirmDialog({
      title: 'Видалити вкладення?',
      message: `${target?.name || 'Файл'} буде видалено із завдання і зі сховища. Це не можна скасувати.`,
      confirmText: 'Видалити',
      danger: true,
    }))) return;
    const removed = target;
    await update({ attachments: (issue.attachments || []).filter(a => a.id !== id) });
    // Release the stored file too — dropping only the metadata left the upload
    // in Cloudinary forever, still being paid for.
    if (removed?.storagePath) {
      await deleteFileFromCloudinary(removed.storagePath, removed.resourceType).catch(() => {});
    }
  };

  const handleAddSubtask = async () => {
    const title = subtaskText.trim();
    if (!title || creatingSubtask) return;
    if (parentIssueId) {
      showToast('Підзадача не може мати власні підзадачі', 'error');
      return;
    }
    const initialStatus = (
      visibleStatuses.find(status => status.id === 'todo' && !doneStatusIds.includes(status.id))
      || visibleStatuses.find(status => !doneStatusIds.includes(status.id))
      || visibleStatuses[0]
    )?.id || 'backlog';
    const childTypeId = creatableTypes.find(type => type.id === 'task')?.id || creatableTypes[0]?.id;
    if (!childTypeId) {
      showToast('Спершу додайте активний тип задачі в налаштуваннях', 'error');
      return;
    }
    try {
      setCreatingSubtask(true);
      const created = await createIssue({
        title,
        description: '',
        type: childTypeId,
        priority: issue.priority || 'medium',
        status: initialStatus,
        columnId: initialStatus,
        parentIssueId: issueId,
        assigneeIds: issue.assigneeIds || [],
        labelIds: [],
        estimateMinutes: 0,
      }, actor);
      setSubtaskText('');
      setShowSubInput(false);
      showToast(`${created.issueKey || 'Підзадачу'} створено`);
    } catch (error) {
      showToast(error.message || 'Не вдалося створити підзадачу', 'error');
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleMoveLegacyChecklistToDescription = async () => {
    if (migratingChecklist) return;
    try {
      setMigratingChecklist(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Потрібна авторизація');
      const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}/legacy-checklist`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не вдалося перенести чекліст');
      showToast('Чекліст перенесено в опис');
    } catch (error) {
      showToast(error.message || 'Не вдалося перенести чекліст', 'error');
    } finally {
      setMigratingChecklist(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({
      title: `Видалити ${issue.issueKey}?`,
      message: childIssues.length > 0
        ? `${childIssues.length} підзадач не буде видалено — вони стануть самостійними задачами без батьківської.`
        : 'Задачу та її службові дані буде видалено без можливості відновлення.',
      confirmText: 'Видалити', danger: true,
    }))) return;
    try {
      await deleteIssue(issueId, childIssues.length > 0 ? { childPolicy: 'promote' } : undefined);
      router.push(`/${projectId}`);
    } catch (error) {
      showToast(error.message || 'Не вдалося видалити задачу', 'error');
    }
  };

  // Built once and placed by the description block below — inside the canvas
  // panel when there is a description, in its own panel otherwise (and while
  // editing, where the per-row "Вставити в опис" action lives).
  const attachmentRows = (
    <AttachmentRows
      attachments={visibleAttachments}
      isEditing={isEditing}
      isArchived={isArchived}
      onOpen={setViewerMat}
      onInsert={(attachment, fileType, url) => {
        const markdown = fileType === 'image' ? `![${attachment.name}](${url})` : `[${attachment.name}](${url})`;
        setDraft(current => ({ ...current, description: `${current.description || ''}${current.description ? '\n\n' : ''}${markdown}` }));
      }}
      onDelete={handleDeleteAttachment}
    />
  );

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isModal ? 'bg-white' : 'bg-transparent'}`}>
      {/* Lightbox */}
      {viewerMat && <MediaViewer mat={viewerMat} onClose={() => setViewerMat(null)} />}

      {/* The bottom breathing room belongs only to the data column. Putting it
          on this shared wrapper shortens the chat by the same amount and makes
          the fixed panel jump upward. */}
      <div
        onScroll={event => setIsHeaderScrolled(event.currentTarget.scrollTop > 4)}
        className={`w-full page-gutter ${isModal ? 'pt-[8px] pb-[32px]' : 'pt-[56px] pb-0'} flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar`}
      >

        <div className={`grid grid-cols-1 gap-[20px] items-stretch ${isModal ? '' : 'lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] lg:flex-1 lg:min-h-0'}`}>

          {/* LEFT SIDE (Data) */}
          <div
            ref={leftScrollRef}
            onScroll={event => setIsHeaderScrolled(event.currentTarget.scrollTop > 4)}
            className={`flex flex-col overflow-visible ${isModal ? '' : 'pb-[20px] custom-scrollbar lg:min-h-0 lg:overflow-y-auto lg:pr-2'}`}
          >
            <div
              className={`sticky ${isModal ? 'top-0' : 'top-[56px] lg:top-0'} z-[30]`}
            >

             {/* TITLE & ACTIONS */}
             <div className="flex w-full items-start justify-between gap-[16px] bg-white pb-[12px] pt-[12px]">
               <div className="flex flex-col gap-[4px] flex-1 min-w-0">
            {parentIssueId && (
              <div className="mb-1 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted">
                <Layers size={12} className="shrink-0" />
                <span className="shrink-0">Підзадача для</span>
                <Link
                  href={`/${projectId}/issue/${parentIssueId}`}
                  className="min-w-0 truncate font-semibold text-ink hover:underline"
                >
                  {parentIssue?.issueKey || parentIssueId}
                  {parentIssue?.title ? ` — ${parentIssue.title}` : ''}
                </Link>
                {!isArchived && (
                  <Button
                    style="ghost"
                    size="icon-xs"
                    icon={X}
                    onClick={() => handleParentChange(null)}
                    disabled={parentSaving}
                    aria-label="Відв’язати від основної задачі"
                    title="Зробити самостійною задачею"
                    className="shrink-0"
                  />
                )}
              </div>
            )}
            {isEditing ? (
              <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="text-[24px] font-bold text-ink tracking-tight bg-transparent border-b-2 border-ink pb-1 outline-none w-full" placeholder="Назва завдання..." />
            ) : (
              <h1 className="ui-type-page-title text-ink tracking-tight leading-tight">{issue.title}</h1>
            )}
            
            {/* Metadata strip for non-editable details */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted font-medium mt-1.5">
              <Popover
                position="bottom"
                align="start"
                gap={4}
                hideCloseIcon
                hideArrow
                minWidth="200px"
                padding={isExternalReporter ? 'default' : 'tight'}
                triggerClassName="inline-flex"
                trigger={(
                  <button
                    type="button"
                    data-ui-control="identity-meta-trigger"
                    className="ui-native-control"
                  >
                    <span>Автор:</span>
                    <UserAvatar user={reporter} size="xs" />
                    <span className="text-ink font-semibold">{reporter.name}</span>
                  </button>
                )}
              >
                {({ close }) => isExternalReporter ? (
                  <div className="w-[260px]">
                    <p className="text-[13px] font-bold text-ink">Зовнішній автор</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{externalReporterSource}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-faint">
                      Це не учасник організації, тому профіль та особистий чат недоступні.
                    </p>
                    {issue.source === 'youtrack' && issue.importMetadata?.sourceUrl && (
                      <a
                        href={issue.importMetadata.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline"
                      >
                        Відкрити в YouTrack <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="w-[188px]">
                    <Button
                      style="ghost"
                      size="md"
                      composition="menu-item"
                      onClick={() => {
                        close();
                        const params = new URLSearchParams(searchParams.toString());
                        params.set('member', reporterMember.id || reporterMember.uid);
                        router.push(`${pathname}?${params.toString()}`);
                      }}
                    >
                      Переглянути профіль
                    </Button>
                    <Button
                      style="ghost"
                      size="md"
                      composition="menu-item"
                      onClick={() => {
                        close();
                        router.push(`/chat?dm=${encodeURIComponent(reporterMember.id || reporterMember.uid)}`);
                      }}
                    >
                      Написати в чат
                    </Button>
                  </div>
                )}
              </Popover>
              <span className="w-[3px] h-[3px] rounded-full bg-faint" />
              
              {/* Created relative time */}
              <Tooltip
                content={`Створено: ${issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleString('uk-UA') : issue.createdAt ? new Date(issue.createdAt).toLocaleString('uk-UA') : '—'}`}
                position="bottom"
              >
                <div className="flex items-center gap-1 cursor-help border-b border-dashed border-transparent hover:border-faint transition-colors">
                  <span>створили</span>
                  <span className="text-ink font-semibold">{timeAgo(issue.createdAt)}</span>
                </div>
              </Tooltip>
              <span className="w-[3px] h-[3px] rounded-full bg-faint" />
              <Tooltip
                content={`Оновлено: ${(issue.updatedAt || issue.createdAt)?.toDate ? (issue.updatedAt || issue.createdAt).toDate().toLocaleString('uk-UA') : (issue.updatedAt || issue.createdAt) ? new Date(issue.updatedAt || issue.createdAt).toLocaleString('uk-UA') : '—'}`}
                position="bottom"
              >
                <div className="flex items-center gap-1 cursor-help border-b border-dashed border-transparent hover:border-faint transition-colors">
                  <span>оновили</span>
                  <span className="text-ink font-semibold">{timeAgo(issue.updatedAt || issue.createdAt)}</span>
                </div>
              </Tooltip>
              {isOverdue && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-faint" />
                  <Pill tone="danger" size="sm">Прострочено</Pill>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {isEditing ? (
              <>
                <Button style="secondary" size="md" onClick={cancelEdit}>Скасувати</Button>
                <Button style="primary" size="md" icon={Check} onClick={saveEdit}>Зберегти</Button>
              </>
            ) : (
              <>
              {!isArchived && <Button style="secondary" size="icon-lg" icon={Pencil} onClick={enterEdit} aria-label="Редагувати завдання" title="Редагувати завдання" />}
              <ContextMenu
                trigger={(
                  <Button
                    style="secondary"
                    size="icon-lg"
                    icon={MoreHorizontal}
                    aria-label="Опції завдання"
                    title="Опції"
                  />
                )}
                dropdownClassName="w-[210px]"
                items={[
                  { label: 'Копіювати посилання', icon: Copy, onClick: copyIssueLink },
                  { label: 'Скопіювати AI-промпт', icon: Sparkles, onClick: copyAiPrompt },
                  ...(!isArchived ? [
                    {
                      label: isWatching ? 'Не стежити' : 'Стежити',
                      icon: isWatching ? EyeOff : Eye,
                      onClick: toggleWatch,
                    },
                    ...(can(orgRole, 'delete:issue')
                      ? [{ label: 'Видалити', icon: Trash2, onClick: handleDelete, isDanger: true }]
                      : []),
                  ] : []),
                ]}
              />
              </>
            )}
            {isModal && onClose && (
              <>
                <Button
                  style="secondary"
                  size="icon"
                  icon={Maximize2}
                  onClick={() => {
                    onClose();
                    router.push(`/${projectId}/issue/${issueId}`);
                  }}
                  aria-label="Відкрити на повній сторінці"
                  title="Відкрити на повній сторінці"
                />
                <Button style="secondary" size="icon" icon={X} onClick={onClose} aria-label="Закрити" title="Закрити" />
              </>
            )}
          </div>
            </div>

            {/* ATTRIBUTES STRIP */}
            <div className="relative isolate -mx-2 px-2">
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-2 top-0 z-[5] h-1/2 transition-opacity duration-200 ${isHeaderScrolled ? 'opacity-100' : 'opacity-0'}`}
              style={{
                background: 'linear-gradient(to bottom, rgb(255,255,255) 0%, rgba(255,255,255,0.92) 34%, rgba(255,255,255,0) 100%)',
              }}
            />
            <TaskAttributesPanel
              singleRow
              context="task"
              compact
              condensed={isHeaderScrolled}
              cardClassName="transition-[background-color,padding] duration-200"
              cardStyle={{
                backgroundColor: isHeaderScrolled ? 'rgba(244,244,245,0.36)' : undefined,
                backdropFilter: isHeaderScrolled ? 'blur(4px)' : undefined,
                WebkitBackdropFilter: isHeaderScrolled ? 'blur(4px)' : undefined,
              }}
              primaryChildren={
                <>
                  {/* Status */}
                  <div className={attributeItemClass} onClick={e => { if (isArchived) return; if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className={attributeLabelClass}>Статус</span>
                    <Select compact disabled={isArchived} value={issue.columnId || issue.status || visibleStatuses[0]?.id} onChange={val => handleStatusChange(val)} options={visibleStatuses.map(s => ({ value: s.id, label: s.label, dotColor: s.color }))} buttonClassName={compactSelectClass} />
                  </div>

                  {/* Assignees — the task model has always been multi-assignee;
                      the single Select silently hid everyone past the first. */}
                  <div className={attributeItemClass} onClick={e => { if (isArchived) return; if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className={attributeLabelClass}>Виконавці</span>
                    <MultiSelect
                      compact
                      showSelectedAvatars
                      ariaLabel="Виконавці завдання"
                      disabled={isArchived}
                      value={issue.assigneeIds || []}
                      onChange={setAssignees}
                      options={members.map(m => ({ value: m.id || m.uid, label: m.name, user: m }))}
                      placeholder="Не призначено"
                      searchPlaceholder="Знайти учасника..."
                      buttonClassName={compactSelectClass}
                      dropdownClassName="w-[260px]"
                    />
                  </div>

                  {/* Sprint */}
                  <div className={`max-sm:hidden ${attributeItemClass}`} onClick={e => { if (isArchived) return; if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className={attributeLabelClass}>Спринт</span>
                      <Select
                        compact
                      disabled={isArchived}
                      value={issue.sprintId || ''} 
                      onChange={val => update({ sprintId: val || null })} 
                      options={[
                        { value: '', label: 'Беклог (без спринта)' },
                        ...sprints.map(s => ({ value: s.id, label: s.name }))
                      ]} 
                      buttonClassName={compactSelectClass}
                    />
                  </div>

                  {/* Due date */}
                  <div className={`max-sm:hidden ${attributeItemClass}`}>
                    <span className={attributeLabelClass}>Дедлайн</span>
                    <DatePicker 
                      compact
                      disabled={isArchived}
                      hideIcon 
                      inputClassName={`${compactInputClass} ${isOverdue ? 'text-[#ef4444]' : dueStr ? 'text-ink' : 'text-faint'}`}
                      value={isEditing ? (draft.dueDate || '') : (issue.dueDate || '')}
                      onChange={(val) => {
                        if (isEditing) setDraft(d => ({ ...d, dueDate: val }));
                        else update({ dueDate: val ? fromDateInput(val, { endOfDay: true }) : null });
                      }}
                      placeholder="Без дедлайну"
                    />
                  </div>

                  {/* Time tracking */}
                  <div
                    className={`${attributeItemClass} max-sm:px-1.5`}
                    onClick={event => {
                      if (isArchived || event.target.closest('button')) return;
                      setLogForm({ minutes: 0, estim: estimMin || 0, desc: '' });
                      setLogTab('spend');
                    }}
                  >
                    <span className={attributeLabelClass}><span className="sm:hidden">Час</span><span className="max-sm:hidden">Трекінг часу</span></span>
                    <div className="flex h-[22px] min-w-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={isArchived}
                        onClick={handleTimerToggle}
                        aria-label={isTimerMine ? 'Зупинити таймер' : 'Запустити таймер'}
                        title={isTimerMine ? 'Зупинити таймер' : 'Запустити таймер'}
                        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] leading-none transition-colors ${isTimerMine ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-line text-ink hover:bg-[#d9d9d9]'}`}
                      >
                        {isTimerMine ? (
                          <StopIcon size={10} className="block fill-current" />
                        ) : (
                          <Play
                            size={10}
                            strokeWidth={0}
                            className="block translate-x-[1px] fill-current"
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLogForm({ minutes: 0, estim: estimMin || 0, desc: '' });
                          setLogTab('spend');
                        }}
                        className="min-w-0 truncate text-[11px] font-bold text-ink"
                        aria-label="Відкрити трекінг часу"
                      >
                        {isTimerMine ? formatElapsed((spentMin * 60) + timerElapsed) : fmtMin(spentMin)}
                        {estimMin > 0 && <span className="font-medium text-muted max-sm:hidden"> / {fmtMin(estimMin)}</span>}
                      </button>
                    </div>
                  </div>

                  {/* Less frequently changed fields */}
                  <Popover
                    position="bottom"
                    hideCloseIcon
                    className="flex h-full items-center"
                    onOpenChange={setShowDetailsDropdown}
                    trigger={(
                      <button
                        type="button"
                        className={`${detailsButtonClass} max-sm:px-0 ${showDetailsDropdown ? 'bg-white text-ink' : 'text-muted'}`}
                        aria-expanded={showDetailsDropdown}
                        aria-label="Деталі завдання"
                        title={`Пріоритет: ${PRIORITIES.find(item => item.id === issue.priority)?.label || 'не вказано'} · Тип: ${TYPES.find(item => item.id === issue.type)?.label || 'не вказано'}`}
                      >
                        <Settings2 size={14} />
                        <span className="max-sm:hidden">Деталі</span>
                      </button>
                    )}
                  >
                      <div className="flex w-[248px] max-w-full flex-col gap-4">
                        <div className="flex flex-col gap-1.5 sm:hidden">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Спринт</span>
                          <Select
                            disabled={isArchived}
                            value={issue.sprintId || ''}
                            onChange={val => update({ sprintId: val || null })}
                            options={[{ value: '', label: 'Беклог (без спринта)' }, ...sprints.map(item => ({ value: item.id, label: item.name }))]}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 sm:hidden">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Дедлайн</span>
                          <DatePicker
                            compact
                            disabled={isArchived}
                            textTone={isOverdue ? 'danger' : dueStr ? 'default' : 'faint'}
                            value={isEditing ? (draft.dueDate || '') : (issue.dueDate || '')}
                            onChange={val => {
                              if (isEditing) setDraft(current => ({ ...current, dueDate: val }));
                              else update({ dueDate: val ? fromDateInput(val, { endOfDay: true }) : null });
                            }}
                            placeholder="Без дедлайну"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Пріоритет</span>
                          <Select
                            disabled={isArchived}
                            value={draft.priority || issue.priority || ''}
                            onChange={val => {
                              update({ priority: val });
                              if (isEditing) setDraft(current => ({ ...current, priority: val }));
                            }}
                            options={PRIORITIES.map(item => ({ value: item.id, label: item.label, dotColor: item.color }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Тип</span>
                          <Select
                            disabled={isArchived}
                            value={draft.type || issue.type || ''}
                            onChange={val => {
                              update({ type: val });
                              if (isEditing) setDraft(current => ({ ...current, type: val }));
                            }}
                            options={EDITABLE_TYPES.map(item => ({ value: item.id, label: item.label, dotColor: item.color }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Основна задача</span>
                          <Select
                            disabled={isArchived || childIssues.length > 0 || parentSaving}
                            value={parentIssueId || ''}
                            onChange={handleParentChange}
                            options={[
                              { value: '', label: 'Самостійна задача' },
                              ...parentCandidates.map(candidate => ({
                                value: candidate.id,
                                label: `${candidate.issueKey || candidate.id} — ${candidate.title}`,
                              })),
                            ]}
                            placeholder={childIssues.length > 0 ? 'Це основна задача' : 'Самостійна задача'}
                          />
                          {childIssues.length > 0 && (
                            <span className="text-[10px] leading-relaxed text-faint">
                              Спершу відв’яжіть підзадачі, щоб змінити рівень.
                            </span>
                          )}
                        </div>
                      </div>
                  </Popover>
                </>
              }
            />
            </div>
            </div>

            {/* LOG TIME FORM MODAL */}
            {logForm && (
              <Dialog
                isOpen
                onClose={() => setLogForm(null)}
                title="Трекінг часу"
                titleContext="dialog"
                size="md"
                bodyPadding="responsive"
                bodyClassName="custom-scrollbar flex flex-col gap-5"
              >
                  <Segmented
                    value={logTab}
                    onChange={setLogTab}
                    surface="canvas"
                    composition="dialog-tabs"
                    options={[
                      { value: 'spend', label: 'Списати час' },
                      ...(!logForm.id ? [{ value: 'estim', label: 'Оцінка часу' }] : []),
                    ]}
                  />
                  
                  {logTab === 'spend' ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Списати час</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input size="lg" type="number" min="0" placeholder="0" value={Math.floor(logForm.minutes / 60) || ''} onChange={e => {
                               const hrs = parseInt(e.target.value) || 0;
                               const mins = logForm.minutes % 60;
                               setLogForm(f => ({ ...f, minutes: hrs * 60 + mins }));
                            }} composition="duration-hours" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">год</span>
                          </div>
                          <div className="relative flex-1">
                            <Input size="lg" type="number" min="0" max="59" placeholder="0" value={logForm.minutes % 60 || ''} onChange={e => {
                               const mins = parseInt(e.target.value) || 0;
                               const hrs = Math.floor(logForm.minutes / 60);
                               setLogForm(f => ({ ...f, minutes: hrs * 60 + Math.min(mins, 59) }));
                            }} composition="duration-minutes" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">хв</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Запланувати час</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input size="lg" type="number" min="0" placeholder="0" value={Math.floor((logForm.estim || 0) / 60) || ''} onChange={e => {
                               const hrs = parseInt(e.target.value) || 0;
                               const mins = (logForm.estim || 0) % 60;
                               setLogForm(f => ({ ...f, estim: hrs * 60 + mins }));
                            }} composition="duration-hours" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">год</span>
                          </div>
                          <div className="relative flex-1">
                            <Input size="lg" type="number" min="0" max="59" placeholder="0" value={(logForm.estim || 0) % 60 || ''} onChange={e => {
                               const mins = parseInt(e.target.value) || 0;
                               const hrs = Math.floor((logForm.estim || 0) / 60);
                               setLogForm(f => ({ ...f, estim: hrs * 60 + Math.min(mins, 59) }));
                            }} composition="duration-minutes" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">хв</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {logTab === 'spend' && (
                    <div>
                      <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Опис (необовʼязково)</p>
                      <Input size="lg" type="text" composition="metric-text" placeholder="Що було зроблено?" value={logForm.desc} onChange={e => setLogForm(f => ({ ...f, desc: e.target.value }))} />
                    </div>
                  )}
                  
                  <div className="flex gap-3 justify-end mt-2">
                    <Button style="secondary" size="md" onClick={() => setLogForm(null)}>Скасувати</Button>
                    <Button style="primary" size="md" onClick={handleLogTime}>{logForm.id ? 'Зберегти зміни' : 'Зберегти'}</Button>
                  </div>

                  <div className="border-t border-line pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="ui-type-item-title text-ink">Журнал часу</h4>
                      {timeLogs.length > 0 && (
                        <span className="text-[11px] font-semibold text-muted">
                          {timeLogs.length} {timeLogs.length === 1 ? 'запис' : timeLogs.length < 5 ? 'записи' : 'записів'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {timeLogs.slice(0, timeLogsPage * TIME_LOGS_PER_PAGE).map(log => {
                        const logMember = members.find(member => (member.id || member.uid) === log.userId);
                        const isLogAuthor = log.userId === currentUser?.uid || log.userId === currentUser?.id;
                        return (
                          <div key={log.id} data-ui-surface="local" className="group flex items-start gap-3 rounded-[10px] bg-canvas px-3 py-2.5">
                            <UserAvatar user={logMember} size="sm" className="mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-bold text-ink">{logMember?.name || 'Невідомий'}</span>
                                <Pill tone="surface-ink" size="md" shape="badge">{fmtMin(log.spentMinutes)}</Pill>
                                <span className="text-[10px] text-muted">
                                  {log.loggedAt?.toDate ? formatDate(log.loggedAt.toDate()) : log.loggedAt ? formatDate(new Date(log.loggedAt)) : ''}
                                </span>
                              </div>
                              {log.description && <p className="mt-1 break-words text-[12px] leading-5 text-muted">{log.description}</p>}
                            </div>
                            {isLogAuthor && !isArchived && (
                              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100">
                                <button type="button" onClick={() => { setLogForm({ id: log.id, minutes: log.spentMinutes, desc: log.description || '' }); setLogTab('spend'); }} className="rounded-[6px] p-1.5 text-muted hover:bg-white hover:text-ink" aria-label="Редагувати запис"><Pencil size={13} /></button>
                                <button type="button" onClick={() => handleDeleteTimeLog(log)} className="rounded-[6px] p-1.5 text-muted hover:bg-red-50 hover:text-red-500" aria-label="Видалити запис"><Trash2 size={13} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {timeLogs.length === 0 && <p className="rounded-[10px] bg-canvas px-3 py-5 text-center text-[12px] text-muted">Час ще не списували</p>}
                      {timeLogs.length > timeLogsPage * TIME_LOGS_PER_PAGE && (
                        <Button style="secondary" size="sm" onClick={() => setTimeLogsPage(page => page + 1)}>Показати ще</Button>
                      )}
                    </div>
                  </div>
              </Dialog>
            )}

            {/* MAIN SECTIONS PANEL */}
            <div className="mt-1 flex w-full flex-col gap-5">
              <div className="flex flex-col gap-5 overflow-visible">
              {/* DESCRIPTION */}
              <div className="flex flex-col gap-3 py-1">
                <div className="flex items-center gap-3">
                  <h2 className="ui-type-card-title text-ink">Опис</h2>
                </div>
                <div data-ui-surface="panel" data-ui-padding="wide" className="ui-surface flex w-full flex-col gap-4">
                  {isEditing ? (
                    <>
                      <MarkdownEditor
                        value={draft.description}
                        onChange={description => setDraft(d => ({ ...d, description }))}
                        onUploadFiles={handleUploadAttachments}
                        uploading={uploadingAttach}
                        placeholder="Додай детальний опис завдання..."
                        minHeight="320px"
                      />
                      {visibleAttachments.length > 0 && (
                        <div className="mt-3">
                          {attachmentRows}
                        </div>
                      )}
                    </>
                  ) : (issue.description || visibleAttachments.length > 0) ? (
                    <>
                      {issue.description && (
                        <MarkdownViewer
                          content={issue.description}
                          className="text-[15px] leading-7"
                          onTaskToggle={isArchived ? undefined : (taskLine, checked) => update({ description: setTaskChecked(issue.description, taskLine, checked) })}
                        />
                      )}
                      {visibleAttachments.length > 0 && (
                        <div className={issue.description ? 'mt-4' : ''}>{attachmentRows}</div>
                      )}
                    </>
                  ) : (
                    <button onClick={enterEdit} className="text-[13px] text-faint italic hover:text-muted transition-colors text-left">
                      Натисни Редагувати щоб додати опис...
                    </button>
                  )}

                {(issue.labelIds || []).length > 0 && (
                  <div className="pt-1">
                    <SectionHeading icon={TagIcon} title="Мітки" count={issue.labelIds.length} />
                    <div className="flex flex-wrap items-center gap-2">
                      {(issue.labelIds || []).map(id => {
                        const label = availableLabels.find(item => item.id === id);
                        if (!label) return null;
                        return <Tag key={id} label={label.label || label.name} color={label.color} onRemove={() => update({ labelIds: (issue.labelIds || []).filter(item => item !== id) })} />;
                      })}
                    </div>
                  </div>
                )}

              {/* REAL CHILD ISSUES */}
              {(childIssues.length > 0 || showSubInput) && (
                <div className="pt-2">
                  <SectionHeading
                    icon={ListTree}
                    title="Підзадачі"
                    count={childIssues.length}
                    meta={openChildCount > 0 ? `${childIssuesDone}/${childIssues.length} · ${openChildCount} ще в роботі` : `${childIssuesDone}/${childIssues.length}`}
                  />
                  {childIssues.length > 0 && (
                    <div className="mb-4 h-[4px] overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-[#10b981] transition-all"
                        style={{ width: `${(childIssuesDone / childIssues.length) * 100}%` }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {/* Subtasks are real issues, so they get the same shared row the
                        list view uses instead of a lookalike built here. */}
                    {childIssues.map(child => (
                      <TaskRow
                        key={child.id}
                        issue={child}
                        issues={issues}
                        allIssues={issues}
                        issueLinks={links}
                        members={members}
                        labels={availableLabels}
                        sprints={sprints}
                        projectId={child.projectId || projectId}
                        projectName={project?.name}
                        isTimerActive={activeTimer?.issueId === child.id}
                      />
                    ))}
                    {showSubInput && (
                      <Surface preset="compact-bordered-card" padding="md" className="mt-2 flex flex-col gap-3">
                        <Input
                          autoFocus
                          size="md"
                          value={subtaskText}
                          onChange={event => setSubtaskText(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') handleAddSubtask();
                            if (event.key === 'Escape') {
                              setShowSubInput(false);
                              setSubtaskText('');
                            }
                          }}
                          placeholder="Назва повноцінної підзадачі"
                        />
                        <p className="text-[10px] leading-relaxed text-muted">
                          Підзадача отримає власний ключ, статус, виконавців, час і аналітику.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button style="secondary" size="sm" onClick={() => { setShowSubInput(false); setSubtaskText(''); }}>Скасувати</Button>
                          <Button
                            style="primary"
                            size="sm"
                            disabled={!subtaskText.trim() || creatingSubtask}
                            loading={creatingSubtask}
                            onClick={handleAddSubtask}
                          >
                            Створити підзадачу
                          </Button>
                        </div>
                      </Surface>
                    )}
                  </div>
                </div>
              )}

              {/* LEGACY CHECKLIST — new lightweight steps live in description Markdown */}
              {checklistAll > 0 && (
              <div className="pt-2">
              <SectionHeading
                icon={CheckSquare}
                title="Старий чекліст"
                meta={`${checklistDone}/${checklistAll}`}
                action={!isArchived ? (
                  <Button
                    style="ghost"
                    size="sm"
                    onClick={handleMoveLegacyChecklistToDescription}
                    loading={migratingChecklist}
                    disabled={migratingChecklist}
                    className="ml-auto"
                  >
                    Перенести в опис
                  </Button>
                ) : null}
              />
              <p className="mb-3 text-[10px] leading-relaxed text-muted">
                Це старий формат. Нові чеклісти додавайте як checkbox у описі задачі.
              </p>
              <div className="h-[4px] bg-line rounded-full mb-4 overflow-hidden">
                <div className="h-full bg-[#10b981] rounded-full transition-all" style={{ width: `${(checklistDone / checklistAll) * 100}%` }} />
              </div>
              <div className="flex flex-col gap-[6px]">
                 {(issue.subtasks || []).map((s, i) => (
                  <div key={s.id || i} data-ui-surface="local" className="flex items-center gap-3 px-3 py-[9px] bg-white rounded-[10px]">
                    {s.done
                      ? <CheckSquare size={16} className="shrink-0 text-[#10b981]" />
                      : <Square size={16} className="shrink-0 text-faint" />}
                    <span className={`text-[13px] font-medium ${s.done ? 'line-through text-faint' : 'text-ink'}`}>
                      {s.title}
                    </span>
                  </div>
                ))}
              </div>
              </div>
              )}
              {/* ISSUE LINKS */}
              {(currentIssueLinks.length > 0 || showLinkInput) && (
              <div className="flex flex-col pt-2">
              <SectionHeading icon={Link2} title="Зв’язки" count={currentIssueLinks.length} />

              <div className="flex flex-col gap-[6px]">
                {currentIssueLinks.map(({ link, perspective }) => {
                    const otherIssue = issues.find(candidate => candidate.id === perspective.otherIssueId)
                      || perspective.otherIssue;
                    const otherProjectId = otherIssue?.projectId || projectId;
                    const otherKey = otherIssue?.issueKey || perspective.otherIssueId;
                    const otherTitle = otherIssue?.title || 'Пов’язане завдання';
                    const requiresReview = link.requiresReview || link.legacyRelationType === 'subtask-of';

                    return (
                      <div key={link.id} data-ui-surface="local" className="flex items-center justify-between gap-3 px-3 py-[9px] bg-white rounded-[10px] hover:bg-[#eeeeee] transition-colors group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Pill tone="neutral" size="sm" shape="badge" uppercase>
                            {perspective.label}
                          </Pill>
                          {requiresReview && (
                            <Pill
                              tone="warning"
                              size="sm"
                              shape="badge"
                              title="Старий зв’язок «підзавдання»: напрямок не можна відновити автоматично"
                            >
                              Потребує перевірки
                            </Pill>
                          )}
                          <Link
                            href={`/${otherProjectId}/issue/${perspective.otherIssueId}`}
                            className="text-[13px] font-semibold text-ink hover:underline truncate"
                          >
                            <span className="text-muted font-medium mr-1 uppercase">{otherKey}</span>
                            {otherTitle}
                          </Link>
                        </div>
                        {!isArchived && (
                        <button
                          onClick={async () => {
                            try {
                              await removeLink(link.id);
                              showToast('Звʼязок видалено');
                            } catch (err) {
                              showToast('Помилка видалення: ' + err.message, 'error');
                            }
                          }}
                          className="text-faint hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50"
                          title="Видалити зв'язок"
                        >
                          <Trash2 size={13} />
                        </button>
                        )}
                      </div>
                    );
                  })}

                {showLinkInput && (
                  <div data-ui-surface="compact-bordered-card" data-ui-padding="md" className="ui-surface mt-2 flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <Select
                          ariaLabel="Тип зв’язку"
                          value={linkRelation}
                          onChange={setLinkRelation}
                          className="w-full"
                          dropdownClassName="w-full max-w-none"
                          options={ISSUE_LINK_OPTIONS}
                        />
                        <Select
                          ariaLabel="Пов’язане завдання"
                          value={linkTargetId}
                          onChange={setLinkTargetId}
                          className="w-full"
                          dropdownClassName="w-full max-w-none"
                          disabled={availableLinkIssues.length === 0}
                          placeholder="Немає доступних завдань у проєкті"
                          options={availableLinkIssues
                            .map(item => ({
                              value: item.id,
                              label: `${item.issueKey} — ${item.title}`,
                            }))}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button style="secondary" size="sm" onClick={() => { setShowLinkInput(false); }}>Скасувати</Button>
                      <Button
                        style="primary"
                        size="sm"
                        disabled={!linkTargetId || linkSaving}
                        loading={linkSaving}
                        onClick={async () => {
                          if (!linkTargetId || linkSaving) return;
                          try {
                            setLinkSaving(true);
                            await addLink(issueId, linkTargetId, linkRelation, currentUser?.uid || currentUser?.id);
                            showToast('Звʼязок додано');
                            setShowLinkInput(false);
                            setLinkTargetId('');
                          } catch (err) {
                            showToast('Помилка: ' + err.message, 'error');
                          } finally {
                            setLinkSaving(false);
                          }
                        }}
                      >Додати зв’язок</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
                </div>
                {!isArchived && (
                  <div className="relative flex flex-wrap items-center gap-1.5">
                    <ContextMenu
                      trigger={(
                        <Button
                          aria-label="Додати мітку"
                          style="ghost"
                          size="sm"
                          composition="inline-add-action"
                          icon={Plus}
                          disabled={availableLabels.length === 0}
                          title={availableLabels.length === 0 ? 'Немає доступних міток' : undefined}
                        >
                          <span className="sm:hidden">Мітка</span><span className="hidden sm:inline">Додати мітку</span>
                        </Button>
                      )}
                      dropdownClassName="w-[220px]"
                      closeOnSelect={false}
                      items={availableLabels.map(label => {
                        const active = (issue.labelIds || []).includes(label.id);
                        return {
                          label: label.label || label.name,
                          icon: TagIcon,
                          color: active ? label.color : undefined,
                          selected: active,
                          onClick: () => {
                            const current = issue.labelIds || [];
                            update({ labelIds: active ? current.filter(id => id !== label.id) : [...current, label.id] });
                          },
                        };
                      })}
                    />
                    {!parentIssueId && <Button
                      aria-label="Додати підзадачу"
                      style="ghost"
                      size="sm"
                      composition="inline-add-action"
                      icon={Plus}
                      onClick={() => setShowSubInput(value => !value)}
                    >
                      <span className="sm:hidden">Підзадача</span><span className="hidden sm:inline">Додати підзадачу</span>
                    </Button>}
                    <Button
                      aria-label="Додати зв’язок"
                      style="ghost"
                      size="sm"
                      composition="inline-add-action"
                      icon={Plus}
                      onClick={() => {
                        setShowLinkInput(value => !value);
                        setLinkTargetId(availableLinkIssues[0]?.id || '');
                      }}
                    >
                      <span className="sm:hidden">Зв’язок</span><span className="hidden sm:inline">Додати зв’язок</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* TIME LOGS LIST */}
              {false && (
              <div data-ui-surface="nested-card" data-ui-padding="lg" className="ui-surface flex flex-col gap-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="ui-type-eyebrow text-muted uppercase tracking-wider">Журнал часу</h2>
                  {timeLogs.length > 0 && (
                    <Pill tone="ink-subtle" size="sm">
                      {timeLogs.length}
                    </Pill>
                  )}
                </div>
                {!isArchived && <Button style="secondary" size="sm" icon={Plus} onClick={() => setLogForm({ minutes: 0, desc: '' })}>Списати</Button>}
              </div>

              <div className="flex flex-col gap-[6px]">
                {timeLogs.slice(0, timeLogsPage * TIME_LOGS_PER_PAGE).map(log => {
                  const logMember = members.find(m => (m.id || m.uid) === log.userId);
                  const isLogAuthor = log.userId === currentUser?.uid || log.userId === currentUser?.id;
                  
                  return (
                    <div key={log.id} data-ui-surface="local" className="flex items-start justify-between gap-3 px-3 py-[9px] bg-white rounded-[10px] hover:bg-[#fafafa] transition-colors group">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <UserAvatar user={logMember} size="xs" className="shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12px] font-semibold text-ink">
                              {logMember?.name || 'Невідомий'}
                            </span>
                            <Pill tone="info" size="sm" shape="badge">
                              {fmtMin(log.spentMinutes)}
                            </Pill>
                          </div>
                          {log.description && (
                            <p className="text-[12px] text-[#4b5563] mt-0.5 break-words">
                              {log.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted font-medium">
                              {log.loggedAt?.toDate
                                ? formatDate(log.loggedAt.toDate())
                                : log.loggedAt
                                  ? formatDate(new Date(log.loggedAt))
                                  : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {isLogAuthor && !isArchived && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center">
                          <button
                            onClick={() => { setLogForm({ id: log.id, minutes: log.spentMinutes, desc: log.description || '' }); setLogTab('spend'); }}
                            className="text-faint hover:text-ink transition-colors p-1 rounded hover:bg-canvas"
                            title="Редагувати запис"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTimeLog(log)}
                            className="text-faint hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                            title="Видалити запис"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {timeLogs.length > timeLogsPage * TIME_LOGS_PER_PAGE && (
                  <button
                    onClick={() => setTimeLogsPage(p => p + 1)}
                    className="mt-2 text-[12px] font-bold text-ink hover:text-ink-hover transition-colors py-2 text-center w-full rounded-[8px] hover:bg-canvas"
                  >
                    Показати ще
                  </button>
                )}
                {timeLogs.length === 0 && (
                  <div data-ui-surface="local" className="flex flex-col items-center justify-center py-6 px-4 text-center bg-white rounded-[10px] border border-dashed border-line">
                    <Clock size={32} className="text-faint mb-3" />
                    <p className="text-[13px] text-muted font-medium max-w-[200px]">
                      Час ще не залоговано — запустіть таймер або додайте запис вручну.
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}
            </div>

            {/* End of MAIN SECTIONS PANEL */}
            </div>
          </div>

          {/* Chat is only useful on the full task page. */}
          {!isModal && (
            <div className="mb-[32px] h-[65dvh] min-h-0 lg:sticky lg:top-0 lg:mb-0 lg:h-full lg:pb-[32px]">
              <div className="flex h-full flex-col overflow-hidden rounded-[16px] bg-canvas">
                {/* Звʼязаний QT+ проєкт → маленькі таби над чатом */}
                {qtplusLink?.projectId && (
                  <div className="relative flex shrink-0 items-center justify-center bg-canvas px-4 pb-2 pt-3">
                    <Tabs
                      tabs={[{ id: 'chat', label: 'Чат' }, { id: 'qtplus', label: 'QuickTeam+' }]}
                      activeTab={chatView}
                      onTabChange={setChatView}
                    />
                    {chatView === 'qtplus' && process.env.NEXT_PUBLIC_QTPLUS_URL && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_QTPLUS_URL}/project/${qtplusLink.projectId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-4 rounded-[8px] p-2 text-muted transition-colors hover:bg-white hover:text-ink"
                        title="Відкрити проєкт у QuickTeam+"
                        aria-label="Відкрити проєкт у QuickTeam+"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                )}
                <div className="flex min-h-0 flex-1 flex-col">
                  {chatView === 'qtplus' && qtplusLink?.projectId ? (
                    <IssueQtPlusChat qtProjectId={qtplusLink.projectId} currentUser={currentUser} />
                  ) : (
                    <UnifiedTimeline issueId={issueId} projectId={projectId} issue={issue} isArchived={isArchived} org={activeOrg} members={members} />
                  )}
                </div>
              </div>
            </div>
            )}

        </div>
      </div>
    </div>
  );
}
