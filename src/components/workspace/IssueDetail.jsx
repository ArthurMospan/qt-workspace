'use client';
// src/app/workspace/[projectId]/issue/[issueId]/page.js
import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext }        from '@/lib/context/AppContext';
import { useIssues }           from '@/lib/hooks/useIssues';
import { useTimeLogs }         from '@/lib/hooks/useTimeLogs';
import { useComments }         from '@/lib/hooks/useComments';
import { useAuditLog }         from '@/lib/hooks/useAuditLog';
import { useTeamMembers }      from '@/lib/hooks/useTeamMembers';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { useSprints } from '@/lib/hooks/useSprints';
import { usePortalChat }       from '@/lib/hooks/usePortalIntegration';
import { useWorkflowConfig }   from '@/lib/hooks/useWorkflowConfig';
import { useIssueLinks }       from '@/lib/hooks/useIssueLinks';
import MarkdownEditor from '@/components/MarkdownEditor';
import UserAvatar from '@/components/UserAvatar';
import Tag from '@/components/ui/DataDisplay/Tag';
import UnifiedTimeline from '@/components/workspace/UnifiedTimeline';
import { useLocalization } from '@/lib/hooks/useLocalization';

import { can } from '@/lib/utils/can';
import { Select } from '@/components/ui/Select';
import { TaskAttributesPanel } from '@/components/ui';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DEFAULT_PRIORITIES, DEFAULT_TYPES } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore       from '@/store/useWorkspaceStore';
import { sendNotification }    from '@/lib/hooks/useNotifications';
import {
  Heart, MessageSquare, Clock, History, PanelRightClose, PanelRightOpen, ArrowUp, ArrowDown, ExternalLink, X, Plus, Layers, Search, Settings2, Share2, Send, CheckSquare, Square, MoreHorizontal, Pencil, Check, Trash2, Paperclip, AlertOctagon, Minus, ChevronRight,
  Zap, Bug, Star,
  CheckCircle, XCircle, Play, Square as StopIcon,
  FileText, Film, Music, Link2,
  ZoomIn, Maximize2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, arrayRemove } from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';

// ── Constants ──────────────────────────────────────────────────────

// Statuses are now loaded dynamically via useWorkflowConfig.

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

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
  const url  = (mat.previewUrl || mat.url || '').toLowerCase();
  const src  = name || url;
  if (/\.(jpg|jpeg|png|gif|webp|svg|heic|bmp)/.test(src)) return 'image';
  if (/\.pdf/.test(src))                                    return 'pdf';
  if (/\.(mp4|mov|avi|webm|mkv)/.test(src))                return 'video';
  if (/\.(mp3|wav|m4a|ogg|aac)/.test(src))                 return 'audio';
  if (/^https?:\/\//.test(mat.url || '') && mat.type === 'link') return 'link';
  if (mat.type) return mat.type; // note, checklist, poll
  return 'file';
}

