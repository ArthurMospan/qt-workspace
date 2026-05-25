'use client';
// src/app/workspace/[projectId]/issue/[issueId]/page.js
// Full-page issue — metadata panel LEFT, content RIGHT
import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }      from '@/lib/hooks/useIssues';
import { useTimeLogs }    from '@/lib/hooks/useTimeLogs';
import { useComments }    from '@/lib/hooks/useComments';
import { useAuditLog }    from '@/lib/hooks/useAuditLog';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import { sendNotification } from '@/lib/hooks/useNotifications';
import TimeTracker        from '@/components/workspace/TimeTracker';
import UserAvatar         from '@/components/UserAvatar';
import {
  ArrowLeft, ChevronRight, ArrowUp, ArrowDown,
  MessageSquare, Clock, History, CheckSquare, Square,
  Plus, Trash2, Link2, ExternalLink,
  AlertOctagon, Minus, Zap, Bug, Star,
  Calendar, User, Tag, Flag, Play,
} from 'lucide-react';

// ── Config ─────────────────────────────────────────────────────────

const STATUSES = [
  { id: 'backlog',         label: 'Backlog',         color: '#9a9a9a', bg: '#f5f5f5' },
  { id: 'todo',            label: 'To Do',           color: '#6366f1', bg: '#eef2ff' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2', bg: '#ecfeff' },
  { id: 'code-review',     label: 'Code Review',     color: '#d97706', bg: '#fffbeb' },
  { id: 'qa',              label: 'QA',              color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'client-approval', label: 'Client Approval', color: '#db2777', bg: '#fdf2f8' },
  { id: 'done',            label: 'Done ✓',          color: '#10b981', bg: '#ecfdf5' },
];

const PRIORITIES = [
  { id: 'blocker', label: 'Blocker', icon: AlertOctagon, color: '#dc2626', bg: '#fef2f2' },
  { id: 'high',    label: 'High',    icon: ArrowUp,      color: '#f97316', bg: '#fff7ed' },
  { id: 'medium',  label: 'Medium',  icon: Minus,        color: '#eab308', bg: '#fefce8' },
  { id: 'low',     label: 'Low',     icon: ArrowDown,    color: '#9a9a9a', bg: '#f5f5f5' },
];

const TYPES = [
  { id: 'epic',    label: 'Epic',    icon: Zap,         color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'feature', label: 'Feature', icon: Star,        color: '#0891b2', bg: '#ecfeff' },
  { id: 'task',    label: 'Task',    icon: CheckSquare, color: '#059669', bg: '#ecfdf5' },
  { id: 'bug',     label: 'Bug',     icon: Bug,         color: '#dc2626', bg: '#fef2f2' },
];

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

// ── Circular progress ring ──────────────────────────────────────────

function Ring({ pct, color, size = 48, stroke = 4 }) {
  const r   = (size - stroke * 2) / 2;
  const c   = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Left panel field row ────────────────────────────────────────────

function FieldRow({ icon: Icon, label, children }) {
  return (
    <div className="group">
      <div className="flex items-center gap-[6px] mb-[6px]">
        <Icon size={10} className="text-[#cfcfcf]" />
        <span className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">{label}</span>
      </div>
      <div className="ml-[2px]">{children}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function IssuePage({ params }) {
  const { projectId, issueId } = use(params);
  const router = useRouter();
  const { projects, currentUser } = useAppContext();
  const { issues, updateIssue, deleteIssue, moveIssue } = useIssues(projectId);
  const showToast = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const { logs: timeLogs, addTimeLog } = useTimeLogs(issueId);
  const { comments, addComment }       = useComments(issueId);
  const { logs: auditLogs }            = useAuditLog(issueId);

  const [activeTab,    setActiveTab]    = useState('comments');
  const [commentText,  setCommentText]  = useState('');
  const [subtaskText,  setSubtaskText]  = useState('');
  const [showSubInput, setShowSubInput] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal,     setTitleVal]     = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

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

  const due       = issue.dueDate?.toDate ? issue.dueDate.toDate() : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const reporter      = members.find(m => (m.id || m.uid) === issue.reporterId);
  const subtasksDone  = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll   = (issue.subtasks || []).length;

  const spentMin   = issue.spentMinutes  || 0;
  const estimMin   = issue.estimateMinutes || 0;
  const timePct    = estimMin > 0 ? Math.round((spentMin / estimMin) * 100) : 0;
  const timeColor  = timePct >= 100 ? '#dc2626' : timePct >= 75 ? '#f97316' : '#6366f1';

  const actor = { userId: currentUser?.id || currentUser?.uid, userName: currentUser?.name };

  // ── Handlers ────────────────────────────────────────────────────

  const update = async (patch) => {
    try { await updateIssue(issueId, patch, actor); }
    catch (err) { showToast(err.message || 'Помилка', 'error'); }
  };

  const handleStatusChange = async (newStatus) => {
    try { await moveIssue(issueId, newStatus, issue.order ?? 0, actor); }
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
    if (!cur.includes(uid)) {
      await sendNotification({ userIds: [uid], type: 'assigned',
        title: `Вам призначено задачу ${issue.issueKey}`, body: issue.title,
        link: `/workspace/${projectId}/issue/${issueId}`, issueId, projectId,
      }).catch(() => {});
    }
  };

  const handleAddSubtask = async () => {
    if (!subtaskText.trim()) return;
    await update({ subtasks: [...(issue.subtasks || []), { title: subtaskText.trim(), done: false }] });
    setSubtaskText(''); setShowSubInput(false);
  };

  const handleToggleSubtask = async (i) => {
    const subs = [...(issue.subtasks || [])];
    subs[i] = { ...subs[i], done: !subs[i].done };
    await update({ subtasks: subs });
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText('');
    await addComment(issueId, text, currentUser);
    const myUid    = currentUser?.id || currentUser?.uid;
    const notifyUids = [...new Set([...(issue.assigneeIds || []), issue.reporterId].filter(u => u && u !== myUid))];
    await sendNotification({ userIds: notifyUids, type: 'commented',
      title: `Коментар у ${issue.issueKey}`, body: text.slice(0, 120),
      link: `/workspace/${projectId}/issue/${issueId}`, issueId, projectId,
    }).catch(() => {});
  };

  const handleLogTime = async (minutes, description) => {
    const uid = currentUser?.id || currentUser?.uid;
    await addTimeLog(issueId, projectId, uid, minutes, description);
    await update({ spentMinutes: spentMin + minutes });
    showToast(`${minutes} хв списано ✓`);
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити ${issue.issueKey}?`)) return;
    await deleteIssue(issueId);
    router.push(`/workspace/${projectId}`);
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden bg-white">

      {/* ══════════════════════════════════════════════
          LEFT PANEL — metadata
      ══════════════════════════════════════════════ */}
      <aside className="w-[260px] shrink-0 bg-[#fafafa] border-r border-[#f0f0f0] overflow-y-auto flex flex-col">

        {/* Back nav */}
        <div className="px-4 pt-4 pb-3 border-b border-[#f0f0f0]">
          <Link href={`/workspace/${projectId}`}
            className="flex items-center gap-1 text-[11px] text-[#9a9a9a] hover:text-[#1f1f1f] font-medium transition-colors w-fit">
            <ArrowLeft size={11} /> {project?.name || 'Дошка'}
          </Link>

          {/* Issue key + nav */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => { navigator.clipboard.writeText(issue.issueKey); showToast(`${issue.issueKey} скопійовано`); }}
              className="font-mono text-[12px] font-bold text-[#1f1f1f] hover:bg-[#f0f0f0] px-[6px] py-[2px] rounded-[5px] transition-all"
              title="Копіювати ID"
            >
              {issue.issueKey}
            </button>
            <div className="flex gap-1">
              {prev && <Link href={`/workspace/${projectId}/issue/${prev.id}`} title={prev.title}
                className="p-[4px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[5px] transition-all">
                <ArrowUp size={12} />
              </Link>}
              {next && <Link href={`/workspace/${projectId}/issue/${next.id}`} title={next.title}
                className="p-[4px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[5px] transition-all">
                <ArrowDown size={12} />
              </Link>}
            </div>
          </div>
        </div>

        {/* Status — big prominent selector */}
        <div className="px-4 py-4 border-b border-[#f0f0f0]">
          <p className="text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Статус</p>
          <div className="relative">
            <select
              value={issue.columnId}
              onChange={e => handleStatusChange(e.target.value)}
              className="w-full px-4 py-[9px] rounded-[10px] text-[12px] font-bold cursor-pointer border-none outline-none appearance-none text-center"
              style={{ background: statusCfg.bg, color: statusCfg.color }}
            >
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {/* Dot indicator */}
            <span className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full"
              style={{ background: statusCfg.color }} />
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 px-4 py-4 flex flex-col gap-5">

          {/* Type */}
          <FieldRow icon={Tag} label="Тип">
            <select value={issue.type || 'task'} onChange={e => update({ type: e.target.value })}
              className="w-full px-3 py-[7px] rounded-[10px] text-[12px] font-bold cursor-pointer border-none outline-none appearance-none"
              style={{ background: typeCfg.bg, color: typeCfg.color }}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </FieldRow>

          {/* Priority */}
          <FieldRow icon={Flag} label="Пріоритет">
            <div className="flex flex-col gap-[4px]">
              {PRIORITIES.map(p => {
                const Icon = p.icon;
                const active = (issue.priority || 'medium') === p.id;
                return (
                  <button key={p.id} onClick={() => update({ priority: p.id })}
                    className="flex items-center gap-2 px-3 py-[6px] rounded-[8px] text-[11px] font-semibold transition-all border"
                    style={{
                      background: active ? p.bg : 'transparent',
                      color:      active ? p.color : '#9a9a9a',
                      borderColor: active ? p.color + '40' : 'transparent',
                    }}>
                    <Icon size={11} style={{ color: active ? p.color : '#cfcfcf' }} />
                    {p.label}
                    {active && <span className="ml-auto w-[5px] h-[5px] rounded-full" style={{ background: p.color }} />}
                  </button>
                );
              })}
            </div>
          </FieldRow>

          {/* Assignees */}
          <FieldRow icon={User} label="Виконавці">
            {/* Stacked avatars preview */}
            {assignees.length > 0 && (
              <div className="flex -space-x-2 mb-2">
                {assignees.map(m => (
                  <UserAvatar key={m.id || m.uid} user={m} size={28}
                    className="ring-2 ring-[#fafafa] cursor-pointer hover:scale-110 transition-transform"
                    title={m.name}
                    onClick={() => toggleAssignee(m.id || m.uid)}
                  />
                ))}
              </div>
            )}
            {/* Toggle list */}
            <div className="flex flex-col gap-[3px]">
              {members.map(m => {
                const uid    = m.id || m.uid;
                const active = (issue.assigneeIds || []).includes(uid);
                return (
                  <button key={uid} onClick={() => toggleAssignee(uid)}
                    className="flex items-center gap-2 px-2 py-[5px] rounded-[7px] transition-all text-[11px]"
                    style={{
                      background: active ? '#1f1f1f' : 'transparent',
                      color:      active ? '#fff' : '#9a9a9a',
                    }}>
                    <UserAvatar user={m} size={18} />
                    <span className="truncate font-medium">{m.name || m.email}</span>
                    {active && <span className="ml-auto text-white/40 text-[10px]">✓</span>}
                  </button>
                );
              })}
              {members.length === 0 && <p className="text-[11px] text-[#e9e9e9]">Немає членів команди</p>}
            </div>
          </FieldRow>

          {/* Reporter */}
          {reporter && (
            <FieldRow icon={User} label="Автор">
              <div className="flex items-center gap-2">
                <UserAvatar user={reporter} size={22} />
                <span className="text-[12px] font-medium text-[#4a4a4a]">{reporter.name}</span>
              </div>
            </FieldRow>
          )}

          {/* Due date */}
          <FieldRow icon={Calendar} label="Дедлайн">
            <div className="relative">
              <input type="date"
                value={due ? due.toISOString().split('T')[0] : ''}
                onChange={e => update({ dueDate: e.target.value || null })}
                className="w-full px-3 py-[7px] rounded-[9px] text-[12px] font-semibold border cursor-pointer focus:outline-none transition-all"
                style={{
                  background:   isOverdue ? '#fef2f2' : '#f7f7f7',
                  color:        isOverdue ? '#dc2626' : '#1f1f1f',
                  borderColor:  isOverdue ? '#fca5a5' : '#f0f0f0',
                }}
              />
            </div>
          </FieldRow>

          {/* Time tracker — ring + controls */}
          <FieldRow icon={Clock} label="Час">
            <div className="bg-white border border-[#f0f0f0] rounded-[12px] p-3">
              {estimMin > 0 ? (
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative shrink-0">
                    <Ring pct={timePct} color={timeColor} size={52} stroke={5} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                      style={{ color: timeColor }}>{timePct}%</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#1f1f1f]">
                      {Math.floor(spentMin / 60)}г {spentMin % 60}хв
                    </p>
                    <p className="text-[10px] text-[#9a9a9a]">
                      з {Math.floor(estimMin / 60)}г {estimMin % 60 > 0 ? `${estimMin % 60}хв` : ''} оцінки
                    </p>
                  </div>
                </div>
              ) : spentMin > 0 ? (
                <p className="text-[12px] font-bold text-[#1f1f1f] mb-2">
                  {Math.floor(spentMin / 60)}г {spentMin % 60}хв витрачено
                </p>
              ) : null}

              <TimeTracker issue={issue} userId={currentUser?.id || currentUser?.uid} onLogTime={handleLogTime} />
            </div>
          </FieldRow>

          {/* Estimate input */}
          <FieldRow icon={Clock} label="Оцінка (год)">
            <input type="number" min="0" step="0.5"
              value={estimMin ? (estimMin / 60).toFixed(1).replace('.0', '') : ''}
              onChange={e => update({ estimateMinutes: Math.round(parseFloat(e.target.value || '0') * 60) })}
              placeholder="—"
              className="w-full px-3 py-[7px] rounded-[9px] text-[12px] font-semibold bg-[#f7f7f7] border border-[#f0f0f0] text-[#1f1f1f] focus:outline-none focus:border-[#9a9a9a] transition-colors"
            />
          </FieldRow>

          {/* Linked client material */}
          {issue.linkedClientMaterialId && (
            <FieldRow icon={Link2} label="Матеріал клієнта">
              <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-[10px] px-3 py-3">
                <p className="text-[11px] text-[#3b82f6] font-semibold truncate mb-2">{issue.linkedClientMaterialId}</p>
                <a href={PORTAL_URL} target="_blank" rel="noopener"
                  className="flex items-center gap-1 text-[11px] text-[#3b82f6] hover:underline font-medium">
                  <ExternalLink size={10} /> Відкрити в порталі
                </a>
              </div>
            </FieldRow>
          )}

          {/* Created at */}
          {issue.createdAt && (
            <div className="pt-3 border-t border-[#f0f0f0]">
              <p className="text-[9px] font-bold text-[#e9e9e9] uppercase tracking-widest mb-1">Створено</p>
              <p className="text-[11px] text-[#cfcfcf]">
                {issue.createdAt?.toDate?.()?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="px-4 pb-4">
          <button onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-[8px] rounded-[9px] text-[11px] font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100">
            <Trash2 size={12} /> Видалити задачу
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT — title, description, activity
      ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Type badge + top bar */}
        <div className="flex items-center gap-3 px-8 py-[10px] border-b border-[#f0f0f0] shrink-0">
          <span className="flex items-center gap-[5px] text-[10px] font-bold px-3 py-[4px] rounded-full"
            style={{ color: typeCfg.color, background: typeCfg.bg }}>
            <TypeIcon size={10} /> {typeCfg.label}
          </span>

          <ChevronRight size={11} className="text-[#e9e9e9]" />

          <span className="text-[11px] text-[#9a9a9a] font-medium">{project?.name}</span>

          <div className="ml-auto flex items-center gap-1">
            {prev && <Link href={`/workspace/${projectId}/issue/${prev.id}`} title={prev.title}
              className="p-[5px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[6px] transition-all">
              <ArrowUp size={12} />
            </Link>}
            {next && <Link href={`/workspace/${projectId}/issue/${next.id}`} title={next.title}
              className="p-[5px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[6px] transition-all">
              <ArrowDown size={12} />
            </Link>}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 pt-7 pb-12">

          {/* Title */}
          {editingTitle ? (
            <input ref={titleRef} value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
              className="w-full text-[22px] font-bold text-[#1f1f1f] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] px-3 py-2 mb-6 outline-none"
            />
          ) : (
            <h1
              className="text-[22px] font-bold text-[#1f1f1f] mb-6 leading-snug cursor-text hover:bg-[#f7f7f7] px-2 py-1 -mx-2 rounded-[8px] transition-colors"
              onClick={() => { setEditingTitle(true); setTitleVal(issue.title); }}
              title="Клікни щоб редагувати"
            >
              {issue.title}
            </h1>
          )}

          {/* Description */}
          <div className="mb-7">
            <p className="text-[10px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-2">Опис</p>
            <textarea
              key={`desc-${issueId}`}
              defaultValue={issue.description || ''}
              onBlur={e => {
                if (e.target.value !== (issue.description || '')) update({ description: e.target.value });
              }}
              placeholder="Додай опис задачі..."
              rows={4}
              className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#e9e9e9] border border-transparent focus:border-[#e9e9e9] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Subtasks */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#cfcfcf] uppercase tracking-widest">
                Підзадачі{subtasksAll > 0 ? ` · ${subtasksDone}/${subtasksAll}` : ''}
              </p>
              <button onClick={() => setShowSubInput(v => !v)}
                className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] px-2 py-[3px] rounded-[5px] hover:bg-[#f7f7f7] transition-all">
                <Plus size={10} /> Додати
              </button>
            </div>

            {subtasksAll > 0 && (
              <div className="h-[3px] bg-[#f0f0f0] rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-[#10b981] rounded-full transition-all"
                  style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
              </div>
            )}

            {(issue.subtasks || []).map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-[6px] px-2 -mx-2 rounded-[8px] hover:bg-[#f7f7f7] group transition-colors">
                <button type="button" onClick={() => handleToggleSubtask(i)} className="shrink-0">
                  {s.done
                    ? <CheckSquare size={15} className="text-[#10b981]" />
                    : <Square size={15} className="text-[#cfcfcf]" />}
                </button>
                <span className={`text-[13px] flex-1 ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}>{s.title}</span>
              </div>
            ))}

            {showSubInput && (
              <div className="flex gap-2 mt-2">
                <input autoFocus value={subtaskText} onChange={e => setSubtaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowSubInput(false); setSubtaskText(''); } }}
                  placeholder="Нова підзадача..."
                  className="flex-1 px-3 py-[7px] bg-[#f7f7f7] rounded-[8px] text-[12px] border border-[#e9e9e9] focus:border-[#1f1f1f] focus:outline-none"
                />
                <button onClick={handleAddSubtask} className="px-4 py-[7px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold">✓</button>
                <button onClick={() => { setShowSubInput(false); setSubtaskText(''); }} className="px-3 py-[7px] text-[#9a9a9a] text-[11px]">✕</button>
              </div>
            )}
          </div>

          {/* Activity tabs */}
          <div>
            <div className="flex border-b border-[#f0f0f0] gap-1 mb-5">
              {[
                { id: 'comments', label: 'Коментарі', icon: MessageSquare, count: comments.length },
                { id: 'timelogs', label: 'Час',        icon: Clock,         count: timeLogs.length },
                { id: 'history',  label: 'Активність', icon: History,       count: 0 },
              ].map(({ id, label, icon: Icon, count }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-[6px] px-4 py-[9px] text-[12px] font-semibold border-b-2 transition-all -mb-[1px] ${
                    activeTab === id ? 'border-[#1f1f1f] text-[#1f1f1f]' : 'border-transparent text-[#9a9a9a] hover:text-[#1f1f1f]'
                  }`}>
                  <Icon size={12} />{label}
                  {count > 0 && <span className="text-[9px] bg-[#f0f0f0] text-[#9a9a9a] px-[5px] py-[1px] rounded-full">{count}</span>}
                </button>
              ))}
            </div>

            {/* Comments */}
            {activeTab === 'comments' && (
              <div className="flex flex-col gap-5">
                {comments.length === 0 && <p className="text-[12px] text-[#e9e9e9] pb-2">Коментарів поки немає</p>}
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <UserAvatar user={{ name: c.authorName, avatar: c.authorAvatar }} size={30} className="shrink-0 mt-[2px]" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[13px] font-bold text-[#1f1f1f]">{c.authorName}</span>
                        <span className="text-[10px] text-[#cfcfcf]">
                          {c.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3 text-[13px] text-[#1f1f1f] leading-relaxed whitespace-pre-wrap">
                        {c.text}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-2 border-t border-[#f7f7f7]">
                  <UserAvatar user={currentUser} size={30} className="shrink-0 mt-[2px]" />
                  <div className="flex-1">
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                      placeholder="Написати коментар... (Enter — відправити)"
                      rows={3}
                      className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#e9e9e9] border border-transparent focus:border-[#e9e9e9] focus:outline-none resize-none"
                    />
                    <div className="flex justify-end mt-2">
                      <button onClick={handleComment} disabled={!commentText.trim()}
                        className="px-4 py-[7px] bg-[#1f1f1f] text-white rounded-[8px] text-[12px] font-bold disabled:opacity-30 hover:bg-[#303030] transition-colors">
                        Відправити
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Time logs */}
            {activeTab === 'timelogs' && (
              <div>
                {timeLogs.length === 0 && <p className="text-[12px] text-[#e9e9e9] pb-2">Час ще не списано</p>}
                {timeLogs.map(log => {
                  const u = members.find(m => (m.id || m.uid) === log.userId);
                  const h = Math.floor((log.spentMinutes || 0) / 60);
                  const m = (log.spentMinutes || 0) % 60;
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
                      <UserAvatar user={u || { name: log.userId }} size={26} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[#1f1f1f]">{h > 0 ? `${h}г ` : ''}{m > 0 ? `${m}хв` : ''}</p>
                        {log.description && <p className="text-[11px] text-[#9a9a9a] truncate">{log.description}</p>}
                      </div>
                      <span className="text-[10px] text-[#cfcfcf] shrink-0">
                        {log.loggedAt?.toDate?.()?.toLocaleDateString('uk-UA')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div>
                {auditLogs.length === 0 && <p className="text-[12px] text-[#e9e9e9] pb-2">Дій поки не було</p>}
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
                    <div className="w-[6px] h-[6px] rounded-full bg-[#e9e9e9] mt-[7px] shrink-0" />
                    <div>
                      <p className="text-[12px] text-[#1f1f1f]">
                        <span className="font-semibold">{log.userName || 'Система'}</span>
                        {' '}
                        {log.action === 'moved'   ? `перемістив(ла) → ${log.to}` :
                         log.action === 'created' ? 'створив(ла) задачу' :
                         log.action?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-[#cfcfcf] mt-[2px]">
                        {log.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
