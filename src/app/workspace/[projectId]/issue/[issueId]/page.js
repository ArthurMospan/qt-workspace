'use client';
// src/app/workspace/[projectId]/issue/[issueId]/page.js
// Left panel: compact 2-col grid. Right slide-in: materials + portal chat.
import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext }    from '@/lib/context/AppContext';
import { useIssues }       from '@/lib/hooks/useIssues';
import { useTimeLogs }     from '@/lib/hooks/useTimeLogs';
import { useComments }     from '@/lib/hooks/useComments';
import { useAuditLog }     from '@/lib/hooks/useAuditLog';
import { useTeamMembers }  from '@/lib/hooks/useTeamMembers';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { usePortalChat }   from '@/lib/hooks/usePortalIntegration';
import useWorkspaceStore   from '@/store/useWorkspaceStore';
import { sendNotification } from '@/lib/hooks/useNotifications';
import TimeTracker         from '@/components/workspace/TimeTracker';
import UserAvatar          from '@/components/UserAvatar';
import {
  ArrowLeft, ArrowUp, ArrowDown, MessageSquare, Clock, History,
  CheckSquare, Square, Plus, Trash2, Link2, ExternalLink,
  AlertOctagon, Minus, Zap, Bug, Star, Calendar, ChevronRight,
  Layers, PanelRightOpen, PanelRightClose, CheckCircle, XCircle, AlertCircle, X,
} from 'lucide-react';

// ── Config ─────────────────────────────────────────────────────────

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
const MAT_STATUS = {
  approved: { label: 'OK',   color: '#10b981', Icon: CheckCircle },
  rejected: { label: 'Відм', color: '#ef4444', Icon: XCircle },
  pending:  { label: 'Чек',  color: '#f97316', Icon: Clock },
  none:     { label: '—',    color: '#cfcfcf', Icon: AlertCircle },
};

// ── Helpers ────────────────────────────────────────────────────────

