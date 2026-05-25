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
import { usePortalChat }       from '@/lib/hooks/usePortalIntegration';
import useWorkspaceStore       from '@/store/useWorkspaceStore';
import { sendNotification }    from '@/lib/hooks/useNotifications';
import UserAvatar              from '@/components/UserAvatar';
import {
  ArrowUp, ArrowDown, MessageSquare, Clock, History,
  CheckSquare, Square, Plus, Trash2, X,
  AlertOctagon, Minus, Zap, Bug, Star,
  ChevronRight, ChevronDown, PanelRightOpen, PanelRightClose,
  CheckCircle, XCircle, Play, Square as StopIcon, Layers,
  ExternalLink, FileText, Film, Music, Link2,
  Pencil, Check, Save, Eye,
  Send, ZoomIn, Maximize2,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────

const STATUSES = [
  { id: 'backlog',         label: 'Backlog',         color: '#9a9a9a', bg: '#f5f5f5' },
  { id: 'todo',            label: 'To Do',           color: '#6366f1', bg: '#eef2ff' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2', bg: '#ecfeff' },
  { id: 'code-review',     label: 'Code Review',     color: '#d97706', bg: '#fffbeb' },
  { id: 'qa',              label: 'QA',              color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'client-approval', label: 'Client Approval', color: '#db2777', bg: '#fdf2f8' },
  { id: 'done',            label: 'Done',            color: '#10b981', bg: '#ecfdf5' },
];
const PRIORITIES = [
  { id: 'blocker', label: 'Blocker', icon: AlertOctagon, color: '#dc2626' },
  { id: 'high',    label: 'High',    icon: ArrowUp,      color: '#f97316' },
  { id: 'medium',  label: 'Medium',  icon: Minus,        color: '#eab308' },
  { id: 'low',     label: 'Low',     icon: ArrowDown,    color: '#9a9a9a' },
];
const TYPES = [
  { id: 'epic',    label: 'Epic',    icon: Zap,         color: '#8b5cf6' },
  { id: 'feature', label: 'Feature', icon: Star,        color: '#0891b2' },
  { id: 'task',    label: 'Task',    icon: CheckSquare, color: '#059669' },
  { id: 'bug',     label: 'Bug',     icon: Bug,         color: '#dc2626' },
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

export default function IssuePage({ params }) {
  const { projectId, issueId } = use(params);
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

  const { logs: timeLogs, addTimeLog } = useTimeLogs(issueId);
  const { comments, addComment }       = useComments(issueId);
  const { logs: auditLogs }            = useAuditLog(issueId);

  // ── UI state ──────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('comments');
  const [commentText,  setCommentText]  = useState('');
  const [subtaskText,  setSubtaskText]  = useState('');
  const [showSubInput, setShowSubInput] = useState(false);
  const [portalOpen,   setPortalOpen]   = useState(false);
  const [logForm,      setLogForm]      = useState(null);
  const [viewerMat,    setViewerMat]    = useState(null); // lightbox

  // ── Edit mode state ───────────────────────────────────────────────
  const [isEditing,    setIsEditing]   = useState(false);
  // Local editable fields (draft while in edit mode)
  const [draft, setDraft] = useState({});

  const issue = issues.find(i => i.id === issueId);

  // ── Breadcrumbs ───────────────────────────────────────────────────
  useEffect(() => {
    if (!project || !issue) return;
    setBreadcrumbs([
      { label: project.name, href: `/workspace/${projectId}` },
      { label: issue.issueKey || 'Задача' },
      { label: issue.title, truncate: true },
    ]);
    return () => setBreadcrumbs([]);
  }, [project?.name, issue?.issueKey, issue?.title]); // eslint-disable-line

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
      dueDate:         due ? due.toISOString().split('T')[0] : '',
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
      if (result?.minutes > 0) setLogForm({ minutes: result.minutes, desc: '' });
    } else {
      if (activeTimer) { showToast('Зупини поточний таймер спочатку', 'error'); return; }
      startTimer(issueId);
    }
  };

  const handleLogTime = async () => {
    if (!logForm || logForm.minutes <= 0) { setLogForm(null); return; }
    const uid = currentUser?.id || currentUser?.uid;
    await addTimeLog(issueId, projectId, uid, logForm.minutes, logForm.desc);
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

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText('');
    await addComment(issueId, text, currentUser);
    const myUid = currentUser?.id || currentUser?.uid;
    const uids  = [...new Set([...(issue.assigneeIds || []), issue.reporterId].filter(u => u && u !== myUid))];
    await sendNotification({ userIds: uids, type: 'commented',
      title: `Коментар у ${issue.issueKey}`, body: text.slice(0, 120),
      link: `/workspace/${projectId}/issue/${issueId}`, issueId, projectId,
    }).catch(() => {});
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
    <div className="flex-1 flex overflow-hidden bg-white">

      {/* Lightbox */}
      {viewerMat && <MediaViewer mat={viewerMat} onClose={() => setViewerMat(null)} />}

      {/* ══════════════════════════════════════════
          LEFT PANEL — creative metadata sidebar
      ══════════════════════════════════════════ */}
      <aside className="w-[236px] shrink-0 flex flex-col overflow-hidden border-r border-[#f0f0f0] bg-[#fcfcfc]">

        {/* ── Top: Key + Nav + Edit toggle ── */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
          <button
            onClick={() => { navigator.clipboard.writeText(issue.issueKey); showToast(`${issue.issueKey} скопійовано`); }}
            className="font-mono text-[11px] font-bold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#efefef] px-[6px] py-[3px] rounded-[5px] transition-all"
            title="Копіювати ID"
          >
            {issue.issueKey}
          </button>

          <div className="ml-auto flex items-center gap-[4px]">
            {prev && <Link href={`/workspace/${projectId}/issue/${prev.id}`} title={prev.title}
              className="p-[4px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[5px] transition-all">
              <ArrowUp size={11} />
            </Link>}
            {next && <Link href={`/workspace/${projectId}/issue/${next.id}`} title={next.title}
              className="p-[4px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[5px] transition-all">
              <ArrowDown size={11} />
            </Link>}
            {/* Edit / Save button */}
            {isEditing ? (
              <div className="flex items-center gap-1 ml-1">
                <button onClick={saveEdit}
                  className="flex items-center gap-[3px] px-[7px] py-[4px] bg-[#1f1f1f] text-white rounded-[6px] text-[10px] font-bold hover:bg-[#303030] transition-colors">
                  <Check size={9} /> Зберегти
                </button>
                <button onClick={cancelEdit}
                  className="p-[4px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[5px] transition-all">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button onClick={enterEdit}
                className="flex items-center gap-[3px] px-[7px] py-[4px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] text-[10px] font-bold transition-all ml-1">
                <Pencil size={9} /> Ред.
              </button>
            )}
          </div>
        </div>

        {/* ── STATUS — hero element ── */}
        <div className="px-4 pb-3 shrink-0">
          <select
            value={issue.columnId}
            onChange={e => handleStatusChange(e.target.value)}
            className="w-full py-[8px] px-3 rounded-[11px] text-[12px] font-bold cursor-pointer border-none outline-none appearance-none"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4 min-h-0">

          {/* Type + Priority — 2 chip pills */}
          <div className="flex gap-2">
            <div className="flex-1">
              {isEditing ? (
                <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}
                  className="w-full appearance-none border-none outline-none text-[10px] font-bold cursor-pointer rounded-[8px] px-2 py-[6px]"
                  style={{ background: typeCfg.color + '18', color: typeCfg.color }}>
                  {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-[5px] px-2 py-[6px] rounded-[8px]"
                  style={{ background: typeCfg.color + '12' }}>
                  <TypeIcon size={11} style={{ color: typeCfg.color }} />
                  <span className="text-[10px] font-bold" style={{ color: typeCfg.color }}>{typeCfg.label}</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))}
                  className="w-full appearance-none border-none outline-none text-[10px] font-bold cursor-pointer rounded-[8px] px-2 py-[6px]"
                  style={{ background: priorityCfg.color + '18', color: priorityCfg.color }}>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-[5px] px-2 py-[6px] rounded-[8px]"
                  style={{ background: priorityCfg.color + '12' }}>
                  <PrioIcon size={11} style={{ color: priorityCfg.color }} />
                  <span className="text-[10px] font-bold" style={{ color: priorityCfg.color }}>{priorityCfg.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[7px]">
              Виконавці {assignees.length > 0 && `· ${assignees.length}`}
            </p>
            {/* Avatar stack */}
            {assignees.length > 0 && !isEditing && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-[6px]">
                  {assignees.slice(0, 4).map(m => (
                    <div key={m.id || m.uid} title={m.name || m.email}
                      className="ring-[2px] ring-white rounded-full">
                      <UserAvatar user={m} size={24} />
                    </div>
                  ))}
                  {assignees.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-[#f0f0f0] flex items-center justify-center text-[8px] font-bold text-[#9a9a9a] ring-[2px] ring-white">
                      +{assignees.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[#9a9a9a] truncate max-w-[80px]">
                  {assignees[0]?.name?.split(' ')[0]}
                  {assignees.length > 1 && ` +${assignees.length - 1}`}
                </span>
              </div>
            )}
            {/* Member list (always shown in edit, or if editing) */}
            {(isEditing || assignees.length === 0) && (
              <div className="flex flex-col gap-[2px]">
                {members.map(m => {
                  const uid    = m.id || m.uid;
                  const active = (issue.assigneeIds || []).includes(uid);
                  return (
                    <button key={uid} onClick={() => toggleAssignee(uid)}
                      className="flex items-center gap-[7px] px-2 py-[5px] rounded-[8px] transition-all text-left group"
                      style={{ background: active ? '#1f1f1f' : 'transparent', color: active ? '#fff' : '#9a9a9a' }}>
                      <UserAvatar user={m} size={20} className="shrink-0" />
                      <span className="flex-1 truncate text-[11px] font-medium leading-none">{m.name || m.email}</span>
                      {active
                        ? <span className="text-white/40 text-[9px] shrink-0">✓</span>
                        : <span className="text-[#e9e9e9] text-[9px] shrink-0 opacity-0 group-hover:opacity-100">+</span>
                      }
                    </button>
                  );
                })}
                {members.length === 0 && <p className="text-[11px] text-[#e9e9e9] px-2">Немає учасників</p>}
              </div>
            )}
          </div>

          {/* Due + Estimate — 2-col row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[5px]">Дедлайн</p>
              {isEditing ? (
                <input type="date" value={draft.dueDate || ''}
                  onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))}
                  className="w-full text-[10px] font-semibold bg-[#f5f5f5] rounded-[7px] px-2 py-[4px] outline-none border border-transparent focus:border-[#e9e9e9] cursor-pointer"
                />
              ) : (
                <div className={`text-[10px] font-semibold px-2 py-[4px] rounded-[7px] ${
                  isOverdue ? 'bg-red-50 text-red-600' : due ? 'bg-[#f5f5f5] text-[#1f1f1f]' : 'bg-[#f5f5f5] text-[#cfcfcf]'
                }`}>
                  {isOverdue && '⚠ '}{dueStr || '—'}
                </div>
              )}
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[5px]">Оцінка</p>
              {isEditing ? (
                <div className="flex items-center gap-1 bg-[#f5f5f5] rounded-[7px] px-2 py-[4px]">
                  <input type="number" min="0" step="0.5"
                    value={draft.estimateMinutes ? (draft.estimateMinutes / 60).toFixed(1).replace('.0', '') : ''}
                    onChange={e => setDraft(d => ({ ...d, estimateMinutes: Math.round(parseFloat(e.target.value || '0') * 60) }))}
                    placeholder="—"
                    className="w-full text-[10px] font-semibold bg-transparent outline-none text-[#1f1f1f]"
                  />
                  <span className="text-[8px] text-[#cfcfcf] shrink-0">г</span>
                </div>
              ) : (
                <div className="text-[10px] font-semibold px-2 py-[4px] rounded-[7px] bg-[#f5f5f5] text-[#1f1f1f]">
                  {estimMin ? fmtMin(estimMin) : '—'}
                </div>
              )}
            </div>
          </div>

          {/* Time tracking block */}
          <div className="bg-[#f7f7f7] rounded-[12px] p-3">
            {/* Progress */}
            {estimMin > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-[5px]">
                  <div className="flex items-center gap-2">
                    <Ring pct={timePct} color={timeColor} size={30} stroke={3} />
                    <div>
                      <p className="text-[11px] font-bold text-[#1f1f1f] leading-tight">{fmtMin(spentMin)}</p>
                      <p className="text-[8px] text-[#cfcfcf]">з {fmtMin(estimMin)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: timeColor }}>{timePct}%</span>
                </div>
                <div className="h-[3px] bg-[#e9e9e9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(timePct, 100)}%`, background: timeColor }} />
                </div>
              </div>
            )}
            {estimMin === 0 && spentMin > 0 && (
              <p className="text-[11px] font-semibold text-[#1f1f1f] mb-2">
                Витрачено: {fmtMin(spentMin)}
              </p>
            )}

            {/* Timer button */}
            <button onClick={handleTimerToggle}
              className={`flex items-center gap-2 w-full px-3 py-[7px] rounded-[9px] text-[11px] font-bold transition-all ${
                isTimerMine
                  ? 'bg-[#1f1f1f] text-white'
                  : 'bg-white text-[#1f1f1f] hover:bg-[#ebebeb] border border-[#e9e9e9]'
              }`}>
              {isTimerMine ? (
                <>
                  <StopIcon size={10} className="shrink-0 text-red-400 animate-pulse" />
                  <span className="font-mono">{formatElapsed(timerElapsed)}</span>
                  <span className="ml-auto text-white/40 text-[9px]">Зупинити</span>
                </>
              ) : (
                <>
                  <Play size={10} className="shrink-0" />
                  <span>Старт таймеру</span>
                  {spentMin > 0 && <span className="ml-auto text-[#cfcfcf] text-[9px]">{fmtMin(spentMin)}</span>}
                </>
              )}
            </button>

            {/* Log form after timer stops */}
            {logForm && (
              <div className="mt-2 bg-white border border-[#e9e9e9] rounded-[10px] p-3 flex flex-col gap-2">
                <p className="text-[9px] font-bold text-[#9a9a9a] uppercase">Списати час</p>
                <div className="flex items-center gap-1">
                  <input type="number" min="1"
                    value={logForm.minutes}
                    onChange={e => setLogForm(f => ({ ...f, minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full text-[11px] font-bold bg-[#f7f7f7] rounded-[6px] px-2 py-[4px] outline-none"
                  />
                  <span className="text-[9px] text-[#9a9a9a] shrink-0">хв</span>
                </div>
                <input type="text" placeholder="Опис (необов.)"
                  value={logForm.desc}
                  onChange={e => setLogForm(f => ({ ...f, desc: e.target.value }))}
                  className="text-[11px] bg-[#f7f7f7] rounded-[6px] px-2 py-[4px] outline-none w-full"
                />
                <div className="flex gap-2">
                  <button onClick={handleLogTime}
                    className="flex-1 py-[5px] bg-[#1f1f1f] text-white rounded-[7px] text-[10px] font-bold">
                    ✓ Зберегти
                  </button>
                  <button onClick={() => setLogForm(null)} className="px-3 py-[5px] text-[#9a9a9a] text-[10px] hover:text-[#1f1f1f]">✕</button>
                </div>
              </div>
            )}
          </div>

          {/* Reporter */}
          {reporter && (
            <div className="flex items-center gap-2">
              <UserAvatar user={reporter} size={18} className="shrink-0" />
              <div>
                <p className="text-[9px] text-[#cfcfcf] leading-none mb-[2px]">Автор</p>
                <p className="text-[10px] font-semibold text-[#4a4a4a]">{reporter.name}</p>
              </div>
            </div>
          )}

          {/* Created */}
          {issue.createdAt && (
            <p className="text-[9px] text-[#e9e9e9]">
              {issue.createdAt?.toDate?.()?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* ── Bottom: Delete ── */}
        <div className="px-4 pb-3 shrink-0 border-t border-[#f0f0f0] pt-2">
          <button onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-[6px] rounded-[8px] text-[10px] font-semibold text-[#cfcfcf] hover:bg-red-50 hover:text-red-500 transition-all">
            <Trash2 size={10} /> Видалити задачу
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-2 px-6 py-[9px] border-b border-[#f0f0f0] shrink-0">
          <span className="flex items-center gap-[4px] text-[10px] font-bold px-[7px] py-[3px] rounded-full"
            style={{ color: typeCfg.color, background: typeCfg.color + '14' }}>
            <TypeIcon size={10} />{typeCfg.label}
          </span>
          <ChevronRight size={10} className="text-[#e9e9e9]" />
          <span className="flex items-center gap-[3px] text-[10px] font-semibold" style={{ color: priorityCfg.color }}>
            <PrioIcon size={10} />{priorityCfg.label}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setPortalOpen(v => !v)}
              className={`flex items-center gap-[6px] px-3 py-[5px] rounded-[8px] text-[11px] font-semibold transition-all border ${
                portalOpen
                  ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                  : 'text-[#9a9a9a] border-[#e9e9e9] hover:border-[#9a9a9a] hover:text-[#1f1f1f]'
              }`}
            >
              {portalOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              Матеріали та чат
              {allMaterials.length > 0 && (
                <span className={`text-[8px] px-[5px] py-[1px] rounded-full font-bold ${
                  portalOpen ? 'bg-white/20 text-white' : 'bg-[#f0f0f0] text-[#9a9a9a]'
                }`}>{allMaterials.length}</span>
              )}
            </button>
            {prev && <Link href={`/workspace/${projectId}/issue/${prev.id}`} title={prev.title}
              className="p-[5px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[6px] transition-all ml-1">
              <ArrowUp size={12} />
            </Link>}
            {next && <Link href={`/workspace/${projectId}/issue/${next.id}`} title={next.title}
              className="p-[5px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[6px] transition-all">
              <ArrowDown size={12} />
            </Link>}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-7 pt-6 pb-12">

            {/* Edit mode banner */}
            {isEditing && (
              <div className="flex items-center justify-between bg-[#1f1f1f] text-white rounded-[12px] px-4 py-3 mb-5">
                <div className="flex items-center gap-2">
                  <Pencil size={13} />
                  <span className="text-[12px] font-semibold">Режим редагування</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={cancelEdit} className="text-[11px] text-white/50 hover:text-white px-3 py-[4px] rounded-[6px] hover:bg-white/10">
                    Скасувати
                  </button>
                  <button onClick={saveEdit} className="flex items-center gap-1 text-[11px] font-bold bg-white text-[#1f1f1f] px-4 py-[5px] rounded-[7px] hover:bg-[#f0f0f0]">
                    <Check size={11} /> Зберегти
                  </button>
                </div>
              </div>
            )}

            {/* Title */}
            {isEditing ? (
              <input
                autoFocus
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                className="w-full text-[22px] font-bold text-[#1f1f1f] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] px-3 py-2 mb-5 outline-none focus:border-[#1f1f1f]"
              />
            ) : (
              <h1 className="text-[22px] font-bold text-[#1f1f1f] mb-5 leading-snug">
                {issue.title}
              </h1>
            )}

            {/* Description */}
            <div className="mb-6">
              <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Опис</p>
              {isEditing ? (
                <textarea
                  value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="Додай опис..."
                  rows={5}
                  className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#e9e9e9] border border-[#e9e9e9] focus:border-[#1f1f1f] focus:outline-none resize-none leading-relaxed"
                />
              ) : (
                <div
                  className={`text-[13px] text-[#1f1f1f] leading-relaxed whitespace-pre-wrap ${!issue.description ? 'text-[#cfcfcf] italic' : ''}`}
                  onClick={enterEdit}
                >
                  {issue.description || 'Натисни "Ред." щоб додати опис...'}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">
                  Підзадачі{subtasksAll > 0 ? ` · ${subtasksDone}/${subtasksAll}` : ''}
                </p>
                <button onClick={() => setShowSubInput(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] px-2 py-[2px] rounded-[5px] hover:bg-[#f7f7f7]">
                  <Plus size={9} /> Додати
                </button>
              </div>
              {subtasksAll > 0 && (
                <div className="h-[2px] bg-[#f0f0f0] rounded-full mb-2 overflow-hidden">
                  <div className="h-full bg-[#10b981] rounded-full transition-all"
                    style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
                </div>
              )}
              {(issue.subtasks || []).map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-[5px] px-2 -mx-2 rounded-[7px] hover:bg-[#f7f7f7] transition-colors">
                  <button type="button" onClick={() => handleToggleSubtask(i)} className="shrink-0">
                    {s.done ? <CheckSquare size={14} className="text-[#10b981]" /> : <Square size={14} className="text-[#cfcfcf]" />}
                  </button>
                  <span className={`text-[13px] flex-1 ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}>{s.title}</span>
                </div>
              ))}
              {showSubInput && (
                <div className="flex gap-2 mt-2">
                  <input autoFocus value={subtaskText} onChange={e => setSubtaskText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowSubInput(false); setSubtaskText(''); } }}
                    placeholder="Нова підзадача..."
                    className="flex-1 px-3 py-[6px] bg-[#f7f7f7] rounded-[8px] text-[12px] border border-[#e9e9e9] focus:border-[#1f1f1f] focus:outline-none"
                  />
                  <button onClick={handleAddSubtask} className="px-3 py-[6px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold">✓</button>
                  <button onClick={() => { setShowSubInput(false); setSubtaskText(''); }} className="px-2 text-[#9a9a9a] text-[11px]">✕</button>
                </div>
              )}
            </div>

            {/* Activity tabs */}
            <div>
              <div className="flex border-b border-[#f0f0f0] mb-4">
                {[
                  { id: 'comments', label: 'Коментарі', icon: MessageSquare, count: comments.length },
                  { id: 'timelogs', label: 'Час',        icon: Clock,         count: timeLogs.length },
                  { id: 'history',  label: 'Активність', icon: History },
                ].map(({ id, label, icon: Icon, count }) => (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-[5px] px-4 py-[8px] text-[11px] font-semibold border-b-2 transition-all -mb-[1px] ${
                      activeTab === id ? 'border-[#1f1f1f] text-[#1f1f1f]' : 'border-transparent text-[#9a9a9a] hover:text-[#1f1f1f]'
                    }`}>
                    <Icon size={11} />{label}
                    {count > 0 && <span className="text-[8px] bg-[#f0f0f0] text-[#9a9a9a] px-[4px] py-[1px] rounded-full">{count}</span>}
                  </button>
                ))}
              </div>

              {/* COMMENTS */}
              {activeTab === 'comments' && (
                <div className="flex flex-col gap-4">
                  {comments.length === 0 && <p className="text-[12px] text-[#e9e9e9]">Коментарів поки немає</p>}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <UserAvatar user={{ name: c.authorName, avatar: c.authorAvatar }} size={28} className="shrink-0 mt-[2px]" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[12px] font-bold text-[#1f1f1f]">{c.authorName || 'Невідомо'}</span>
                          <span className="text-[9px] text-[#cfcfcf]">
                            {c.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3 text-[13px] text-[#1f1f1f] leading-relaxed whitespace-pre-wrap">{c.text}</div>
                      </div>
                    </div>
                  ))}
                  {/* Comment input */}
                  <div className="flex gap-3 pt-2 border-t border-[#f7f7f7]">
                    <UserAvatar user={currentUser} size={28} className="shrink-0 mt-[2px]" />
                    <div className="flex-1">
                      <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                        placeholder="Коментар... (Enter — відправити, Shift+Enter — новий рядок)" rows={2}
                        className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] placeholder-[#e9e9e9] border border-transparent focus:border-[#e9e9e9] focus:outline-none resize-none"
                      />
                      <div className="flex justify-end mt-1">
                        <button onClick={handleComment} disabled={!commentText.trim()}
                          className="flex items-center gap-1 px-4 py-[6px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold disabled:opacity-30 hover:bg-[#303030] transition-colors">
                          <Send size={11} /> Відправити
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TIME LOGS */}
              {activeTab === 'timelogs' && (
                <div>
                  {timeLogs.length === 0 && <p className="text-[12px] text-[#e9e9e9]">Час ще не списано</p>}
                  {timeLogs.map(log => {
                    const u = members.find(m => (m.id || m.uid) === log.userId);
                    return (
                      <div key={log.id} className="flex items-center gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
                        <UserAvatar user={u || { name: log.userId }} size={24} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-[#1f1f1f]">{fmtMin(log.spentMinutes)}</p>
                          {log.description && <p className="text-[11px] text-[#9a9a9a] truncate">{log.description}</p>}
                        </div>
                        <span className="text-[10px] text-[#cfcfcf]">{log.loggedAt?.toDate?.()?.toLocaleDateString('uk-UA')}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* HISTORY */}
              {activeTab === 'history' && (
                <div>
                  {auditLogs.length === 0 && <p className="text-[12px] text-[#e9e9e9]">Дій поки не було</p>}
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
                      <div className="w-[5px] h-[5px] rounded-full bg-[#e9e9e9] mt-[7px] shrink-0" />
                      <div>
                        <p className="text-[12px] text-[#1f1f1f]">
                          <span className="font-semibold">{log.userName || 'Система'}</span>{' '}
                          {log.action === 'moved' ? `→ ${log.to}` : log.action === 'created' ? 'створив(ла)' : log.action?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[9px] text-[#cfcfcf] mt-[2px]">
                          {log.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════
              RIGHT: Portal slide-in
          ══════════════════════════════ */}
          {portalOpen && (
            <div className="w-[310px] shrink-0 border-l border-[#f0f0f0] flex flex-col bg-[#fafafa] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#f0f0f0] bg-white shrink-0">
                <Layers size={13} className="text-[#9a9a9a]" />
                <span className="text-[12px] font-bold text-[#1f1f1f]">Матеріали та чат</span>
                <a href={PORTAL_URL} target="_blank" rel="noopener"
                  className="ml-auto text-[10px] text-[#6366f1] hover:underline font-semibold flex items-center gap-[2px]">
                  Відкрити <ExternalLink size={9} />
                </a>
                <button onClick={() => setPortalOpen(false)} className="text-[#cfcfcf] hover:text-[#1f1f1f] transition-colors ml-1">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">

                {/* ── MATERIALS ── */}
                <div className="px-4 pt-4 pb-2">
                  <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-3">
                    Матеріали {allMaterials.length > 0 && `(${allMaterials.length})`}
                  </p>
                  {allMaterials.length === 0 ? (
                    <p className="text-[11px] text-[#e9e9e9] py-2">Немає матеріалів у порталі</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {allMaterials.map((mat, i) => (
                        <MaterialCard
                          key={mat.id || i}
                          mat={mat}
                          onClick={() => {
                            const fileType = detectFileType(mat);
                            const fileUrl  = getMatFileUrl(mat);
                            // For external links, open directly
                            if (fileType === 'link' && mat.url) {
                              window.open(mat.url, '_blank');
                            } else if (fileUrl || fileType === 'note' || fileType === 'checklist') {
                              setViewerMat(mat);
                            } else {
                              window.open(PORTAL_URL, '_blank');
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── CHAT ── */}
                <div className="px-4 py-4 border-t border-[#f0f0f0] mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">
                      Чат клієнта {messages.length > 0 && `(${messages.length})`}
                    </p>
                    <a href={PORTAL_URL} target="_blank" rel="noopener"
                      className="text-[9px] text-[#6366f1] hover:underline font-semibold">
                      Відповісти →
                    </a>
                  </div>
                  {messages.length === 0 ? (
                    <div className="py-4 text-center">
                      <MessageSquare size={20} className="text-[#e9e9e9] mx-auto mb-2" />
                      <p className="text-[11px] text-[#cfcfcf]">Повідомлень немає</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[10px] max-h-[320px] overflow-y-auto">
                      {messages.map((msg, i) => {
                        const text    = msg.text || msg.message || msg.content || '';
                        const sender  = msg.senderName || msg.name || msg.authorName || 'Клієнт';
                        const ts      = msg.createdAt || msg.timestamp;
                        const isClient = !msg.isAdmin && !msg.isTeam;
                        return (
                          <div key={msg.id || i} className={`flex flex-col gap-[2px] ${isClient ? '' : 'items-end'}`}>
                            <div className="flex items-baseline gap-2">
                              <span className={`text-[10px] font-bold ${isClient ? 'text-[#1f1f1f]' : 'text-[#6366f1]'}`}>{sender}</span>
                              <span className="text-[8px] text-[#cfcfcf]">{timeAgo(ts)}</span>
                            </div>
                            <div className={`text-[11px] px-3 py-2 rounded-[10px] leading-relaxed max-w-[240px] ${
                              isClient
                                ? 'bg-[#f0f0f0] text-[#1f1f1f] rounded-tl-none'
                                : 'bg-[#6366f1] text-white rounded-tr-none'
                            }`}>
                              {text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
