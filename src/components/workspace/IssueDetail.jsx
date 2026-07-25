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
import { useIssueLinks }       from '@/lib/hooks/useIssueLinks';
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownViewer, { setTaskChecked } from '@/components/MarkdownViewer';
import UserAvatar from '@/components/UserAvatar';
import Tag from '@/components/ui/DataDisplay/Tag';
import UnifiedTimeline from '@/components/workspace/UnifiedTimeline';
import { useLocalization } from '@/lib/hooks/useLocalization';
import { fromDateInput, parseDueDate, toLocalDateInput } from '@/lib/utils/date';
import DatePicker from '@/components/ui/Forms/DatePicker';

import { can } from '@/lib/utils/can';
import { Select } from '@/components/ui/Select';
import { Popover, TaskAttributesPanel, Tabs, Tooltip, useConfirm } from '@/components/ui';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DEFAULT_PRIORITIES, DEFAULT_TYPES, PRIORITY_ICONS, TYPE_ICONS } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore       from '@/store/useWorkspaceStore';
import { sendNotification }    from '@/lib/hooks/useNotifications';
import {
  Heart, MessageSquare, Clock, History, PanelRightClose, PanelRightOpen, ExternalLink, X, Plus, Layers, Search, Settings2, Share2, Send, CheckSquare, Square, MoreHorizontal, Pencil, Check, Trash2, Paperclip, ChevronRight, Minus, Eye, EyeOff,
  CheckCircle, XCircle, Play, Square as StopIcon,
  FileText, Film, Music, Link2, Copy, Sparkles, Tag as TagIcon,
  ZoomIn, Maximize2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';
import { buildTaskAiPrompt } from '@/lib/utils/taskPrompt.mjs';

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
          <div className="w-9 h-9 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center border border-white/30 scale-90 group-hover:scale-100 transition-transform">
            {fileType === 'image' ? <ZoomIn size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
          </div>
        </div>
        {/* Status badge */}
        {statusIcon && (
          <div className="absolute top-2 right-2 z-10">
            <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
              <statusIcon.Icon size={12} style={{ color: statusIcon.color }} />
            </div>
          </div>
        )}
        {/* File type badge */}
        {fileType !== 'image' && fileType !== 'note' && fileUrl && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[8px] font-bold px-[5px] py-[2px] bg-black/40 text-white rounded-full backdrop-blur-sm uppercase">
              {fileType}
            </span>
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

// ── Media viewer (lightbox) ────────────────────────────────────────
function MediaViewer({ mat, onClose }) {
  const fileType = detectFileType(mat);
  const fileUrl  = getMatFileUrl(mat);
  const name     = mat.title || mat.name || 'Матеріал';

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/50 to-transparent z-10"
        onClick={e => e.stopPropagation()}>
        <p className="text-white font-semibold text-[14px] truncate max-w-[70vw]">{name}</p>
        <div className="flex items-center gap-2">
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener"
              className="flex items-center gap-1 text-white/70 hover:text-white text-[12px] font-medium transition-colors px-3 py-[5px] bg-white/10 rounded-full hover:bg-white/20">
              <ExternalLink size={12} /> Відкрити
            </a>
          )}
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {fileType === 'image' && fileUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={name}
            className="max-w-full max-h-[85vh] rounded-[8px] shadow-2xl object-contain" />
        )}
        {fileType === 'pdf' && fileUrl && (
          <iframe src={fileUrl} title={name} className="w-[80vw] h-[85vh] rounded-[8px] bg-white border-0" />
        )}
        {fileType === 'video' && fileUrl && (
          <video src={fileUrl} controls autoPlay className="max-w-full max-h-[85vh] rounded-[8px] shadow-2xl" />
        )}
        {fileType === 'audio' && fileUrl && (
          <div className="bg-ink rounded-[24px] px-8 py-10 flex flex-col items-center gap-4 min-w-[320px]">
            <Music size={48} className="text-white/40" />
            <p className="text-white font-semibold text-[15px] text-center">{name}</p>
            <audio src={fileUrl} controls className="w-full" />
          </div>
        )}
        {fileType === 'note' && (
          <div className="bg-amber-50 rounded-[16px] p-8 max-w-[600px] max-h-[80vh] overflow-y-auto shadow-2xl">
            <p className="text-amber-900 text-[14px] leading-relaxed whitespace-pre-wrap">{mat.content}</p>
          </div>
        )}
        {fileType === 'link' && mat.url && (
          <div className="bg-white rounded-[16px] p-8 flex flex-col items-center gap-4 shadow-2xl">
            <Link2 size={40} className="text-blue-500" />
            <p className="text-[14px] font-semibold text-ink">{name}</p>
            <a href={mat.url} target="_blank" rel="noopener"
              className="flex items-center gap-2 px-6 py-3 bg-ink text-white rounded-[10px] font-semibold text-[13px] hover:bg-ink-hover">
              <ExternalLink size={14} /> Перейти за посиланням
            </a>
          </div>
        )}
        {!fileUrl && fileType !== 'note' && fileType !== 'link' && fileType !== 'checklist' && (
          <div className="text-white text-center">
            <FileText size={48} className="mx-auto mb-3 text-white/40" />
            <p>Превʼю недоступне</p>
            {PORTAL_URL && (
              <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer"
                className="text-ink hover:underline text-[13px] mt-2 inline-block">Відкрити в порталі →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════

const RELATION_LABELS = {
  'blocks': 'Блокує',
  'is-blocked-by': 'Блокується',
  'duplicates': 'Дублює',
  'relates-to': 'Повʼязана з',
  'subtask-of': 'Підзавдання для'
};

export default function IssueDetail({ issueId, projectId, isModal, onClose }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { formatDate } = useLocalization();
  const { projects, currentUser, activeOrg } = useAppContext();
  const { issues, loading: issuesLoading, error: issuesError, updateIssue, deleteIssue, moveIssue } = useIssues(projectId, { includeLinks: false });

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

  const { logs: timeLogs, totalMinutes: loggedMinutes, addTimeLog, updateTimeLog, deleteTimeLog } = useTimeLogs(issueId);
  const { links = [], addLink, removeLink } = useIssueLinks(issueId);

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
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkRelation, setLinkRelation] = useState('relates-to');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [editingSubtaskIndex, setEditingSubtaskIndex] = useState(-1);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const [timeLogsPage, setTimeLogsPage] = useState(1);
  const actionsDropdownRef = useRef(null);
  const detailsDropdownRef = useRef(null);
  const [logForm,      setLogForm]      = useState(null);
  const [logTab, setLogTab] = useState('spend');
  const [viewerMat,    setViewerMat]    = useState(null); // lightbox
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const leftScrollRef = useRef(null);
  const TIME_LOGS_PER_PAGE = 5;

  // Click outside handlers
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target)) {
        setShowActionsDropdown(false);
      }
      if (detailsDropdownRef.current && !detailsDropdownRef.current.contains(e.target)) {
        setShowDetailsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
      statusName: STATUSES.find(item => item.id === (issue.status || issue.columnId))?.name || '',
      priorityName: PRIORITIES.find(item => item.id === issue.priority)?.name || '',
      typeName: TYPES.find(item => item.id === issue.type)?.name || '',
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

  const typeCfg     = TYPES.find(t => t.id === (isEditing ? draft.type : issue.type))         || TYPES[2] || TYPES[0];
  const priorityCfg = PRIORITIES.find(p => p.id === (isEditing ? draft.priority : issue.priority)) || PRIORITIES[2] || PRIORITIES[0];
  const statusCfg   = STATUSES.find(s => s.id === issue.columnId)                             || STATUSES[0];
  const TypeIcon    = typeCfg.icon;
  const PrioIcon    = priorityCfg.icon;

  const due       = parseDueDate(issue.dueDate);
  const isOverdue = due && due < new Date() && !doneStatusIds.includes(issue.columnId || issue.status);
  const dueStr    = due ? formatDate(due) : null;
  const attributeItemClass = `flex-1 min-w-0 flex flex-col rounded-[10px] px-2 cursor-pointer transition-[padding,gap,background-color] duration-200 hover:bg-[#ebebeb] ${isHeaderScrolled ? 'gap-0 py-1' : 'gap-[4px] py-1.5'}`;
  const attributeLabelClass = `block overflow-hidden text-[10px] font-bold uppercase tracking-wider text-muted transition-[max-height,opacity] duration-200 ${isHeaderScrolled ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100'}`;

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
  const subtasksDone  = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll   = (issue.subtasks || []).length;
  const visibleAttachments = issue.attachments || [];
  const currentIssueLinks = links.filter(link => link.sourceIssueId === issueId);

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
      parentEpicId:    issue.parentEpicId || null,
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
    if (draft.parentEpicId    !== (issue.parentEpicId || null)) patch.parentEpicId = draft.parentEpicId;
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
    try { await moveIssue(issueId, s, issue.order ?? 0, actor); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const toggleAssignee = async (uid) => {
    const cur  = issue.assigneeIds || [];
    const adding = !cur.includes(uid);
    const next = adding ? [...cur, uid] : cur.filter(a => a !== uid);
    await update({ assigneeIds: next });
    // Under team-gated project visibility, an assignee who isn't on the
    // project team could not open the task they were just given. Add them to
    // the team so the assignment is actually usable. Best-effort: only
    // owners/admins may write `team` (Firestore rules), so a member assigner's
    // write is denied and swallowed — the assignment itself still stands.
    if (adding && !teamUids.includes(uid)) {
      try {
        await updateDoc(doc(db, 'projects', projectId), { team: arrayUnion(uid) });
      } catch { /* member assigner lacks team-write permission — non-fatal */ }
    }
    if (adding && uid !== (currentUser?.id || currentUser?.uid))
      await sendNotification({ userIds: [uid], type: 'assigned',
        title: `${currentUser?.name || 'Колега'} призначив вам ${issue.issueKey}`, body: issue.title,
        link: `/${projectId}/issue/${issueId}`, issueId, projectId,
        organizationId: activeOrg?.id || activeOrg?.organizationId || '',
        actor: { id: currentUser?.id || currentUser?.uid, name: currentUser?.name || '', avatar: currentUser?.avatar || '' },
      }).catch(() => {});
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

  const handleLogTime = async () => {
    if (!logForm) return;

    if (logForm.estim !== undefined && logForm.estim !== (estimMin || 0)) {
      await update({ estimateMinutes: logForm.estim });
    }

    if (logForm.minutes > 0) {
      if (logForm.id) {
        await updateTimeLog(logForm.id, { spentMinutes: logForm.minutes, description: logForm.desc });
        const oldLog = timeLogs.find(l => l.id === logForm.id);
        const diff = logForm.minutes - (oldLog?.spentMinutes || 0);
        if (diff !== 0) await update({ spentMinutes: Math.max(0, spentMin + diff) });
        showToast('Запис оновлено ✓');
      } else {
        const uid = currentUser?.id || currentUser?.uid;
        await addTimeLog(issueId, projectId, uid, logForm.minutes, logForm.desc);
        await update({ spentMinutes: spentMin + logForm.minutes });
        showToast(`${logForm.minutes} хв списано ✓`);
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
      const nextSpent = Math.max(0, spentMin - log.spentMinutes);
      await update({ spentMinutes: nextSpent });
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
      const uploaded = [];
      for (const file of files) {
        const meta = await uploadFile(file, `organizations/${orgId}/attachments`);
        uploaded.push({
          id: makeAttachmentId(),
          ...meta, // { name, url, size, type }
          uploadedById: currentUser?.id || currentUser?.uid || '',
          uploadedByName: currentUser?.name || currentUser?.email || '',
          uploadedAt: nowMs(),
        });
      }
      await update({ attachments: [...(issue.attachments || []), ...uploaded] });
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
    if (!(await confirmDialog({ title: 'Видалити вкладення?', confirmText: 'Видалити', danger: true }))) return;
    await update({ attachments: (issue.attachments || []).filter(a => a.id !== id) });
  };

  const handleAddSubtask = async () => {
    if (!subtaskText.trim()) return;
    await update({ subtasks: [...(issue.subtasks || []), { title: subtaskText.trim(), done: false }] });
    setSubtaskText(''); setShowSubInput(false);
  };

  const handleToggleSubtask = async (i) => {
    const subs = [...(issue.subtasks || [])]; subs[i] = { ...subs[i], done: !subs[i].done };
    await update({ subtasks: subs });
  };

  const handleDeleteSubtask = async (index) => {
    if (!(await confirmDialog({
      title: 'Видалити це підзавдання?',
      confirmText: 'Видалити', danger: true,
    }))) return;
    const subs = (issue.subtasks || []).filter((_, idx) => idx !== index);
    await update({ subtasks: subs });
    showToast('Підзавдання видалено ✓');
  };

  const handleSaveSubtaskEdit = async (index) => {
    if (!editingSubtaskText.trim()) return;
    const subs = [...(issue.subtasks || [])];
    subs[index] = { ...subs[index], title: editingSubtaskText.trim() };
    await update({ subtasks: subs });
    setEditingSubtaskIndex(-1);
    setEditingSubtaskText('');
    showToast('Підзавдання оновлено ✓');
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({
      title: `Видалити ${issue.issueKey}?`,
      confirmText: 'Видалити', danger: true,
    }))) return;
    await deleteIssue(issueId);
    router.push(`/${projectId}`);
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isModal ? 'bg-white' : 'bg-transparent'}`}>
      {/* Lightbox */}
      {viewerMat && <MediaViewer mat={viewerMat} onClose={() => setViewerMat(null)} />}

      <div
        onScroll={event => setIsHeaderScrolled(event.currentTarget.scrollTop > 4)}
        className={`w-full page-gutter ${isModal ? 'pt-[8px] pb-[32px]' : 'pt-[56px] pb-0'} flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar`}
      >

        <div className={`grid grid-cols-1 gap-[20px] items-stretch ${isModal ? '' : 'lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] lg:flex-1 lg:min-h-0'}`}>

          {/* LEFT SIDE (Data) */}
          <div
            ref={leftScrollRef}
            onScroll={event => setIsHeaderScrolled(event.currentTarget.scrollTop > 4)}
            className={`flex flex-col overflow-visible ${isModal ? '' : 'custom-scrollbar lg:min-h-0 lg:overflow-y-auto lg:pr-2'}`}
          >
            <div
              className={`sticky ${isModal ? 'top-0' : 'top-[56px] lg:top-0'} z-[30]`}
            >

            {/* TITLE & ACTIONS */}
            <div className="flex w-full items-start justify-between gap-[16px] bg-white pb-[12px] pt-[12px]">
              <div className="flex flex-col gap-[4px] flex-1 min-w-0">
            {isEditing ? (
              <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="text-[24px] font-bold text-ink tracking-tight bg-transparent border-b-2 border-ink pb-1 outline-none w-full" placeholder="Назва завдання..." />
            ) : (
              <h1 className="text-[24px] font-bold text-ink tracking-tight leading-tight">{issue.title}</h1>
            )}
            
            {/* Metadata strip for non-editable details */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted font-medium mt-1.5">
              <Popover
                position="bottom"
                hideCloseIcon
                trigger={(
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 transition-colors hover:bg-[#f0f0f0]"
                  >
                    <span>Автор:</span>
                    <UserAvatar user={reporter} size={16} />
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
                  <div className="w-[180px] space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        const params = new URLSearchParams(searchParams.toString());
                        params.set('member', reporterMember.id || reporterMember.uid);
                        router.push(`${pathname}?${params.toString()}`);
                      }}
                      className="flex h-[32px] w-full items-center px-[10px] text-left text-[13px] font-medium text-ink transition-colors hover:bg-canvas"
                    >
                      Переглянути профіль
                    </button>
                    <Link
                      href={`/chat?dm=${encodeURIComponent(reporterMember.id || reporterMember.uid)}`}
                      onClick={close}
                      className="flex h-[32px] w-full items-center px-[10px] text-left text-[13px] font-medium text-ink transition-colors hover:bg-canvas"
                    >
                      Написати в чат
                    </Link>
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
                  <span className="text-[11px] font-bold text-[#ef4444] bg-red-50 px-2 py-[1px] rounded-full">Прострочено</span>
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
              <div className="relative" ref={actionsDropdownRef}>
                <Button 
                  style="secondary" 
                  size="icon-lg" 
                  icon={MoreHorizontal}
                  onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                  title="Опції"
                />
                {showActionsDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-[210px] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] py-[6px] z-50">
                    <button
                      onClick={() => {
                        copyIssueLink();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-ink hover:bg-canvas transition-colors text-left font-medium cursor-pointer"
                    >
                      <Copy size={13} className="text-muted" />
                      Копіювати посилання
                    </button>
                    <button
                      onClick={() => {
                        copyAiPrompt();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-ink hover:bg-canvas transition-colors text-left font-medium cursor-pointer"
                    >
                      <Sparkles size={13} className="text-muted" />
                      Скопіювати AI-промпт
                    </button>
                    {!isArchived && (
                      <>
                    <button
                      onClick={() => {
                        toggleWatch();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-ink hover:bg-canvas transition-colors text-left font-medium cursor-pointer"
                    >
                      {isWatching ? <EyeOff size={13} className="text-muted" /> : <Eye size={13} className="text-muted" />}
                      {isWatching ? 'Не стежити' : 'Стежити'}
                    </button>
                    <button
                      onClick={() => {
                        handleDelete();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-red-500 hover:bg-red-50 transition-colors text-left font-medium cursor-pointer"
                    >
                      <Trash2 size={13} className="text-red-400" />
                      Видалити
                    </button>
                      </>
                    )}
                  </div>
                )}
              </div>
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
              compact
              condensed={isHeaderScrolled}
              primaryClassName="grid w-full grid-cols-[repeat(3,minmax(0,1fr))_32px] items-center gap-1.5 overflow-visible sm:grid-cols-[repeat(5,minmax(0,1fr))_92px] [&>*]:min-w-0"
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
                    <Select compact disabled={isArchived} value={issue.columnId || issue.status || visibleStatuses[0]?.id} onChange={val => handleStatusChange(val)} options={visibleStatuses.map(s => ({ value: s.id, label: s.label, dotColor: s.color }))} buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[10px] bg-transparent px-0 text-[13px] font-medium leading-[22px]" />
                  </div>

                  {/* Assignee */}
                  <div className={attributeItemClass} onClick={e => { if (isArchived) return; if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className={attributeLabelClass}>Виконавець</span>
                    <Select compact disabled={isArchived} value={issue.assigneeIds?.[0] || ''} onChange={val => toggleAssignee(val)} options={[{ value: '', label: 'Не призначено' }, ...members.map(m => ({ value: m.id || m.uid, label: m.name, avatar: m.avatar }))]} buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[10px] bg-transparent px-0 text-[13px] font-medium leading-[22px]" />
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
                      buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[10px] bg-transparent px-0 text-[13px] font-medium leading-[22px]"
                    />
                  </div>

                  {/* Due date */}
                  <div className={`max-sm:hidden ${attributeItemClass}`}>
                    <span className={attributeLabelClass}>Дедлайн</span>
                    <DatePicker 
                      disabled={isArchived}
                      hideIcon 
                      inputClassName={`m-0 h-[22px] w-full cursor-pointer bg-transparent p-0 text-[13px] font-medium leading-[22px] outline-none placeholder:font-medium placeholder:text-faint placeholder:opacity-100 ${isOverdue ? 'text-[#ef4444]' : dueStr ? 'text-ink' : 'text-faint'}`}
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
                  <div className="relative flex h-full items-center" ref={detailsDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDetailsDropdown(value => !value)}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-bold transition-[height,background-color,color] duration-200 max-sm:px-0 ${isHeaderScrolled ? 'h-[28px]' : 'h-[42px]'} ${showDetailsDropdown ? 'bg-white text-ink' : 'text-muted hover:bg-[#ebebeb] hover:text-ink'}`}
                      aria-expanded={showDetailsDropdown}
                      aria-label="Деталі завдання"
                      title={`Пріоритет: ${PRIORITIES.find(item => item.id === issue.priority)?.label || 'не вказано'} · Тип: ${TYPES.find(item => item.id === issue.type)?.label || 'не вказано'}`}
                    >
                      <Settings2 size={14} />
                      <span className="max-sm:hidden">Деталі</span>
                    </button>
                    {showDetailsDropdown && (
                      <div className="absolute right-0 top-full z-[120] mt-2 flex w-[280px] flex-col gap-4 rounded-[12px] border border-line bg-white p-4 shadow-[0_14px_36px_rgba(0,0,0,0.12)] max-sm:fixed max-sm:bottom-[76px] max-sm:left-4 max-sm:right-4 max-sm:top-auto max-sm:w-auto">
                        <div className="flex flex-col gap-1.5 sm:hidden">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Спринт</span>
                          <Select
                            disabled={isArchived}
                            value={issue.sprintId || ''}
                            onChange={val => update({ sprintId: val || null })}
                            options={[{ value: '', label: 'Беклог (без спринта)' }, ...sprints.map(item => ({ value: item.id, label: item.name }))]}
                            buttonClassName="h-[36px] w-full rounded-[10px] bg-canvas px-3 text-[13px] font-medium"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 sm:hidden">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Дедлайн</span>
                          <DatePicker
                            disabled={isArchived}
                            inputClassName={`h-[36px] w-full rounded-[10px] bg-canvas px-3 text-[13px] font-medium outline-none cursor-pointer ${isOverdue ? 'text-[#ef4444]' : dueStr ? 'text-ink' : 'text-faint'}`}
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
                            buttonClassName="h-[36px] w-full rounded-[10px] bg-canvas px-3 text-[13px] font-medium"
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
                            options={TYPES.map(item => ({ value: item.id, label: item.label, dotColor: item.color }))}
                            buttonClassName="h-[36px] w-full rounded-[10px] bg-canvas px-3 text-[13px] font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              }
            />
            </div>
            </div>

            {/* LOG TIME FORM MODAL */}
            {logForm && (
              <div className="fixed inset-0 z-[100] flex items-end justify-end bg-black/40 backdrop-blur-sm" onClick={() => setLogForm(null)}>
                <div className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:h-full sm:w-[560px] sm:rounded-none" onClick={event => event.stopPropagation()}>
                  <div className="px-5 sm:px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
                    <h3 className="text-[16px] font-bold text-ink">Трекінг часу</h3>
                    <Button style="secondary" size="icon" icon={X} onClick={() => setLogForm(null)} aria-label="Закрити" />
                  </div>
                  
                  <div className="custom-scrollbar overflow-y-auto p-5 sm:p-6 flex flex-col gap-5">
                  <div className="flex gap-1 rounded-[10px] bg-canvas p-1">
                    <button onClick={() => setLogTab('spend')} className={`flex-1 rounded-[8px] px-3 py-2 text-[12px] font-bold transition-colors ${logTab === 'spend' ? 'bg-white text-ink' : 'text-muted hover:text-ink'}`}>Списати час</button>
                    {!logForm.id && (
                      <button onClick={() => setLogTab('estim')} className={`flex-1 rounded-[8px] px-3 py-2 text-[12px] font-bold transition-colors ${logTab === 'estim' ? 'bg-white text-ink' : 'text-muted hover:text-ink'}`}>Оцінка часу</button>
                    )}
                  </div>
                  
                  {logTab === 'spend' ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Списати час</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input type="number" min="0" placeholder="0" value={Math.floor(logForm.minutes / 60) || ''} onChange={e => {
                               const hrs = parseInt(e.target.value) || 0;
                               const mins = logForm.minutes % 60;
                               setLogForm(f => ({ ...f, minutes: hrs * 60 + mins }));
                            }} className="w-full text-[15px] font-bold bg-white rounded-[10px] pl-4 pr-8 py-[10px] outline-none border border-line focus:border-[#a8a8a8] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">год</span>
                          </div>
                          <div className="relative flex-1">
                            <input type="number" min="0" max="59" placeholder="0" value={logForm.minutes % 60 || ''} onChange={e => {
                               const mins = parseInt(e.target.value) || 0;
                               const hrs = Math.floor(logForm.minutes / 60);
                               setLogForm(f => ({ ...f, minutes: hrs * 60 + Math.min(mins, 59) }));
                            }} className="w-full text-[15px] font-bold bg-white rounded-[10px] pl-4 pr-7 py-[10px] outline-none border border-line focus:border-[#a8a8a8] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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
                            <input type="number" min="0" placeholder="0" value={Math.floor((logForm.estim || 0) / 60) || ''} onChange={e => {
                               const hrs = parseInt(e.target.value) || 0;
                               const mins = (logForm.estim || 0) % 60;
                               setLogForm(f => ({ ...f, estim: hrs * 60 + mins }));
                            }} className="w-full text-[15px] font-bold bg-white rounded-[10px] pl-4 pr-8 py-[10px] outline-none border border-line focus:border-[#a8a8a8] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">год</span>
                          </div>
                          <div className="relative flex-1">
                            <input type="number" min="0" max="59" placeholder="0" value={(logForm.estim || 0) % 60 || ''} onChange={e => {
                               const mins = parseInt(e.target.value) || 0;
                               const hrs = Math.floor((logForm.estim || 0) / 60);
                               setLogForm(f => ({ ...f, estim: hrs * 60 + Math.min(mins, 59) }));
                            }} className="w-full text-[15px] font-bold bg-white rounded-[10px] pl-4 pr-7 py-[10px] outline-none border border-line focus:border-[#a8a8a8] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">хв</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {logTab === 'spend' && (
                    <div>
                      <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Опис (необовʼязково)</p>
                      <input type="text" placeholder="Що було зроблено?" value={logForm.desc} onChange={e => setLogForm(f => ({ ...f, desc: e.target.value }))} className="w-full text-[14px] bg-white rounded-[10px] px-4 py-[10px] outline-none border border-line focus:border-[#a8a8a8] transition-colors" />
                    </div>
                  )}
                  
                  <div className="flex gap-3 justify-end mt-2">
                    <Button style="secondary" size="md" onClick={() => setLogForm(null)}>Скасувати</Button>
                    <Button style="primary" size="md" onClick={handleLogTime}>{logForm.id ? 'Зберегти зміни' : 'Зберегти'}</Button>
                  </div>

                  <div className="border-t border-line pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-[13px] font-bold text-ink">Журнал часу</h4>
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
                          <div key={log.id} className="group flex items-start gap-3 rounded-[10px] bg-canvas px-3 py-2.5">
                            <UserAvatar user={logMember} size={24} className="mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[12px] font-bold text-ink">{logMember?.name || 'Невідомий'}</span>
                                <span className="rounded-[6px] bg-white px-2 py-0.5 text-[11px] font-bold text-ink">{fmtMin(log.spentMinutes)}</span>
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
                  </div>
                </div>
              </div>
            )}

            {/* MAIN SECTIONS PANEL */}
            <div className="mt-1 flex w-full flex-col gap-5">
              <div className="flex flex-col gap-5 overflow-visible">
              {/* DESCRIPTION */}
              <div className="flex flex-col gap-6 py-1">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-[14px] font-bold text-ink">Опис</h2>
                  </div>
                  {isEditing ? (
                    <MarkdownEditor
                      value={draft.description}
                      onChange={description => setDraft(d => ({ ...d, description }))}
                      onUploadFiles={handleUploadAttachments}
                      uploading={uploadingAttach}
                      placeholder="Додай детальний опис завдання..."
                      minHeight="320px"
                    />
                  ) : issue.description ? (
                    <div className="w-full rounded-[16px] bg-canvas px-4 py-3">
                      <MarkdownViewer
                        content={issue.description}
                        className="text-[15px] leading-7"
                        onTaskToggle={isArchived ? undefined : (taskLine, checked) => update({ description: setTaskChecked(issue.description, taskLine, checked) })}
                      />
                    </div>
                  ) : (
                    <button onClick={enterEdit} className="text-[13px] text-faint italic hover:text-muted transition-colors text-left">
                      Натисни Редагувати щоб додати опис...
                    </button>
                  )}
                </div>

                {(issue.labelIds || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {(issue.labelIds || []).map(id => {
                      const label = availableLabels.find(item => item.id === id);
                      if (!label) return null;
                      return <Tag key={id} label={label.label || label.name} color={label.color} onRemove={() => update({ labelIds: (issue.labelIds || []).filter(item => item !== id) })} />;
                    })}
                  </div>
                )}

                {visibleAttachments.length > 0 && (
                  <div className="border-t border-[#eeeeee] pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Paperclip size={13} className="text-muted" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Вкладення</h3>
                      <span className="text-[11px] font-semibold text-faint">{visibleAttachments.length}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {visibleAttachments.map(attachment => {
                        const url = getMatFileUrl(attachment);
                        const fileType = detectFileType(attachment);
                        return (
                          <div key={attachment.id || url} className="group flex min-w-0 items-center gap-3 rounded-[8px] border border-transparent px-2 py-2 hover:border-[#d7d7d7] hover:bg-[#fafafa]">
                            <button type="button" onClick={() => setViewerMat(attachment)} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-canvas">
                              {fileType === 'image' && url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              ) : <FileText size={16} className="text-muted" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-semibold text-ink">{attachment.name}</p>
                              <p className="text-[10px] text-faint">{fmtBytes(attachment.size)}</p>
                            </div>
                            {isEditing && url && (
                              <Button
                                style="ghost"
                                size="sm"
                                onClick={() => {
                                  const markdown = fileType === 'image' ? `![${attachment.name}](${url})` : `[${attachment.name}](${url})`;
                                  setDraft(current => ({ ...current, description: `${current.description || ''}${current.description ? '\n\n' : ''}${markdown}` }));
                                }}
                              >
                                Вставити в опис
                              </Button>
                            )}
                            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-faint hover:text-ink" aria-label={`Відкрити ${attachment.name}`}><ExternalLink size={14} /></a>}
                            {!isArchived && <button type="button" onClick={() => handleDeleteAttachment(attachment.id)} className="p-2 text-faint hover:text-red-500" aria-label={`Видалити ${attachment.name}`}><Trash2 size={14} /></button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isArchived && (
                  <div className="relative flex flex-nowrap items-center gap-1.5 mb-[24px]">
                    <button aria-label="Додати мітку" onClick={() => setShowLabelDropdown(value => !value)} className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-canvas px-2.5 py-1.5 text-[11px] font-bold text-muted transition-colors hover:bg-line hover:text-ink">
                      <Plus size={11} /><span className="sm:hidden">Мітка</span><span className="hidden sm:inline">Додати мітку</span>
                    </button>
                    <button aria-label="Додати підзавдання" onClick={() => setShowSubInput(value => !value)} className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-canvas px-2.5 py-1.5 text-[11px] font-bold text-muted transition-colors hover:bg-line hover:text-ink">
                      <Plus size={11} /><span className="sm:hidden">Підзавдання</span><span className="hidden sm:inline">Додати підзавдання</span>
                    </button>
                    <button onClick={() => {
                      setShowLinkInput(value => !value);
                      const availableIssues = issues.filter(item => item.id !== issueId);
                      if (availableIssues.length > 0) setLinkTargetId(availableIssues[0].id);
                    }} aria-label="Додати зв’язок" className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-canvas px-2.5 py-1.5 text-[11px] font-bold text-muted transition-colors hover:bg-line hover:text-ink">
                      <Plus size={11} /><span className="sm:hidden">Зв’язок</span><span className="hidden sm:inline">Додати зв’язок</span>
                    </button>

                    {showLabelDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowLabelDropdown(false)} />
                        <div className="absolute left-0 top-full z-20 mt-1 w-[200px] rounded-[12px] border border-line bg-white py-2 shadow-lg">
                          {availableLabels.length === 0 && <p className="px-4 py-2 text-[12px] text-muted">Немає доступних міток</p>}
                          {availableLabels.map(label => {
                            const active = (issue.labelIds || []).includes(label.id);
                            return (
                              <button
                                key={label.id}
                                onClick={() => {
                                  const current = issue.labelIds || [];
                                  update({ labelIds: active ? current.filter(id => id !== label.id) : [...current, label.id] });
                                  setShowLabelDropdown(false);
                                }}
                                aria-pressed={active}
                                className="flex w-full items-center px-4 py-2 text-left text-[12px] transition-colors hover:bg-canvas"
                              >
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-[8px] px-[10px] py-[3px] text-[11px] font-medium ${active ? '' : 'bg-ink/5 text-[#404040]'}`}
                                  style={active ? { background: `${label.color}14`, color: label.color } : undefined}
                                >
                                  <TagIcon size={10} className="shrink-0 opacity-70" />
                                  {label.label || label.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

              {/* SUBTASKS */}
              {(subtasksAll > 0 || showSubInput) && (
              <div className="mt-1">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[12px] font-bold text-ink">Підзавдання</h3>
                {subtasksAll > 0 && <span className="rounded-full bg-line px-2 py-[1px] text-[10px] font-bold text-ink">{subtasksDone}/{subtasksAll}</span>}
              </div>
              {subtasksAll > 0 && (
                <div className="h-[4px] bg-line rounded-full mb-4 overflow-hidden">
                  <div className="h-full bg-[#10b981] rounded-full transition-all" style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
                </div>
              )}
              <div className="flex flex-col gap-[6px]">
                 {(issue.subtasks || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-[9px] bg-canvas rounded-[10px] hover:bg-[#eeeeee] transition-colors group">
                    {editingSubtaskIndex === i ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          autoFocus
                          value={editingSubtaskText}
                          onChange={e => setEditingSubtaskText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveSubtaskEdit(i);
                            if (e.key === 'Escape') setEditingSubtaskIndex(-1);
                          }}
                          className="flex-1 text-[13px] h-[30px]"
                        />
                        <button
                          onClick={() => handleSaveSubtaskEdit(i)}
                          className="text-green-500 hover:text-green-600 p-1"
                          title="Зберегти"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingSubtaskIndex(-1)}
                          className="text-muted hover:text-ink p-1"
                          title="Скасувати"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          disabled={isArchived}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSubtask(i);
                          }}
                          className="text-faint hover:text-muted transition-colors shrink-0"
                        >
                          {s.done ? <CheckSquare size={16} className="text-[#10b981]" /> : <Square size={16} />}
                        </button>
                        <span
                          className={`text-[13px] font-medium flex-1 ${s.done ? 'line-through text-faint' : 'text-ink'} ${!isArchived ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (isArchived) return;
                            setEditingSubtaskIndex(i);
                            setEditingSubtaskText(s.title);
                          }}
                          title={!isArchived ? "Натисніть для редагування" : ""}
                        >
                          {s.title}
                        </span>
                        
                        {!isArchived && (
                        <div className="flex items-center gap-1 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingSubtaskIndex(i);
                              setEditingSubtaskText(s.title);
                            }}
                            className="text-muted hover:text-ink p-1 rounded hover:bg-canvas transition-colors"
                            title="Редагувати"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubtask(i)}
                            className="text-faint hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Видалити"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {showSubInput && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      autoFocus
                      value={subtaskText}
                      onChange={e => setSubtaskText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowSubInput(false); setSubtaskText(''); } }}
                      placeholder="Що потрібно зробити?"
                    />
                    <Button style="primary" onClick={handleAddSubtask}>Додати</Button>
                    <Button style="secondary" size="icon-lg" icon={X} onClick={() => { setShowSubInput(false); setSubtaskText(''); }}>Закрити</Button>
                  </div>
                )}
              </div>
              </div>
              )}
            </div>

              {/* ISSUE LINKS */}
              {(currentIssueLinks.length > 0 || showLinkInput) && (
              <div className="mt-1 flex flex-col gap-3 px-1 sm:px-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[12px] font-bold text-ink">Зв’язки</h3>
                {currentIssueLinks.length > 0 && <span className="rounded-full bg-line px-2 py-[1px] text-[10px] font-bold text-ink">{currentIssueLinks.length}</span>}
              </div>

              <div className="flex flex-col gap-[6px]">
                {currentIssueLinks.map(l => {
                    const targetIssue = issues.find(i => i.id === l.targetIssueId);
                    if (!targetIssue) return null;
                    const relationLabel = RELATION_LABELS[l.relationType] || l.relationType;

                    return (
                      <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-[9px] bg-canvas rounded-[10px] hover:bg-[#eeeeee] transition-colors group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-bold bg-[#f3f4f6] text-[#4b5563] px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                            {relationLabel}
                          </span>
                          <Link
                            href={`/${projectId}/issue/${targetIssue.id}`}
                            className="text-[13px] font-semibold text-ink hover:underline truncate"
                          >
                            <span className="text-muted font-medium mr-1 uppercase">{targetIssue.issueKey}</span>
                            {targetIssue.title}
                          </Link>
                        </div>
                        {!isArchived && (
                        <button
                          onClick={async () => {
                            try {
                              await removeLink(l.id);
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
                  <div className="mt-2 flex flex-col gap-4 rounded-[12px] border border-line bg-white p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <div className="min-w-0">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Зв’язок</label>
                        <Select
                          value={linkRelation}
                          onChange={setLinkRelation}
                          className="w-full"
                          dropdownClassName="w-full max-w-none"
                          options={Object.entries(RELATION_LABELS).map(([value, label]) => ({
                            value,
                            label,
                          }))}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Завдання</label>
                        <Select
                          value={linkTargetId}
                          onChange={setLinkTargetId}
                          className="w-full"
                          dropdownClassName="w-full max-w-none"
                          disabled={issues.filter(item => item.id !== issueId).length === 0}
                          placeholder="Немає інших завдань у проєкті"
                          options={issues
                            .filter(item => item.id !== issueId)
                            .map(item => ({
                              value: item.id,
                              label: `${item.issueKey} — ${item.title}`,
                            }))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button style="secondary" size="sm" onClick={() => { setShowLinkInput(false); }}>Скасувати</Button>
                      <Button
                        style="primary"
                        size="sm"
                        disabled={!linkTargetId}
                        onClick={async () => {
                          if (!linkTargetId) return;
                          try {
                            await addLink(issueId, linkTargetId, linkRelation, currentUser?.uid || currentUser?.id);
                            showToast('Звʼязок додано');
                            setShowLinkInput(false);
                          } catch (err) {
                            showToast('Помилка: ' + err.message, 'error');
                          }
                        }}
                      >Додати зв’язок</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

              {/* TIME LOGS LIST */}
              {false && (
              <div className="bg-white rounded-[12px] p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-bold text-muted uppercase tracking-wider">Журнал часу</h2>
                  {timeLogs.length > 0 && (
                    <span className="text-[11px] font-bold bg-line text-ink px-2 py-[1px] rounded-full">
                      {timeLogs.length}
                    </span>
                  )}
                </div>
                {!isArchived && <Button style="secondary" size="sm" icon={Plus} onClick={() => setLogForm({ minutes: 0, desc: '' })}>Списати</Button>}
              </div>

              <div className="flex flex-col gap-[6px]">
                {timeLogs.slice(0, timeLogsPage * TIME_LOGS_PER_PAGE).map(log => {
                  const logMember = members.find(m => (m.id || m.uid) === log.userId);
                  const isLogAuthor = log.userId === currentUser?.uid || log.userId === currentUser?.id;
                  
                  return (
                    <div key={log.id} className="flex items-start justify-between gap-3 px-3 py-[9px] bg-white rounded-[10px] hover:bg-[#fafafa] transition-colors group">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <UserAvatar user={logMember} size={20} className="shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12px] font-semibold text-ink">
                              {logMember?.name || 'Невідомий'}
                            </span>
                            <span className="text-[11px] font-bold text-[#3b82f6] bg-[#eff6ff] px-1.5 py-0.5 rounded">
                              {fmtMin(log.spentMinutes)}
                            </span>
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
                  <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-white rounded-[10px] border border-dashed border-line">
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
                    <UnifiedTimeline issueId={issueId} projectId={projectId} isArchived={isArchived} org={activeOrg} members={members} />
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
