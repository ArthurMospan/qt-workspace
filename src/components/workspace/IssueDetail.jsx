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
import MarkdownEditor from '@/components/MarkdownEditor';
import UserAvatar from '@/components/UserAvatar';
import UnifiedTimeline from '@/components/workspace/UnifiedTimeline';

import { can } from '@/lib/utils/can';
import { Select } from '@/components/ui/Select';
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

// PRIORITIES and TYPES are now loaded dynamically via useWorkflowConfig.
// STATUSES stays static here because it carries bg/color for visual layout.
const STATUSES = [
  { id: 'backlog',         label: 'Backlog',         color: '#9a9a9a', bg: '#f5f5f5' },
  { id: 'todo',            label: 'To Do',           color: '#6366f1', bg: '#eef2ff' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2', bg: '#ecfeff' },
  { id: 'code-review',     label: 'Code Review',     color: '#d97706', bg: '#fffbeb' },
  { id: 'qa',              label: 'QA',              color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'client-approval', label: 'Client Approval', color: '#db2777', bg: '#fdf2f8' },
  { id: 'done',            label: 'Done',            color: '#10b981', bg: '#ecfdf5' },
];

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
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
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
      className="group w-full bg-white border border-[#f0f0f0] rounded-[14px] overflow-hidden text-left hover:border-[#d0d0d0] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] transition-all duration-200">
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
          <div className="bg-[#1f1f1f] rounded-[20px] px-8 py-10 flex flex-col items-center gap-4 min-w-[320px]">
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

export default function IssueDetail({ issueId, projectId, isModal, onClose }) {
  const router = useRouter();
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

  const { logs: timeLogs, addTimeLog } = useTimeLogs(issueId);
  const { comments, addComment }       = useComments(issueId);
  const { entries: auditLogs = [] }    = useAuditLog(issueId);

  const {
    types: rawTypes, priorities: rawPriorities,
  } = useWorkflowConfig();

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
  
  const [logForm,      setLogForm]      = useState(null);
  const [viewerMat,    setViewerMat]    = useState(null); // lightbox

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

  const typeCfg     = TYPES.find(t => t.id === (isEditing ? draft.type : issue.type))         || TYPES[2];
  const priorityCfg = PRIORITIES.find(p => p.id === (isEditing ? draft.priority : issue.priority)) || PRIORITIES[2];
  const statusCfg   = STATUSES.find(s => s.id === issue.columnId)                             || STATUSES[0];
  const TypeIcon    = typeCfg.icon;
  const PrioIcon    = priorityCfg.icon;

  const due       = issue.dueDate?.toDate ? issue.dueDate.toDate() : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';
  const dueStr    = due ? due.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

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
      storyPoints:     issue.storyPoints || null,
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
    if (draft.storyPoints     !== (issue.storyPoints || null)) patch.storyPoints = draft.storyPoints;
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

  const handleAddSubtask = async () => {
    if (!subtaskText.trim()) return;
    await update({ subtasks: [...(issue.subtasks || []), { title: subtaskText.trim(), done: false }] });
    setSubtaskText(''); setShowSubInput(false);
  };

  const handleToggleSubtask = async (i) => {
    const subs = [...(issue.subtasks || [])]; subs[i] = { ...subs[i], done: !subs[i].done };
    await update({ subtasks: subs });
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

      <div className="w-full px-[32px] pt-[8px] pb-[32px]">
        
        {/* TITLE & ACTIONS */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex flex-col gap-[4px] flex-1 min-w-0">
            {isEditing ? (
              <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} className="text-[22px] font-bold text-[#1f1f1f] bg-transparent border-b-2 border-[#1f1f1f] pb-1 outline-none w-full" placeholder="Назва задачі..." />
            ) : (
              <h1 className="text-[22px] font-bold text-[#1f1f1f] leading-tight">{issue.title}</h1>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-widest">{issue.issueKey}</span>
              {isOverdue && <span className="text-[11px] font-bold text-[#ef4444] bg-red-50 px-2 py-[1px] rounded-full">Прострочено</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {isEditing ? (
              <>
                <button onClick={cancelEdit} className="text-[13px] text-[#9a9a9a] hover:text-[#1f1f1f] px-3 py-[7px] font-semibold transition-all rounded-[8px] hover:bg-[#f0f0f0]">Скасувати</button>
                <button onClick={saveEdit} className="flex items-center gap-[6px] px-4 py-[8px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors"><Check size={13} /> Зберегти</button>
              </>
            ) : (
              <>
                <button onClick={enterEdit} className="flex items-center gap-[6px] px-4 py-[8px] text-[#1f1f1f] bg-[#f7f7f7] hover:bg-[#ebebeb] rounded-[10px] text-[13px] font-semibold transition-all">
                  <Pencil size={12} /> Редагувати
                </button>
                <button onClick={handleDelete} className="p-[9px] text-[#cfcfcf] hover:text-[#ef4444] bg-[#f7f7f7] hover:bg-red-50 rounded-[10px] transition-all" title="Видалити">
                  <Trash2 size={15} />
                </button>
              </>
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
            <div className="bg-[#f7f7f7] rounded-[14px] px-5 py-4 overflow-x-auto custom-scrollbar">
              <div className="flex items-stretch divide-x divide-[#e9e9e9] min-w-max">

                {/* Status */}
                <div className="flex flex-col gap-[4px] pr-5 min-w-[110px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Статус</span>
                  <Select value={issue.columnId} onChange={val => handleStatusChange(val)} options={STATUSES.map(s => ({ value: s.id, label: s.label }))} buttonClassName="bg-transparent hover:bg-[#ebebeb] rounded-[6px] px-0 h-[22px] font-semibold text-[13px] justify-start gap-1" />
                </div>

                {/* Assignee */}
                <div className="flex flex-col gap-[4px] px-5 min-w-[140px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Виконавець</span>
                  <Select value={issue.assigneeIds?.[0] || ''} onChange={val => toggleAssignee(val)} options={[{ value: '', label: 'Не призначено' }, ...members.map(m => ({ value: m.id || m.uid, label: m.name }))]} buttonClassName="bg-transparent hover:bg-[#ebebeb] rounded-[6px] px-0 h-[22px] font-semibold text-[13px] justify-start gap-1" />
                </div>

                {/* Sprint */}
                <div className="flex flex-col gap-[4px] px-5 min-w-[140px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Спринт</span>
                  <Select 
                    value={issue.sprintId || ''} 
                    onChange={val => update({ sprintId: val || null })} 
                    options={[
                      { value: '', label: 'Беклог (без спринта)' },
                      ...sprints.map(s => ({ value: s.id, label: s.name }))
                    ]} 
                    buttonClassName="bg-transparent hover:bg-[#ebebeb] rounded-[6px] px-0 h-[22px] font-semibold text-[13px] justify-start gap-1" 
                  />
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-[4px] px-5 min-w-[110px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Пріоритет</span>
                  {isEditing ? (
                    <Select value={draft.priority} onChange={val => setDraft(d => ({ ...d, priority: val }))} options={PRIORITIES.map(p => ({ value: p.id, label: p.label }))} buttonClassName="bg-transparent hover:bg-[#ebebeb] rounded-[6px] px-0 h-[22px] font-semibold text-[13px] justify-start gap-1" />
                  ) : (
                    <div className="flex items-center gap-[5px] h-[22px]">
                      <PrioIcon size={13} style={{ color: priorityCfg.color }} />
                      <span className="text-[13px] font-semibold" style={{ color: priorityCfg.color }}>{priorityCfg.label}</span>
                    </div>
                  )}
                </div>

                {/* Type */}
                <div className="flex flex-col gap-[4px] px-5 min-w-[100px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Тип</span>
                  {isEditing ? (
                    <Select value={draft.type} onChange={val => setDraft(d => ({ ...d, type: val }))} options={TYPES.map(t => ({ value: t.id, label: t.label }))} buttonClassName="bg-transparent hover:bg-[#ebebeb] rounded-[6px] px-0 h-[22px] font-semibold text-[13px] justify-start gap-1" />
                  ) : (
                    <div className="flex items-center gap-[5px] h-[22px]">
                      <TypeIcon size={13} style={{ color: typeCfg.color }} />
                      <span className="text-[13px] font-semibold" style={{ color: typeCfg.color }}>{typeCfg.label}</span>
                    </div>
                  )}
                </div>

                {/* Due date */}
                <div className="flex flex-col gap-[4px] px-5 min-w-[110px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Дедлайн</span>
                  {isEditing ? (
                    <input type="date" value={draft.dueDate || ''} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} className="text-[13px] font-semibold text-[#1f1f1f] bg-transparent outline-none h-[22px] w-full" />
                  ) : (
                    <span className={`text-[13px] font-semibold h-[22px] flex items-center ${isOverdue ? 'text-[#ef4444]' : dueStr ? 'text-[#1f1f1f]' : 'text-[#cfcfcf]'}`}>{dueStr || 'Не вказано'}</span>
                  )}
                </div>

                {/* Time + Timer */}
                <div className="flex flex-col gap-[4px] pl-5 min-w-[150px]">
                  <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Витрачено / Заплановано</span>
                  <div className="flex items-center gap-2 h-[22px]">
                    <span className="text-[13px] font-bold text-[#1f1f1f]">{fmtMin(spentMin)}</span>
                    {estimMin > 0 && <><span className="text-[12px] text-[#cfcfcf]">/</span><span className="text-[12px] font-semibold text-[#9a9a9a]">{fmtMin(estimMin)}</span></>}
                    <button onClick={handleTimerToggle} title={isTimerMine ? 'Зупинити' : 'Запустити таймер'} className={`ml-1 flex items-center justify-center w-[22px] h-[22px] rounded-[5px] transition-all shrink-0 ${isTimerMine ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-[#e9e9e9] text-[#1f1f1f] hover:bg-[#d9d9d9]'}`}>
                      {isTimerMine ? <StopIcon size={11} className="animate-pulse" /> : <Play size={11} />}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* LOG TIME FORM */}
            {logForm && (
              <div className="bg-[#f7f7f7] rounded-[14px] p-5">
                <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-4">Списати час</h2>
                <div className="flex gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Хвилини</p>
                    <input type="number" min="1" value={logForm.minutes} onChange={e => setLogForm(f => ({ ...f, minutes: parseInt(e.target.value) || 0 }))} className="w-[100px] text-[14px] font-bold bg-white rounded-[10px] px-3 py-2 outline-none border border-transparent focus:border-[#e9e9e9] transition-colors" />
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
                  <button onClick={() => setLogForm(null)} className="px-4 py-[7px] text-[#9a9a9a] font-semibold text-[12px] hover:text-[#1f1f1f] rounded-[8px] hover:bg-[#ebebeb] transition-colors">Скасувати</button>
                  <button onClick={handleLogTime} className="px-5 py-[7px] bg-[#1f1f1f] text-white rounded-[10px] text-[12px] font-bold hover:bg-[#303030] transition-colors">Зберегти лог</button>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            <div className="bg-[#f7f7f7] rounded-[14px] p-5">
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

            {/* SUBTASKS */}
            <div className="bg-[#f7f7f7] rounded-[14px] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Підзадачі</h2>
                  {subtasksAll > 0 && <span className="text-[11px] font-bold bg-[#e9e9e9] text-[#1f1f1f] px-2 py-[1px] rounded-full">{subtasksDone}/{subtasksAll}</span>}
                </div>
                <button onClick={() => setShowSubInput(v => !v)} className="flex items-center gap-1 text-[12px] font-semibold text-[#1f1f1f] bg-[#e9e9e9] hover:bg-[#d9d9d9] px-3 py-[5px] rounded-[8px] transition-colors">
                  <Plus size={13} /> Додати
                </button>
              </div>
              {subtasksAll > 0 && (
                <div className="h-[4px] bg-[#e9e9e9] rounded-full mb-4 overflow-hidden">
                  <div className="h-full bg-[#10b981] rounded-full transition-all" style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
                </div>
              )}
              <div className="flex flex-col gap-[6px]">
                {(issue.subtasks || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-[9px] bg-white rounded-[10px] cursor-pointer hover:bg-[#fafafa] transition-colors" onClick={() => handleToggleSubtask(i)}>
                    <span className="text-[#cfcfcf] hover:text-[#9a9a9a] transition-colors shrink-0">
                      {s.done ? <CheckSquare size={16} className="text-[#10b981]" /> : <Square size={16} />}
                    </span>
                    <span className={`text-[13px] font-medium flex-1 ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}>{s.title}</span>
                  </div>
                ))}
                {showSubInput && (
                  <div className="flex gap-2 mt-1">
                    <input autoFocus value={subtaskText} onChange={e => setSubtaskText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowSubInput(false); setSubtaskText(''); } }}
                      placeholder="Що потрібно зробити?"
                      className="flex-1 px-4 py-[9px] bg-white rounded-[10px] text-[13px] outline-none border border-transparent focus:border-[#e9e9e9] transition-colors"
                    />
                    <button onClick={handleAddSubtask} className="px-4 py-[9px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030]">Додати</button>
                    <button onClick={() => { setShowSubInput(false); setSubtaskText(''); }} className="px-3 text-[#9a9a9a] hover:text-[#1f1f1f] font-bold transition-colors">✕</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE — CHAT */}
          <div className="lg:col-span-1">
            <div className="bg-[#f7f7f7] rounded-[14px] overflow-hidden flex flex-col sticky top-[24px]" style={{ height: 'calc(100vh - 148px)', maxHeight: '720px' }}>
              <UnifiedTimeline issueId={issueId} projectId={projectId} onLogTime={() => setLogForm({ minutes: 0, desc: '', workType: 'development' })} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}