function getMatFileUrl(mat) {
  return mat.previewUrl || mat.url || mat.audioUrl || null;
}

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
        <img src={fileUrl} alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-[#cfcfcf] text-[10px]">Немає превʼю</div>'; }}
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
        <Music size={24} className="text-[#9a9a9a]" />
        <span className="text-[9px] font-bold text-[#9a9a9a] uppercase">AUDIO</span>
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
        <FileText size={24} className="text-[#cfcfcf]" />
        <span className="text-[9px] text-[#cfcfcf] uppercase">{name.split('.').pop()?.toUpperCase() || 'FILE'}</span>
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
          <p className="text-[12px] font-semibold text-[#1f1f1f] truncate leading-tight">{name}</p>
          {desc && <p className="text-[10px] text-[#cfcfcf] truncate mt-[1px]">{desc}</p>}
        </div>
        <ExternalLink size={11} className="text-[#cfcfcf] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
          <div className="bg-[#1f1f1f] rounded-[24px] px-8 py-10 flex flex-col items-center gap-4 min-w-[320px]">
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
            <p className="text-[14px] font-semibold text-[#1f1f1f]">{name}</p>
            <a href={mat.url} target="_blank" rel="noopener"
              className="flex items-center gap-2 px-6 py-3 bg-[#1f1f1f] text-white rounded-[10px] font-semibold text-[13px] hover:bg-[#303030]">
              <ExternalLink size={14} /> Перейти за посиланням
            </a>
          </div>
        )}
        {!fileUrl && fileType !== 'note' && fileType !== 'link' && fileType !== 'checklist' && (
          <div className="text-white text-center">
            <FileText size={48} className="mx-auto mb-3 text-white/40" />
            <p>Превʼю недоступне</p>
            <a href={PORTAL_URL} target="_blank" rel="noopener"
              className="text-[#6366f1] hover:underline text-[13px] mt-2 inline-block">Відкрити в порталі →</a>
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
  'subtask-of': 'Підзадача для'
};

export default function IssueDetail({ issueId, projectId, isModal, onClose }) {
  const router = useRouter();
  const { formatDate } = useLocalization();
  const { projects, currentUser } = useAppContext();
  const { issues, updateIssue, deleteIssue, moveIssue } = useIssues(projectId);

  const showToast      = useWorkspaceStore(s => s.showToast);
  const setBreadcrumbs = useWorkspaceStore(s => s.setBreadcrumbs);
  const startTimer     = useWorkspaceStore(s => s.startTimer);
  const stopTimer      = useWorkspaceStore(s => s.stopTimer);
  const activeTimer    = useWorkspaceStore(s => s.activeTimer);
  const timerElapsed   = useWorkspaceStore(s => s.timerElapsed);
  const formatElapsed  = useWorkspaceStore(s => s.formatElapsed);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const { stages }   = useStagesForProject(projectId);
  const { messages } = usePortalChat(projectId);
  const { sprints = [] } = useSprints();

  const { logs: timeLogs, addTimeLog, deleteTimeLog } = useTimeLogs(issueId);
  const { comments, addComment }       = useComments(issueId);
  const { entries: auditLogs = [] }    = useAuditLog(issueId);
  const { links = [], addLink, removeLink } = useIssueLinks(issueId);

  const {
    types: rawTypes, priorities: rawPriorities, statuses: STATUSES, labels: availableLabels = []
  } = useWorkflowConfig();

  const activeHiddenCols = project?.hiddenColumns || [];
  const visibleStatuses = STATUSES.filter(s => !activeHiddenCols.includes(s.id));

  // Build TYPES and PRIORITIES with icon mapping preserved
  const TYPES = rawTypes.map(t => ({
    ...t,
    icon: { epic: Zap, feature: Star, task: CheckSquare, bug: Bug }[t.id] || CheckSquare,
    color: t.color || { epic: '#8b5cf6', feature: '#0891b2', task: '#059669', bug: '#dc2626' }[t.id] || '#9a9a9a',
  }));
  const PRIORITIES = rawPriorities.map(p => ({
    ...p,
    icon: { blocker: AlertOctagon, high: ArrowUp, medium: Minus, low: ArrowDown }[p.id] || Minus,
    color: p.color || { blocker: '#dc2626', high: '#f97316', medium: '#eab308', low: '#9a9a9a' }[p.id] || '#9a9a9a',
  }));

  // ── UI state ──────────────────────────────────────────────────────
  const [showSubInput, setShowSubInput] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showReporterDropdown, setShowReporterDropdown] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkRelation, setLinkRelation] = useState('relates-to');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [editingSubtaskIndex, setEditingSubtaskIndex] = useState(-1);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  
  const actionsDropdownRef = useRef(null);
  const reporterDropdownRef = useRef(null);
  
  const [logForm,      setLogForm]      = useState(null);
  const [viewerMat,    setViewerMat]    = useState(null); // lightbox

  // Click outside handlers
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target)) {
        setShowActionsDropdown(false);
      }
      if (reporterDropdownRef.current && !reporterDropdownRef.current.contains(e.target)) {
        setShowReporterDropdown(false);
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

  // ── Breadcrumbs ───────────────────────────────────────────────────
  useEffect(() => {
    if (isModal) return;
    useWorkspaceStore.setState({
      breadcrumbs: [
        { label: 'Проєкти', href: '/workspace' },
        { label: project?.name || '...', href: `/workspace/${projectId}` },
        { label: issue?.issueKey || '...', href: null },
      ]
    });
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, [project?.name, issue?.issueKey, projectId, isModal]); // eslint-disable-line

  useEffect(() => {
    const fn = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (isEditing) { setIsEditing(false); return; }
        router.push(`/workspace/${projectId}`);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [router, projectId, isEditing]);

  if (!issue) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        {issues.length === 0
          ? <div className="w-7 h-7 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          : <div className="text-center">
              <p className="text-[16px] font-bold text-[#1f1f1f] mb-2">Задачу не знайдено</p>
              <Link href={`/workspace/${projectId}`} className="text-[13px] text-[#6366f1] hover:underline">← Повернутись</Link>
            </div>
        }
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

  const due       = issue.dueDate?.toDate ? issue.dueDate.toDate() : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';
  const dueStr    = due ? formatDate(due) : null;

  const assignees     = (issue.assigneeIds || []).map(uid => members.find(m => (m.id || m.uid) === uid)).filter(Boolean);
  const reporter      = members.find(m => (m.id || m.uid) === issue.reporterId);
  const subtasksDone  = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll   = (issue.subtasks || []).length;

  const spentMin  = issue.spentMinutes    || 0;
  const estimMin  = isEditing ? (draft.estimateMinutes ?? issue.estimateMinutes ?? 0) : (issue.estimateMinutes || 0);
  const timePct   = estimMin > 0 ? Math.round((spentMin / estimMin) * 100) : 0;
  const timeColor = timePct >= 100 ? '#dc2626' : timePct >= 75 ? '#f97316' : '#6366f1';

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
      dueDate:         due ? due.toISOString().split('T')[0] : '',
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
    const draftDue = draft.dueDate ? new Date(draft.dueDate) : null;
    const origDue  = due;
    if ((draftDue?.toISOString() || '') !== (origDue?.toISOString() || '')) {
      patch.dueDate = draft.dueDate || null;
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

  const handleComment = async () => {
    if (!commentText.trim() && !commentAttachment) return;
    try {
      setCommentUploading(true);
      let uploadedAttach = null;
      if (commentAttachment?.file) {
        uploadedAttach = await uploadFile(commentAttachment.file, `organizations/${project.organizationId}/attachments`);
      }
      await addComment(issueId, commentText, currentUser, uploadedAttach ? [uploadedAttach] : []);
      setCommentText('');
      setCommentAttachment(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCommentUploading(false);
    }
  };

  const handleStatusChange = async (s) => {
    try { await moveIssue(issueId, s, issue.order ?? 0, actor); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const toggleAssignee = async (uid) => {
    const cur  = issue.assigneeIds || [];
    const next = cur.includes(uid) ? cur.filter(a => a !== uid) : [...cur, uid];
    await update({ assigneeIds: next });
    if (!cur.includes(uid))
      await sendNotification({ userIds: [uid], type: 'assigned',
        title: `Вам призначено ${issue.issueKey}`, body: issue.title,
        link: `/workspace/${projectId}/issue/${issueId}`, issueId, projectId,
      }).catch(() => {});
  };

  const handleTimerToggle = async () => {
    if (isTimerMine) {
      const result = stopTimer();
      if (result?.minutes > 0) setLogForm({ minutes: result.minutes, desc: '', workType: 'development' });
    } else {
      if (activeTimer) { showToast('Зупини поточний таймер спочатку', 'error'); return; }
      startTimer(issueId);
    }
  };

  const handleLogTime = async () => {
    if (!logForm || logForm.minutes <= 0) { setLogForm(null); return; }
    const uid = currentUser?.id || currentUser?.uid;
    await addTimeLog(issueId, projectId, uid, logForm.minutes, logForm.desc, logForm.workType);
    await update({ spentMinutes: spentMin + logForm.minutes });
    showToast(`${logForm.minutes} хв списано ✓`);
    setLogForm(null);
  };

  const handleDeleteTimeLog = async (log) => {
    if (!confirm('Ви впевнені, що хочете видалити цей запис часу?')) return;
    try {
      await deleteTimeLog(log.id);
      const nextSpent = Math.max(0, spentMin - log.spentMinutes);
      await update({ spentMinutes: nextSpent });
      showToast('Запис часу видалено ✓');
    } catch (err) {
      showToast('Помилка видалення: ' + err.message, 'error');
    }
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
    if (!confirm('Видалити цю підзадачу?')) return;
    const subs = (issue.subtasks || []).filter((_, idx) => idx !== index);
    await update({ subtasks: subs });
    showToast('Підзадачу видалено ✓');
  };

  const handleSaveSubtaskEdit = async (index) => {
    if (!editingSubtaskText.trim()) return;
    const subs = [...(issue.subtasks || [])];
    subs[index] = { ...subs[index], title: editingSubtaskText.trim() };
    await update({ subtasks: subs });
    setEditingSubtaskIndex(-1);
    setEditingSubtaskText('');
    showToast('Підзадачу оновлено ✓');
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити ${issue.issueKey}?`)) return;
    await deleteIssue(issueId);
    router.push(`/workspace/${projectId}`);
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar ${isModal ? 'bg-white' : 'bg-transparent'}`}>
      {/* Lightbox */}
      {viewerMat && <MediaViewer mat={viewerMat} onClose={() => setViewerMat(null)} />}

      <div className={`w-full px-[24px] md:px-[32px] ${isModal ? 'pt-[8px]' : 'pt-[56px]'} pb-[32px]`}>
        
        {/* TITLE & ACTIONS */}
        <div className="flex items-center justify-between gap-[16px] w-full pt-[12px] pb-[12px] mb-5">
          <div className="flex flex-col gap-[4px] flex-1 min-w-0">
            {isEditing ? (
              <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="text-[24px] font-bold text-[#1f1f1f] tracking-tight bg-transparent border-b-2 border-[#1f1f1f] pb-1 outline-none w-full" placeholder="Назва задачі..." />
            ) : (
              <h1 className="text-[24px] font-bold text-[#1f1f1f] tracking-tight leading-tight">{issue.title}</h1>
            )}
            
            {/* Metadata strip for non-editable details */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[#9a9a9a] font-medium mt-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('Посилання на задачу скопійовано! ✓');
                }}
                className="font-bold text-[#1f1f1f] hover:text-[#6366f1] hover:underline uppercase tracking-widest transition-colors cursor-pointer"
                title="Копіювати посилання на задачу"
              >
                {issue.issueKey}
              </button>
              <span className="w-[3px] h-[3px] rounded-full bg-[#cfcfcf]" />
              
              {/* Clickable Reporter Dropdown */}
              <div className="relative" ref={reporterDropdownRef}>
                <button
                  onClick={() => setShowReporterDropdown(!showReporterDropdown)}
                  className="flex items-center gap-1.5 hover:bg-[#f0f0f0] px-1.5 py-0.5 rounded-[6px] transition-colors cursor-pointer"
                >
                  <span>Автор:</span>
                  <UserAvatar user={reporter} size={16} />
                  <span className="text-[#1f1f1f] font-semibold">{reporter?.name || 'Невідомо'}</span>
                </button>
                {showReporterDropdown && reporter && (
                  <div className="absolute left-0 top-full mt-1 w-[180px] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] py-[6px] z-50">
                    <Link
                      href={`/workspace/team/${reporter.id || reporter.uid}`}
                      onClick={() => setShowReporterDropdown(false)}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-[#1f1f1f] hover:bg-[#f4f4f5] transition-colors text-left font-medium"
                    >
                      Переглянути профіль
                    </Link>
                    <Link
                      href={`/workspace/chat?user=${reporter.id || reporter.uid}`}
                      onClick={() => setShowReporterDropdown(false)}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-[#1f1f1f] hover:bg-[#f4f4f5] transition-colors text-left font-medium"
                    >
                      Написати в чат
                    </Link>
                  </div>
                )}
              </div>
              <span className="w-[3px] h-[3px] rounded-full bg-[#cfcfcf]" />
              
              {/* Created relative time */}
              <div
                className="flex items-center gap-1 cursor-help"
                title={`Створено: ${issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleString('uk-UA') : issue.createdAt ? new Date(issue.createdAt).toLocaleString('uk-UA') : '—'}`}
              >
                <span>створили</span>
                <span className="text-[#1f1f1f] font-semibold">{timeAgo(issue.createdAt)}</span>
              </div>
              <span className="w-[3px] h-[3px] rounded-full bg-[#cfcfcf]" />
              
              {/* Updated relative time */}
              <div
                className="flex items-center gap-1 cursor-help"
                title={`Оновлено: ${(issue.updatedAt || issue.createdAt)?.toDate ? (issue.updatedAt || issue.createdAt).toDate().toLocaleString('uk-UA') : (issue.updatedAt || issue.createdAt) ? new Date(issue.updatedAt || issue.createdAt).toLocaleString('uk-UA') : '—'}`}
              >
                <span>оновили</span>
                <span className="text-[#1f1f1f] font-semibold">{timeAgo(issue.updatedAt || issue.createdAt)}</span>
              </div>
              
              {isOverdue && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-[#cfcfcf]" />
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
              <div className="relative" ref={actionsDropdownRef}>
                <Button 
                  style="secondary" 
                  size="icon" 
                  icon={MoreHorizontal}
                  onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                  className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px]"
                  title="Опції"
                />
                {showActionsDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-[160px] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] py-[6px] z-50">
                    <button
                      onClick={() => {
                        enterEdit();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-[12px] h-[32px] text-[13px] text-[#1f1f1f] hover:bg-[#f4f4f5] transition-colors text-left font-medium cursor-pointer"
                    >
                      <Pencil size={13} className="text-[#9a9a9a]" />
                      Редагувати
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
                  </div>
                )}
              </div>
            )}
            {isModal && onClose && (
              <button onClick={onClose} className="p-[9px] ml-2 text-[#9a9a9a] hover:text-[#1f1f1f] transition-all" title="Закрити">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
          
          {/* LEFT SIDE (Data) */}
          <div className="lg:col-span-2 flex flex-col gap-[16px]">
            
            {/* ATTRIBUTES STRIP */}
            <TaskAttributesPanel
              primaryChildren={
                <>
                  {/* Status */}
                  <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Статус</span>
                    <Select value={issue.columnId || issue.status || visibleStatuses[0]?.id} onChange={val => handleStatusChange(val)} options={visibleStatuses.map(s => ({ value: s.id, label: s.label, dotColor: s.color }))} buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" />
                  </div>

                  {/* Assignee */}
                  <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Виконавець</span>
                    <Select value={issue.assigneeIds?.[0] || ''} onChange={val => toggleAssignee(val)} options={[{ value: '', label: 'Не призначено' }, ...members.map(m => ({ value: m.id || m.uid, label: m.name }))]} buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" />
                  </div>

                  {/* Sprint */}
                  <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Спринт</span>
                    <Select 
                      value={issue.sprintId || ''} 
                      onChange={val => update({ sprintId: val || null })} 
                      options={[
                        { value: '', label: 'Беклог (без спринта)' },
                        ...sprints.map(s => ({ value: s.id, label: s.name }))
                      ]} 
                      buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" 
                    />
                  </div>

                  {/* Priority */}
                  <div className="flex flex-col gap-[4px] min-w-[110px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Пріоритет</span>
                    <Select
                      value={draft.priority || issue.priority || ''}
                      onChange={val => {
                        update({ priority: val });
                        if (isEditing) setDraft(d => ({ ...d, priority: val }));
                      }}
                      options={PRIORITIES.map(p => ({ value: p.id, label: p.label, dotColor: p.color }))}
                      buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full"
                    />
                  </div>

                  {/* Type */}
                  <div className="flex flex-col gap-[4px] min-w-[110px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Тип</span>
                    <Select
                      value={draft.type || issue.type || ''}
                      onChange={val => {
                        update({ type: val });
                        if (isEditing) setDraft(d => ({ ...d, type: val }));
                      }}
                      options={TYPES.map(t => ({ value: t.id, label: t.label, dotColor: t.color }))}
                      buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full"
                    />
                  </div>
                </>
              }
              secondaryChildren={
                <>
                  {/* Due date */}
                  <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors">
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Дедлайн</span>
                    {isEditing ? (
                      <input type="date" value={draft.dueDate || ''} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} className="text-[13px] font-medium text-[#1f1f1f] bg-transparent outline-none h-[22px] w-full" />
                    ) : (
                      <span className={`text-[13px] font-medium h-[22px] flex items-center ${isOverdue ? 'text-[#ef4444]' : dueStr ? 'text-[#1f1f1f]' : 'text-[#cfcfcf]'}`}>{dueStr || 'Не вказано'}</span>
                    )}
                  </div>

                  {/* Time + Timer */}
                  <div className="flex flex-col gap-[4px] min-w-[180px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors">
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Витрачено / Заплановано</span>
                    <div className="flex items-center gap-2 h-[22px]">
                      <span className="text-[13px] font-bold text-[#1f1f1f]">{fmtMin(spentMin)}</span>
                      {estimMin > 0 && <><span className="text-[12px] text-[#cfcfcf]">/</span><span className="text-[12px] font-semibold text-[#9a9a9a]">{fmtMin(estimMin)}</span></>}
                      <button onClick={handleTimerToggle} title={isTimerMine ? 'Зупинити' : 'Запустити таймер'} className={`ml-1 flex items-center justify-center w-[22px] h-[22px] rounded-[8px] transition-all shrink-0 ${isTimerMine ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-[#e9e9e9] text-[#1f1f1f] hover:bg-[#d9d9d9]'}`}>
                        {isTimerMine ? <StopIcon size={11} className="animate-pulse" /> : <Play size={11} />}
                      </button>
                    </div>
                  </div>
                </>
              }
            />

            {/* LOG TIME FORM */}
            {logForm && (
              <div className="bg-[#f4f4f5] rounded-[12px] p-5">
                <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-4">Списати час</h2>
                <div className="flex gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Хвилини</p>
                    <input type="number" min="1" value={logForm.minutes} onChange={e => setLogForm(f => ({ ...f, minutes: parseInt(e.target.value) || 0 }))} className="w-[100px] text-[14px] font-bold bg-white rounded-[8px] px-3 py-2 outline-none border border-transparent focus:border-[#e9e9e9] transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Тип робіт</p>
                    <Select value={logForm.workType || 'development'} onChange={val => setLogForm(f => ({ ...f, workType: val }))} options={[ { value: 'development', label: 'Development' }, { value: 'design', label: 'Design' }, { value: 'analytics', label: 'Analytics' }, { value: 'testing', label: 'Testing' }, { value: 'management', label: 'Management' } ]} />
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Опис (необовʼязково)</p>
                  <input type="text" placeholder="Що було зроблено?" value={logForm.desc} onChange={e => setLogForm(f => ({ ...f, desc: e.target.value }))} className="w-full text-[13px] bg-white rounded-[10px] px-3 py-2 outline-none border border-transparent focus:border-[#e9e9e9] transition-colors" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button style="secondary" size="sm" onClick={() => setLogForm(null)}>Скасувати</Button>
                  <Button style="primary" size="sm" onClick={handleLogTime}>Зберегти лог</Button>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            <div className="bg-[#f4f4f5] rounded-[12px] p-5 flex flex-col gap-5">
              <div>
                <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-4">Опис</h2>
                {isEditing ? (
                  <textarea
                    value={draft.description}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    placeholder="Додай детальний опис задачі..."
                    rows={7}
                    className="w-full px-4 py-3 bg-white rounded-[10px] text-[14px] text-[#1f1f1f] placeholder-[#cfcfcf] focus:outline-none resize-y leading-relaxed transition-colors border border-transparent focus:border-[#e9e9e9]"
                  />
                ) : issue.description ? (
                  <p className="text-[14px] text-[#1f1f1f] leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                ) : (
                  <button onClick={enterEdit} className="text-[13px] text-[#cfcfcf] italic hover:text-[#9a9a9a] transition-colors text-left">
                    Натисни Редагувати щоб додати опис...
                  </button>
                )}
              </div>

              {/* Labels (Мітки) Section inside Description card */}
              <div className="border-t border-[#e9e9e9] pt-4 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Мітки</span>
                <div className="flex flex-wrap gap-2 items-center relative">
                  {(issue.labelIds || []).map(id => {
                    const l = availableLabels.find(lbl => lbl.id === id);
                    if (!l) return null;
                    return (
                      <Tag
                        key={id}
                        label={l.label || l.name}
                        color={l.color}
                        onRemove={() => {
                          const current = issue.labelIds || [];
                          update({ labelIds: current.filter(x => x !== id) });
                        }}
                      />
                    );
                  })}
                  <button
                    onClick={() => setShowLabelDropdown(v => !v)}
                    className="flex items-center gap-1 px-[8px] py-[4px] rounded-full text-[11px] font-bold bg-white text-[#9a9a9a] border border-dashed border-[#cfcfcf] hover:border-[#9a9a9a] hover:text-[#1f1f1f] transition-all"
                  >
                    <Plus size={10} /> Додати мітку
                  </button>

                  {showLabelDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowLabelDropdown(false)} />
                      <div className="absolute bottom-full left-0 mb-1 w-[200px] bg-white border border-[#e9e9e9] rounded-[12px] shadow-lg z-20 py-2">
                        {availableLabels.length === 0 && (
                          <p className="px-4 py-2 text-[12px] text-[#9a9a9a]">Немає доступних міток</p>
                        )}
                        {availableLabels.map(l => {
                          const active = (issue.labelIds || []).includes(l.id);
                          return (
                            <button
                              key={l.id}
                              onClick={() => {
                                const current = issue.labelIds || [];
                                const newLabels = active ? current.filter(id => id !== l.id) : [...current, l.id];
                                update({ labelIds: newLabels });
                                setShowLabelDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#f4f4f5] transition-colors flex items-center justify-between ${active ? 'bg-[#f5f7ff] font-bold' : ''}`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                                {l.label || l.name}
                              </span>
                              {active && <CheckSquare size={12} className="text-[#6366f1]" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* SUBTASKS */}
            <div className="bg-[#f4f4f5] rounded-[12px] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Підзадачі</h2>
                  {subtasksAll > 0 && <span className="text-[11px] font-bold bg-[#e9e9e9] text-[#1f1f1f] px-2 py-[1px] rounded-full">{subtasksDone}/{subtasksAll}</span>}
                </div>
                <Button style="secondary" size="sm" icon={Plus} onClick={() => setShowSubInput(v => !v)}>Додати</Button>
              </div>
              {subtasksAll > 0 && (
                <div className="h-[4px] bg-[#e9e9e9] rounded-full mb-4 overflow-hidden">
                  <div className="h-full bg-[#10b981] rounded-full transition-all" style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
                </div>
              )}
              <div className="flex flex-col gap-[6px]">
                 {(issue.subtasks || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-[9px] bg-white rounded-[10px] hover:bg-[#fafafa] transition-colors group">
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
                          className="text-[#9a9a9a] hover:text-[#1f1f1f] p-1"
                          title="Скасувати"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSubtask(i);
                          }}
                          className="text-[#cfcfcf] hover:text-[#9a9a9a] transition-colors shrink-0"
                        >
                          {s.done ? <CheckSquare size={16} className="text-[#10b981]" /> : <Square size={16} />}
                        </button>
                        <span
                          className={`text-[13px] font-medium flex-1 cursor-text ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}
                          onDoubleClick={() => {
                            setEditingSubtaskIndex(i);
                            setEditingSubtaskText(s.title);
                          }}
                          title="Двічі клацніть, щоб редагувати"
                        >
                          {s.title}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingSubtaskIndex(i);
                              setEditingSubtaskText(s.title);
                            }}
                            className="text-[#cfcfcf] hover:text-[#1f1f1f] p-1 rounded hover:bg-[#f4f4f5] transition-colors"
                            title="Редагувати"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubtask(i)}
                            className="text-[#cfcfcf] hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Видалити"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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
                    <Button style="primary" size="sm" onClick={handleAddSubtask}>Додати</Button>
                    <Button style="secondary" size="icon" icon={X} onClick={() => { setShowSubInput(false); setSubtaskText(''); }}>Закрити</Button>
                  </div>
                )}
              </div>
            </div>

            {/* ISSUE LINKS */}
            <div className="bg-[#f4f4f5] rounded-[12px] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Зв'язки</h2>
                  {links.filter(l => l.sourceIssueId === issueId).length > 0 && (
                    <span className="text-[11px] font-bold bg-[#e9e9e9] text-[#1f1f1f] px-2 py-[1px] rounded-full">
                      {links.filter(l => l.sourceIssueId === issueId).length}
                    </span>
                  )}
                </div>
                <Button style="secondary" size="sm" icon={Plus} onClick={() => {
                  setShowLinkInput(v => !v);
                  const availableIssues = issues.filter(i => i.id !== issueId);
                  if (availableIssues.length > 0) {
                    setLinkTargetId(availableIssues[0].id);
                  }
                }}>Додати</Button>
              </div>

              <div className="flex flex-col gap-[6px]">
                {links
                  .filter(l => l.sourceIssueId === issueId)
                  .map(l => {
                    const targetIssue = issues.find(i => i.id === l.targetIssueId);
                    if (!targetIssue) return null;
                    const relationLabel = RELATION_LABELS[l.relationType] || l.relationType;

                    return (
                      <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-[9px] bg-white rounded-[10px] hover:bg-[#fafafa] transition-colors group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-bold bg-[#f3f4f6] text-[#4b5563] px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                            {relationLabel}
                          </span>
                          <Link
                            href={`/workspace/${projectId}/issue/${targetIssue.id}`}
                            className="text-[13px] font-semibold text-[#1f1f1f] hover:text-[#6366f1] hover:underline truncate"
                          >
                            <span className="text-[#9a9a9a] font-medium mr-1 uppercase">{targetIssue.issueKey}</span>
                            {targetIssue.title}
                          </Link>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await removeLink(l.id);
                              showToast('Звʼязок видалено');
                            } catch (err) {
                              showToast('Помилка видалення: ' + err.message, 'error');
                            }
                          }}
                          className="text-[#cfcfcf] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50"
                          title="Видалити зв'язок"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}

                {showLinkInput && (
                  <div className="flex flex-col gap-3 p-3 bg-white rounded-[10px] border border-[#e9e9e9] mt-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider block mb-1">Зв'язок</label>
                        <select
                          value={linkRelation}
                          onChange={e => setLinkRelation(e.target.value)}
                          className="w-full text-[13px] bg-white rounded-[8px] px-3 py-1.5 outline-none border border-[#e9e9e9] transition-colors font-medium text-[#1f1f1f]"
                        >
                          {Object.entries(RELATION_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-[2]">
                        <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider block mb-1">Задача</label>
                        <select
                          value={linkTargetId}
                          onChange={e => setLinkTargetId(e.target.value)}
                          className="w-full text-[13px] bg-white rounded-[8px] px-3 py-1.5 outline-none border border-[#e9e9e9] transition-colors font-medium text-[#1f1f1f]"
                        >
                          {issues
                            .filter(i => i.id !== issueId)
                            .map(i => (
                              <option key={i.id} value={i.id}>
                                {i.issueKey} — {i.title}
                              </option>
                            ))}
                          {issues.filter(i => i.id !== issueId).length === 0 && (
                            <option value="">Немає інших задач у проєкті</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
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
                      >Додати зв'язок</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TIME LOGS LIST */}
            <div className="bg-[#f4f4f5] rounded-[12px] p-5 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Журнал часу</h2>
                  {timeLogs.length > 0 && (
                    <span className="text-[11px] font-bold bg-[#e9e9e9] text-[#1f1f1f] px-2 py-[1px] rounded-full">
                      {timeLogs.length}
                    </span>
                  )}
                </div>
                <Button style="secondary" size="sm" icon={Plus} onClick={() => setLogForm({ minutes: 0, desc: '', workType: 'development' })}>Списати</Button>
              </div>

              <div className="flex flex-col gap-[6px]">
                {timeLogs.map(log => {
                  const logMember = members.find(m => (m.id || m.uid) === log.userId);
                  const isLogAuthor = log.userId === currentUser?.uid || log.userId === currentUser?.id;
                  
                  return (
                    <div key={log.id} className="flex items-start justify-between gap-3 px-3 py-[9px] bg-white rounded-[10px] hover:bg-[#fafafa] transition-colors group">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <UserAvatar user={logMember} size={20} className="shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12px] font-semibold text-[#1f1f1f]">
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
                            <span className="text-[10px] text-[#9a9a9a] uppercase font-bold tracking-wider">
                              {log.workType || 'Development'}
                            </span>
                            <span className="w-[3px] h-[3px] rounded-full bg-[#cfcfcf]" />
                            <span className="text-[10px] text-[#9a9a9a] font-medium">
                              {log.loggedAt?.toDate
                                ? formatDate(log.loggedAt.toDate())
                                : log.loggedAt
                                  ? formatDate(new Date(log.loggedAt))
                                  : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {isLogAuthor && (
                        <button
                          onClick={() => handleDeleteTimeLog(log)}
                          className="text-[#cfcfcf] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 shrink-0 self-center"
                          title="Видалити запис"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {timeLogs.length === 0 && (
                  <p className="text-[12px] text-[#cfcfcf] italic text-center py-2">Час ще не списували</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE — CHAT */}
          <div className="lg:col-span-1">
            <div className="bg-[#f4f4f5] rounded-[12px] overflow-hidden flex flex-col sticky top-[24px]" style={{ height: 'calc(100vh - 148px)', maxHeight: '720px' }}>
              <UnifiedTimeline issueId={issueId} projectId={projectId} onLogTime={() => setLogForm({ minutes: 0, desc: '', workType: 'development' })} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}