function Ring({ pct, color, size = 44, stroke = 4.5 }) {
  const r   = (size - stroke * 2) / 2;
  const c   = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
    </svg>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'щойно';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// ── Page ─────────────────────────────────────────────────────────────

export default function IssuePage({ params }) {
  const { projectId, issueId } = use(params);
  const router = useRouter();
  const { projects, currentUser } = useAppContext();
  const { issues, updateIssue, deleteIssue, moveIssue } = useIssues(projectId);
  const showToast  = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  // Portal data for right panel
  const { stages }    = useStagesForProject(projectId);
  const { messages }  = usePortalChat(projectId);

  // Per-issue hooks
  const { logs: timeLogs, addTimeLog } = useTimeLogs(issueId);
  const { comments, addComment }       = useComments(issueId);
  const { logs: auditLogs }            = useAuditLog(issueId);

  // UI state
  const [activeTab,    setActiveTab]    = useState('comments');
  const [commentText,  setCommentText]  = useState('');
  const [subtaskText,  setSubtaskText]  = useState('');
  const [showSubInput, setShowSubInput] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal,     setTitleVal]     = useState('');
  const [portalOpen,   setPortalOpen]   = useState(false);
  const titleRef = useRef(null);

  useEffect(() => { if (editingTitle && titleRef.current) titleRef.current.focus(); }, [editingTitle]);
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') router.push(`/workspace/${projectId}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, projectId]);

  // ── Derived ─────────────────────────────────────────────────────

  const issue = issues.find(i => i.id === issueId);
  const sorted = [...issues].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx  = sorted.findIndex(i => i.id === issueId);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

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

  const typeCfg     = TYPES.find(t => t.id === issue.type)         || TYPES[2];
  const priorityCfg = PRIORITIES.find(p => p.id === issue.priority) || PRIORITIES[2];
  const statusCfg   = STATUSES.find(s => s.id === issue.columnId)   || STATUSES[0];
  const TypeIcon    = typeCfg.icon;
  const PrioIcon    = priorityCfg.icon;

  const due      = issue.dueDate?.toDate ? issue.dueDate.toDate() : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const reporter     = members.find(m => (m.id || m.uid) === issue.reporterId);
  const subtasksDone = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll  = (issue.subtasks || []).length;

  const spentMin  = issue.spentMinutes   || 0;
  const estimMin  = issue.estimateMinutes || 0;
  const timePct   = estimMin > 0 ? Math.round((spentMin / estimMin) * 100) : 0;
  const timeColor = timePct >= 100 ? '#dc2626' : timePct >= 75 ? '#f97316' : '#6366f1';

  const allMaterials = stages.flatMap(s => (s.materials || []).map(m => ({ ...m, stageName: s.title || s.name })));

  const actor = { userId: currentUser?.id || currentUser?.uid, userName: currentUser?.name };

  // ── Handlers ────────────────────────────────────────────────────

  const update = async (patch) => {
    try { await updateIssue(issueId, patch, actor); }
    catch (err) { showToast(err.message || 'Помилка', 'error'); }
  };

  const handleStatusChange = async (s) => {
    try { await moveIssue(issueId, s, issue.order ?? 0, actor); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleTitleSave = async () => {
    const v = titleVal.trim();
    if (v && v !== issue.title) await update({ title: v });
    setEditingTitle(false);
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

  const handleLogTime = async (minutes, description) => {
    await addTimeLog(issueId, projectId, currentUser?.id || currentUser?.uid, minutes, description);
    await update({ spentMinutes: spentMin + minutes });
    showToast(`${minutes} хв списано ✓`);
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити ${issue.issueKey}?`)) return;
    await deleteIssue(issueId);
    router.push(`/workspace/${projectId}`);
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="flex-1 flex overflow-hidden bg-white">

      {/* ═══════════════════════════════════════
          LEFT PANEL — compact 2-col metadata
      ═══════════════════════════════════════ */}
      <aside className="w-[230px] shrink-0 bg-[#fafafa] border-r border-[#f0f0f0] overflow-y-auto flex flex-col text-[12px]">

        {/* Back + key + nav */}
        <div className="px-3 pt-3 pb-3 border-b border-[#f0f0f0]">
          <div className="flex items-center justify-between mb-2">
            <Link href={`/workspace/${projectId}`}
              className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] font-medium transition-colors">
              <ArrowLeft size={10} /> {project?.name || 'Дошка'}
            </Link>
            <div className="flex gap-[2px]">
              {prev && <Link href={`/workspace/${projectId}/issue/${prev.id}`} title={prev.title}
                className="p-[3px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[4px] transition-all">
                <ArrowUp size={11} />
              </Link>}
              {next && <Link href={`/workspace/${projectId}/issue/${next.id}`} title={next.title}
                className="p-[3px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[4px] transition-all">
                <ArrowDown size={11} />
              </Link>}
            </div>
          </div>

          {/* Issue key */}
          <button
            onClick={() => { navigator.clipboard.writeText(issue.issueKey); showToast(`${issue.issueKey} скопійовано`); }}
            className="font-mono text-[13px] font-bold text-[#1f1f1f] hover:bg-[#efefef] px-2 py-[2px] rounded-[5px] transition-all"
            title="Копіювати ID"
          >
            {issue.issueKey}
          </button>
        </div>

        {/* ── Status full-width ── */}
        <div className="px-3 py-3 border-b border-[#f0f0f0]">
          <div className="relative">
            <select
              value={issue.columnId}
              onChange={e => handleStatusChange(e.target.value)}
              className="w-full pl-7 pr-3 py-[8px] rounded-[10px] text-[11px] font-bold cursor-pointer border-none outline-none appearance-none text-center"
              style={{ background: statusCfg.bg, color: statusCfg.color }}
            >
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full pointer-events-none"
              style={{ background: statusCfg.color }} />
          </div>
        </div>

        {/* ── 2-col grid: Type + Priority ── */}
        <div className="grid grid-cols-2 divide-x divide-[#f0f0f0] border-b border-[#f0f0f0]">
          {/* Type */}
          <div className="p-3 flex flex-col gap-1">
            <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest">Тип</p>
            <div className="relative">
              <select value={issue.type || 'task'} onChange={e => update({ type: e.target.value })}
                className="w-full appearance-none border-none outline-none text-[10px] font-bold cursor-pointer rounded-[6px] px-2 py-[4px]"
                style={{ background: typeCfg.color + '18', color: typeCfg.color }}>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div className="p-3 flex flex-col gap-1">
            <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest">Пріоритет</p>
            <div className="relative">
              <select value={issue.priority || 'medium'} onChange={e => update({ priority: e.target.value })}
                className="w-full appearance-none border-none outline-none text-[10px] font-bold cursor-pointer rounded-[6px] px-2 py-[4px]"
                style={{ background: priorityCfg.color + '18', color: priorityCfg.color }}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Assignees ── */}
        <div className="px-3 py-3 border-b border-[#f0f0f0]">
          <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Виконавці</p>

          {/* Avatar row */}
          {assignees.length > 0 && (
            <div className="flex items-center gap-[3px] mb-2 flex-wrap">
              {assignees.map(m => (
                <button key={m.id || m.uid} onClick={() => toggleAssignee(m.id || m.uid)} title={`${m.name} (клік — зняти)`}>
                  <UserAvatar user={m} size={24} className="hover:opacity-75 ring-2 ring-white transition-all" />
                </button>
              ))}
            </div>
          )}

          {/* Member toggle buttons — compact */}
          <div className="flex flex-col gap-[2px]">
            {members.map(m => {
              const uid    = m.id || m.uid;
              const active = (issue.assigneeIds || []).includes(uid);
              return (
                <button key={uid} onClick={() => toggleAssignee(uid)}
                  className="flex items-center gap-2 px-2 py-[4px] rounded-[6px] transition-all text-[10px] text-left"
                  style={{ background: active ? '#1f1f1f' : 'transparent', color: active ? '#fff' : '#9a9a9a' }}>
                  <UserAvatar user={m} size={16} />
                  <span className="truncate">{m.name || m.email}</span>
                  {active && <span className="ml-auto opacity-50 text-[8px]">✓</span>}
                </button>
              );
            })}
            {members.length === 0 && <p className="text-[10px] text-[#e9e9e9]">Немає учасників</p>}
          </div>
        </div>

        {/* ── 2-col: Due date + Estimate ── */}
        <div className="grid grid-cols-2 divide-x divide-[#f0f0f0] border-b border-[#f0f0f0]">
          <div className="p-3 flex flex-col gap-1">
            <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest">Дедлайн</p>
            <input type="date"
              value={due ? due.toISOString().split('T')[0] : ''}
              onChange={e => update({ dueDate: e.target.value || null })}
              className="w-full text-[10px] font-semibold rounded-[6px] px-2 py-[4px] border-none outline-none cursor-pointer"
              style={{ background: isOverdue ? '#fef2f2' : '#f5f5f5', color: isOverdue ? '#dc2626' : '#1f1f1f' }}
            />
          </div>
          <div className="p-3 flex flex-col gap-1">
            <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest">Оцінка</p>
            <div className="flex items-center gap-1">
              <input type="number" min="0" step="0.5"
                value={estimMin ? (estimMin / 60).toFixed(1).replace('.0', '') : ''}
                onChange={e => update({ estimateMinutes: Math.round(parseFloat(e.target.value || '0') * 60) })}
                placeholder="—"
                className="w-full text-[10px] font-semibold bg-[#f5f5f5] rounded-[6px] px-2 py-[4px] outline-none text-[#1f1f1f]"
              />
              <span className="text-[8px] text-[#cfcfcf] shrink-0">г</span>
            </div>
          </div>
        </div>

        {/* ── Time: ring + spent ── */}
        <div className="px-3 py-3 border-b border-[#f0f0f0]">
          <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Час</p>

          {estimMin > 0 ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="relative shrink-0">
                <Ring pct={timePct} color={timeColor} size={44} stroke={4.5} />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
                  style={{ color: timeColor }}>{timePct}%</span>
              </div>
              <div>
                <p className="text-[12px] font-bold text-[#1f1f1f] leading-tight">
                  {Math.floor(spentMin / 60)}г {spentMin % 60 > 0 ? `${spentMin % 60}хв` : ''}
                </p>
                <p className="text-[9px] text-[#9a9a9a]">
                  з {Math.floor(estimMin / 60)}г {estimMin % 60 > 0 ? `${estimMin % 60}хв` : ''} оцінки
                </p>
              </div>
            </div>
          ) : spentMin > 0 ? (
            <p className="text-[11px] font-bold text-[#1f1f1f] mb-2">
              {Math.floor(spentMin / 60)}г {spentMin % 60}хв
            </p>
          ) : null}

          <TimeTracker issue={issue} userId={currentUser?.id || currentUser?.uid} onLogTime={handleLogTime} />
        </div>

        {/* ── Reporter ── */}
        {reporter && (
          <div className="px-3 py-3 border-b border-[#f0f0f0]">
            <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Автор</p>
            <div className="flex items-center gap-2">
              <UserAvatar user={reporter} size={20} />
              <span className="text-[10px] font-medium text-[#4a4a4a] truncate">{reporter.name}</span>
            </div>
          </div>
        )}

        {/* ── Created at + Delete ── */}
        <div className="mt-auto px-3 py-3 border-t border-[#f0f0f0]">
          {issue.createdAt && (
            <p className="text-[9px] text-[#e9e9e9] mb-3">
              {issue.createdAt?.toDate?.()?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          <button onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-[6px] rounded-[8px] text-[10px] font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-all">
            <Trash2 size={11} /> Видалити задачу
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════
          MAIN — title, desc, activity
      ═══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-2 px-7 py-[9px] border-b border-[#f0f0f0] shrink-0 bg-white">
          {/* Type + key breadcrumb */}
          <span className="flex items-center gap-[4px] text-[10px] font-bold px-2 py-[3px] rounded-full"
            style={{ color: typeCfg.color, background: typeCfg.color + '15' }}>
            <TypeIcon size={10} /> {typeCfg.label}
          </span>
          <ChevronRight size={10} className="text-[#e9e9e9]" />
          <span className="font-mono text-[11px] font-bold text-[#9a9a9a]">{issue.issueKey}</span>

          {/* Portal toggle button — right */}
          <div className="ml-auto">
            <button
              onClick={() => setPortalOpen(v => !v)}
              className={`flex items-center gap-2 px-3 py-[6px] rounded-[8px] text-[11px] font-semibold transition-all border ${
                portalOpen
                  ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                  : 'text-[#9a9a9a] border-[#e9e9e9] hover:border-[#9a9a9a] hover:text-[#1f1f1f]'
              }`}
            >
              {portalOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
              Матеріали та чат
              {allMaterials.length > 0 && (
                <span className={`text-[9px] px-[5px] py-[1px] rounded-full font-bold ${
                  portalOpen ? 'bg-white/20 text-white' : 'bg-[#f0f0f0] text-[#9a9a9a]'
                }`}>{allMaterials.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Main + optional right panel */}
        <div className="flex-1 overflow-hidden flex">

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-7 pt-6 pb-12">

            {/* Title */}
            {editingTitle ? (
              <input ref={titleRef} value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="w-full text-[21px] font-bold text-[#1f1f1f] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] px-3 py-2 mb-5 outline-none"
              />
            ) : (
              <h1
                className="text-[21px] font-bold text-[#1f1f1f] mb-5 leading-snug cursor-text hover:bg-[#f7f7f7] px-2 py-1 -mx-2 rounded-[8px] transition-colors"
                onClick={() => { setEditingTitle(true); setTitleVal(issue.title); }}
              >
                {issue.title}
              </h1>
            )}

            {/* Description */}
            <div className="mb-6">
              <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Опис</p>
              <textarea
                key={`desc-${issueId}`}
                defaultValue={issue.description || ''}
                onBlur={e => { if (e.target.value !== (issue.description || '')) update({ description: e.target.value }); }}
                placeholder="Додай опис..."
                rows={4}
                className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#e9e9e9] border border-transparent focus:border-[#e9e9e9] focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Subtasks */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">
                  Підзадачі{subtasksAll > 0 ? ` · ${subtasksDone}/${subtasksAll}` : ''}
                </p>
                <button onClick={() => setShowSubInput(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] px-2 py-[2px] rounded-[5px] hover:bg-[#f7f7f7] transition-all">
                  <Plus size={9} /> Додати
                </button>
              </div>
              {subtasksAll > 0 && (
                <div className="h-[3px] bg-[#f0f0f0] rounded-full mb-2 overflow-hidden">
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
                  <button onClick={() => { setShowSubInput(false); setSubtaskText(''); }} className="px-2 py-[6px] text-[#9a9a9a] text-[11px]">✕</button>
                </div>
              )}
            </div>

            {/* Activity */}
            <div>
              <div className="flex border-b border-[#f0f0f0] gap-0 mb-4">
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

              {activeTab === 'comments' && (
                <div className="flex flex-col gap-4">
                  {comments.length === 0 && <p className="text-[12px] text-[#e9e9e9]">Коментарів поки немає</p>}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <UserAvatar user={{ name: c.authorName, avatar: c.authorAvatar }} size={28} className="shrink-0 mt-[2px]" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[12px] font-bold text-[#1f1f1f]">{c.authorName}</span>
                          <span className="text-[9px] text-[#cfcfcf]">{c.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3 text-[13px] text-[#1f1f1f] leading-relaxed whitespace-pre-wrap">{c.text}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2 border-t border-[#f7f7f7]">
                    <UserAvatar user={currentUser} size={28} className="shrink-0 mt-[2px]" />
                    <div className="flex-1">
                      <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                        placeholder="Коментар... (Enter — відправити)" rows={2}
                        className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#e9e9e9] border border-transparent focus:border-[#e9e9e9] focus:outline-none resize-none"
                      />
                      <div className="flex justify-end mt-1">
                        <button onClick={handleComment} disabled={!commentText.trim()}
                          className="px-4 py-[6px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold disabled:opacity-30 hover:bg-[#303030] transition-colors">
                          Відправити
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timelogs' && (
                <div>
                  {timeLogs.length === 0 && <p className="text-[12px] text-[#e9e9e9]">Час ще не списано</p>}
                  {timeLogs.map(log => {
                    const u = members.find(m => (m.id || m.uid) === log.userId);
                    const h = Math.floor((log.spentMinutes || 0) / 60);
                    const m = (log.spentMinutes || 0) % 60;
                    return (
                      <div key={log.id} className="flex items-center gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
                        <UserAvatar user={u || { name: log.userId }} size={24} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-[#1f1f1f]">{h > 0 ? `${h}г ` : ''}{m > 0 ? `${m}хв` : ''}</p>
                          {log.description && <p className="text-[11px] text-[#9a9a9a] truncate">{log.description}</p>}
                        </div>
                        <span className="text-[10px] text-[#cfcfcf] shrink-0">{log.loggedAt?.toDate?.()?.toLocaleDateString('uk-UA')}</span>
                      </div>
                    );
                  })}
                </div>
              )}

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
                        <p className="text-[9px] text-[#cfcfcf] mt-[2px]">{log.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════
              RIGHT SLIDE-IN — Materials + Chat
          ═══════════════════════════════════ */}
          {portalOpen && (
            <div className="w-[280px] shrink-0 border-l border-[#f0f0f0] flex flex-col bg-[#fafafa] overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#f0f0f0] bg-white shrink-0">
                <Layers size={13} className="text-[#9a9a9a]" />
                <span className="text-[12px] font-bold text-[#1f1f1f]">Портал проєкту</span>
                <button onClick={() => setPortalOpen(false)}
                  className="ml-auto text-[#cfcfcf] hover:text-[#1f1f1f] transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Materials */}
                <div className="px-4 py-3 border-b border-[#f0f0f0]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">Матеріали</p>
                    <Link href={`/workspace/${projectId}?tab=materials`}
                      className="text-[9px] text-[#6366f1] hover:underline font-semibold">Всі →</Link>
                  </div>

                  {allMaterials.length === 0 ? (
                    <p className="text-[11px] text-[#e9e9e9] py-2">Немає матеріалів</p>
                  ) : (
                    <div className="flex flex-col gap-[3px]">
                      {allMaterials.slice(0, 8).map((mat, i) => {
                        const sk  = mat.status || (mat.clientApprovalPending ? 'pending' : 'none');
                        const cfg = MAT_STATUS[sk] || MAT_STATUS.none;
                        const SIcon = cfg.Icon;
                        return (
                          <div key={mat.id || i} className="flex items-center gap-2 py-[5px] px-2 rounded-[7px] hover:bg-white transition-colors">
                            {/* Tiny thumbnail */}
                            <div className="w-[28px] h-[28px] bg-[#f0f0f0] rounded-[5px] shrink-0 overflow-hidden flex items-center justify-center">
                              {mat.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(mat.url)
                                ? <img src={mat.url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                                : <Layers size={11} className="text-[#cfcfcf]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-[#1f1f1f] truncate">{mat.name || mat.title || 'Матеріал'}</p>
                              <p className="text-[9px] text-[#cfcfcf] truncate">{mat.stageName}</p>
                            </div>
                            <SIcon size={11} style={{ color: cfg.color }} className="shrink-0" title={cfg.label} />
                          </div>
                        );
                      })}
                      {allMaterials.length > 8 && (
                        <p className="text-[10px] text-[#9a9a9a] text-center py-1">
                          +{allMaterials.length - 8} ще
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Chat preview */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">Чат з клієнтом</p>
                    <a href={PORTAL_URL} target="_blank" rel="noopener"
                      className="text-[9px] text-[#6366f1] hover:underline font-semibold flex items-center gap-[2px]">
                      Портал <ExternalLink size={8} />
                    </a>
                  </div>

                  {messages.length === 0 ? (
                    <p className="text-[11px] text-[#e9e9e9] py-2">Повідомлень немає</p>
                  ) : (
                    <div className="flex flex-col gap-[2px]">
                      {messages.slice(0, 5).map((msg, i) => (
                        <div key={msg.id || i} className="py-[6px] px-3 rounded-[8px] hover:bg-white transition-colors">
                          <div className="flex items-baseline gap-2 mb-[2px]">
                            <span className="text-[10px] font-bold text-[#1f1f1f]">{msg.senderName || 'Клієнт'}</span>
                            <span className="text-[9px] text-[#cfcfcf]">{timeAgo(msg.createdAt || msg.timestamp)}</span>
                          </div>
                          <p className="text-[11px] text-[#4a4a4a] leading-relaxed line-clamp-2">{msg.text || msg.message}</p>
                        </div>
                      ))}
                      {messages.length > 5 && (
                        <p className="text-[10px] text-[#9a9a9a] text-center py-1">+{messages.length - 5} ще</p>
                      )}
                    </div>
                  )}

                  <a href={PORTAL_URL} target="_blank" rel="noopener"
                    className="mt-3 flex items-center justify-center gap-1 w-full py-[7px] bg-white border border-[#e9e9e9] text-[10px] font-semibold text-[#1f1f1f] rounded-[8px] hover:bg-[#f0f0f0] transition-colors">
                    <ExternalLink size={10} /> Відкрити портал
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
