'use client';
// src/app/workspace/[projectId]/issue/[issueId]/page.js
// Full-page YouTrack-style issue detail
import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter }      from 'next/navigation';
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
  ArrowLeft, ArrowUp, ArrowDown, Clock, MessageSquare,
  History, CheckSquare, Square, Plus, ExternalLink, Link2,
  AlertOctagon, Minus, Zap, Bug, Star, Trash2, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ── Config ──────────────────────────────────────────────────────────

const STATUSES = [
  { id: 'backlog',         label: 'Backlog',         color: '#9a9a9a' },
  { id: 'todo',            label: 'To Do',           color: '#6366f1' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2' },
  { id: 'code-review',     label: 'Code Review',     color: '#d97706' },
  { id: 'qa',              label: 'QA',              color: '#7c3aed' },
  { id: 'client-approval', label: 'Client Approval', color: '#db2777' },
  { id: 'done',            label: 'Done',            color: '#10b981' },
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

// ── Small helpers ────────────────────────────────────────────────────

function FieldSelect({ label, value, options, onChange, renderOption }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">{label}</p>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-[7px] bg-white border border-[#e9e9e9] rounded-[8px] text-[12px] font-medium text-[#1f1f1f] cursor-pointer hover:border-[#cfcfcf] transition-colors">
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ActivityItem({ log }) {
  const time = log.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
      <div className="w-[6px] h-[6px] rounded-full bg-[#e9e9e9] mt-[7px] shrink-0" />
      <div>
        <p className="text-[12px] text-[#1f1f1f]">
          <span className="font-semibold">{log.userName || 'Система'}</span>
          {' '}{log.action === 'status_changed' ? `→ ${log.to}` : log.action}
        </p>
        <p className="text-[10px] text-[#cfcfcf] mt-[2px]">{time}</p>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function IssuePage({ params }) {
  const { projectId, issueId } = use(params);
  const router                 = useRouter();
  const { projects, currentUser } = useAppContext();
  const { issues, updateIssue, deleteIssue, moveIssue } = useIssues(projectId);
  const { showToast, activeTimer } = useWorkspaceStore();

  const issue   = issues.find(i => i.id === issueId);
  const project = projects?.find(p => p.id === projectId);

  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const { logs: timeLogs, totalMinutes, addTimeLog } = useTimeLogs(issueId);
  const { comments, addComment }                     = useComments(issueId);
  const { logs: auditLogs }                          = useAuditLog(issueId);

  const [activeTab,   setActiveTab]   = useState('comments');
  const [commentText, setCommentText] = useState('');
  const [subtaskText, setSubtaskText] = useState('');
  const [showSubInput, setShowSubInput] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal,    setTitleVal]    = useState('');
  const titleRef = useRef(null);

  // Navigate to adjacent issues
  const sortedIssues = [...issues].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx  = sortedIssues.findIndex(i => i.id === issueId);
  const prev = idx > 0 ? sortedIssues[idx - 1] : null;
  const next = idx < sortedIssues.length - 1 ? sortedIssues[idx + 1] : null;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Escape') router.push(`/workspace/${projectId}`);
      if (e.key === 'e' || e.key === 'E') { setEditingTitle(true); setTitleVal(issue?.title || ''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, projectId, issue?.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  if (!issue && issues.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f7f7f7]">
        <div className="text-center">
          <p className="text-[16px] font-bold text-[#1f1f1f] mb-2">Задачу не знайдено</p>
          <Link href={`/workspace/${projectId}`} className="text-[13px] text-[#6366f1] hover:underline">← Повернутись на дошку</Link>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f7f7f7]">
        <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  const typeCfg     = TYPES.find(t => t.id === issue.type)     || TYPES[2];
  const priorityCfg = PRIORITIES.find(p => p.id === issue.priority) || PRIORITIES[2];
  const statusCfg   = STATUSES.find(s => s.id === issue.columnId)   || STATUSES[0];
  const TypeIcon     = typeCfg.icon;
  const PriorityIcon = priorityCfg.icon;

  const due = issue.dueDate?.toDate ? issue.dueDate.toDate() : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const subtasksDone = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll  = (issue.subtasks || []).length;

  // ── Update helpers ───────────────────────────────────────────────

  const update = useCallback(async (patch) => {
    await updateIssue(issueId, patch, currentUser?.id, currentUser?.name);
  }, [issueId, updateIssue, currentUser]);

  const handleStatusChange = async (newStatus) => {
    try {
      await moveIssue(issueId, newStatus, issue.order ?? 0, currentUser?.id, currentUser?.name);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleTitleSave = async () => {
    const v = titleVal.trim();
    if (v && v !== issue.title) await update({ title: v });
    setEditingTitle(false);
  };

  const toggleAssignee = async (uid) => {
    const cur = issue.assigneeIds || [];
    const next = cur.includes(uid) ? cur.filter(a => a !== uid) : [...cur, uid];
    await update({ assigneeIds: next });

    // Notify newly added assignee
    if (!cur.includes(uid)) {
      await sendNotification({
        userIds: [uid],
        type: 'assigned',
        title: `Вам призначено задачу ${issue.issueKey}`,
        body: issue.title,
        link: `/workspace/${projectId}/issue/${issueId}`,
        issueId, projectId,
      });
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
    if (!commentText.trim()) return;
    await addComment(issueId, commentText.trim(), currentUser);
    // Notify all assignees + reporter except commenter
    const myUid = currentUser?.id || currentUser?.uid;
    const notifyUids = [...(issue.assigneeIds || []), issue.reporterId].filter(u => u && u !== myUid);
    await sendNotification({
      userIds: [...new Set(notifyUids)],
      type: 'commented',
      title: `Новий коментар у ${issue.issueKey}`,
      body: commentText.trim().slice(0, 100),
      link: `/workspace/${projectId}/issue/${issueId}`,
      issueId, projectId,
    });
    setCommentText('');
  };

  const handleLogTime = async (minutes, description) => {
    await addTimeLog(issueId, projectId, currentUser?.id || currentUser?.uid, minutes, description);
    await update({ spentMinutes: (issue.spentMinutes || 0) + minutes });
    showToast(`${minutes} хв списано ✓`);
  };

  const handleDelete = async () => {
    if (!confirm('Видалити задачу?')) return;
    await deleteIssue(issueId);
    router.push(`/workspace/${projectId}`);
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* ── Top nav bar (YouTrack-style) ───────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#f0f0f0] shrink-0 bg-white">
        {/* Breadcrumbs */}
        <Link href={`/workspace/${projectId}`}
          className="flex items-center gap-1 text-[11px] text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors font-medium">
          <ArrowLeft size={13} /> Дошка
        </Link>
        <ChevronRight size={12} className="text-[#e9e9e9]" />
        <span className="text-[11px] text-[#9a9a9a] font-medium truncate max-w-[160px]">{project?.name}</span>
        <ChevronRight size={12} className="text-[#e9e9e9]" />
        <span className="text-[11px] font-bold font-mono text-[#1f1f1f]">{issue.issueKey}</span>

        {/* Issue navigation */}
        <div className="flex items-center gap-1 ml-2">
          {prev && (
            <Link href={`/workspace/${projectId}/issue/${prev.id}`}
              className="p-[5px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[6px] transition-all" title={prev.title}>
              <ArrowUp size={13} />
            </Link>
          )}
          {next && (
            <Link href={`/workspace/${projectId}/issue/${next.id}`}
              className="p-[5px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[6px] transition-all" title={next.title}>
              <ArrowDown size={13} />
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Status selector */}
          <select value={issue.columnId} onChange={e => handleStatusChange(e.target.value)}
            className="px-3 py-[6px] rounded-full text-[11px] font-bold cursor-pointer border-none transition-colors"
            style={{ background: statusCfg.color + '20', color: statusCfg.color }}>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          {/* Delete */}
          <button onClick={handleDelete}
            className="p-[6px] text-[#9a9a9a] hover:text-red-500 hover:bg-red-50 rounded-[8px] transition-all" title="Видалити">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: content (flex-1) */}
        <div className="flex-1 overflow-y-auto px-8 py-6">

          {/* Type + key */}
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-[5px] text-[11px] font-bold px-[8px] py-[3px] rounded-[6px]"
              style={{ color: typeCfg.color, background: typeCfg.color + '18' }}>
              <TypeIcon size={11} /> {typeCfg.label}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(issue.issueKey); showToast(`${issue.issueKey} скопійовано`); }}
              className="font-mono text-[12px] font-bold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] px-2 py-[2px] rounded-[6px] transition-all"
              title="Скопіювати ID"
            >
              {issue.issueKey}
            </button>
          </div>

          {/* Editable title */}
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
              className="w-full text-[22px] font-bold text-[#1f1f1f] bg-[#f7f7f7] border border-[#1f1f1f]/20 rounded-[8px] px-3 py-2 mb-5 focus:ring-2 focus:ring-[#6366f1]/30"
            />
          ) : (
            <h1
              className="text-[22px] font-bold text-[#1f1f1f] mb-5 cursor-text hover:bg-[#f7f7f7] px-2 -mx-2 py-1 rounded-[8px] transition-colors"
              onClick={() => { setEditingTitle(true); setTitleVal(issue.title); }}
              title="Натисни або E щоб редагувати"
            >
              {issue.title}
            </h1>
          )}

          {/* Description */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Опис</p>
            <textarea
              defaultValue={issue.description || ''}
              onBlur={e => { if (e.target.value !== (issue.description || '')) update({ description: e.target.value }); }}
              placeholder="Додай опис задачі..."
              rows={4}
              className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-transparent focus:border-[#e9e9e9] resize-none transition-all leading-relaxed"
            />
          </div>

          {/* Subtasks */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Підзадачі</p>
                {subtasksAll > 0 && (
                  <span className="text-[10px] font-bold text-[#9a9a9a]">{subtasksDone}/{subtasksAll}</span>
                )}
              </div>
              <button onClick={() => setShowSubInput(true)}
                className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] px-2 py-1 rounded-[6px] transition-all">
                <Plus size={11} /> Додати
              </button>
            </div>

            {subtasksAll > 0 && (
              <div className="h-[3px] bg-[#f0f0f0] rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-[#10b981] rounded-full transition-all"
                  style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
              </div>
            )}

            <div className="flex flex-col gap-[6px]">
              {(issue.subtasks || []).map((s, i) => (
                <label key={i} className="flex items-center gap-3 group cursor-pointer p-2 -mx-2 rounded-[8px] hover:bg-[#f7f7f7] transition-colors">
                  <button type="button" onClick={() => handleToggleSubtask(i)}
                    className="shrink-0 text-[#9a9a9a] hover:text-[#1f1f1f]">
                    {s.done ? <CheckSquare size={15} className="text-[#10b981]" /> : <Square size={15} />}
                  </button>
                  <span className={`text-[13px] ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}>{s.title}</span>
                </label>
              ))}
            </div>

            {showSubInput && (
              <div className="flex gap-2 mt-3">
                <input autoFocus value={subtaskText} onChange={e => setSubtaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowSubInput(false); setSubtaskText(''); } }}
                  placeholder="Нова підзадача..."
                  className="flex-1 px-3 py-[7px] bg-[#f7f7f7] rounded-[8px] text-[12px] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors text-[#1f1f1f]"
                />
                <button onClick={handleAddSubtask}
                  className="px-4 py-[7px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold">
                  Додати
                </button>
                <button onClick={() => { setShowSubInput(false); setSubtaskText(''); }}
                  className="px-3 py-[7px] text-[#9a9a9a] hover:text-[#1f1f1f] text-[11px]">✕</button>
              </div>
            )}
          </div>

          {/* Activity tabs */}
          <div className="border-b border-[#f0f0f0] flex gap-1 mb-4">
            {[
              { id: 'comments', label: 'Коментарі', icon: MessageSquare, badge: comments.length },
              { id: 'timelogs', label: 'Тайм-логи', icon: Clock,          badge: timeLogs.length },
              { id: 'history',  label: 'Історія',   icon: History,        badge: 0 },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-[6px] px-4 py-[8px] text-[12px] font-semibold border-b-2 transition-all ${
                  activeTab === id ? 'border-[#1f1f1f] text-[#1f1f1f]' : 'border-transparent text-[#9a9a9a] hover:text-[#1f1f1f]'
                }`}>
                <Icon size={13} />{label}
                {badge > 0 && <span className="text-[9px] bg-[#f0f0f0] text-[#9a9a9a] px-[5px] py-[1px] rounded-full font-bold">{badge}</span>}
              </button>
            ))}
          </div>

          {/* Comments */}
          {activeTab === 'comments' && (
            <div className="flex flex-col gap-4">
              {comments.length === 0 && (
                <p className="text-[12px] text-[#cfcfcf] py-4">Коментарів поки немає</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <UserAvatar user={{ name: c.authorName, avatar: c.authorAvatar }} size={30} className="shrink-0 mt-[2px]" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-[4px]">
                      <span className="text-[13px] font-bold text-[#1f1f1f]">{c.authorName}</span>
                      <span className="text-[10px] text-[#cfcfcf]">
                        {c.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3 text-[13px] text-[#1f1f1f] leading-relaxed">
                      {c.text}
                    </div>
                  </div>
                </div>
              ))}

              {/* Comment input */}
              <div className="flex gap-3 pt-2">
                <UserAvatar user={currentUser} size={30} className="shrink-0 mt-[2px]" />
                <div className="flex-1">
                  <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                    placeholder="Написати коментар... (Enter — відправити, Shift+Enter — новий рядок)"
                    rows={3}
                    className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-transparent focus:border-[#e9e9e9] resize-none transition-all"
                  />
                  <div className="flex justify-end mt-2">
                    <button onClick={handleComment} disabled={!commentText.trim()}
                      className="px-4 py-[7px] bg-[#1f1f1f] text-white rounded-[8px] text-[12px] font-bold disabled:opacity-30 hover:bg-[#303030] transition-all">
                      Відправити
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time logs */}
          {activeTab === 'timelogs' && (
            <div className="flex flex-col gap-1">
              {timeLogs.length === 0 && <p className="text-[12px] text-[#cfcfcf] py-4">Час ще не списано</p>}
              {timeLogs.map(log => {
                const u = members.find(m => (m.id || m.uid) === log.userId);
                const mins = log.spentMinutes;
                const timeStr = `${Math.floor(mins/60)}г ${mins%60}хв`;
                return (
                  <div key={log.id} className="flex items-center gap-3 py-3 border-b border-[#f7f7f7] last:border-0">
                    <UserAvatar user={u || { name: log.userId }} size={26} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#1f1f1f]">{timeStr}</p>
                      <p className="text-[11px] text-[#9a9a9a] truncate">{log.description || '—'}</p>
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
              {auditLogs.length === 0 && <p className="text-[12px] text-[#cfcfcf] py-4">Змін ще не було</p>}
              {auditLogs.map(log => <ActivityItem key={log.id} log={log} />)}
            </div>
          )}
        </div>

        {/* Right: fields panel (YouTrack sidebar) */}
        <div className="w-[260px] shrink-0 border-l border-[#f0f0f0] overflow-y-auto bg-[#fafafa] px-5 py-6 flex flex-col gap-5">

          {/* Type */}
          <FieldSelect label="Тип" value={issue.type}
            options={TYPES} onChange={v => update({ type: v })} />

          {/* Priority */}
          <div>
            <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-[5px]">Пріоритет</p>
            <select value={issue.priority || 'medium'} onChange={e => update({ priority: e.target.value })}
              className="w-full px-3 py-[7px] bg-white border border-[#e9e9e9] rounded-[8px] text-[12px] font-medium text-[#1f1f1f] cursor-pointer">
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {/* Assignees */}
          <div>
            <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-[5px]">Виконавці</p>
            <div className="flex flex-col gap-[4px]">
              {members.map(m => {
                const uid    = m.id || m.uid;
                const active = (issue.assigneeIds || []).includes(uid);
                return (
                  <button key={uid} onClick={() => toggleAssignee(uid)}
                    className={`flex items-center gap-2 px-2 py-[5px] rounded-[8px] text-[11px] font-medium transition-all ${
                      active ? 'bg-[#1f1f1f] text-white' : 'bg-white text-[#1f1f1f] hover:bg-[#f0f0f0] border border-[#e9e9e9]'
                    }`}>
                    <UserAvatar user={m} size={18} />
                    <span className="truncate">{m.name || m.email}</span>
                  </button>
                );
              })}
              {members.length === 0 && <p className="text-[11px] text-[#cfcfcf]">Немає учасників</p>}
            </div>
          </div>

          {/* Reporter */}
          {issue.reporterId && (
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-[5px]">Автор</p>
              <div className="flex items-center gap-2">
                {(() => { const r = members.find(m => (m.id||m.uid) === issue.reporterId); return r ? (
                  <><UserAvatar user={r} size={20} /><span className="text-[12px] font-medium text-[#1f1f1f]">{r.name}</span></>
                ) : <span className="text-[11px] text-[#9a9a9a]">{issue.reporterId}</span>; })()}
              </div>
            </div>
          )}

          {/* Due date */}
          <div>
            <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-[5px]">Дедлайн</p>
            <input type="date"
              value={due ? due.toISOString().split('T')[0] : ''}
              onChange={e => update({ dueDate: e.target.value ? new Date(e.target.value) : null })}
              className={`w-full px-3 py-[7px] rounded-[8px] text-[12px] font-medium border bg-white cursor-pointer ${
                isOverdue ? 'border-red-300 text-red-500' : 'border-[#e9e9e9] text-[#1f1f1f]'
              }`}
            />
          </div>

          {/* Estimate */}
          <div>
            <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-[5px]">Оцінка (год)</p>
            <input type="number" min="0" step="0.5"
              value={issue.estimateMinutes ? issue.estimateMinutes / 60 : ''}
              onChange={e => update({ estimateMinutes: Math.round(parseFloat(e.target.value || 0) * 60) })}
              placeholder="0"
              className="w-full px-3 py-[7px] rounded-[8px] text-[12px] font-medium border border-[#e9e9e9] bg-white text-[#1f1f1f]"
            />
          </div>

          {/* Time Tracker */}
          <TimeTracker issue={issue} userId={currentUser?.id || currentUser?.uid} onLogTime={handleLogTime} />

          {/* Client integration */}
          {issue.linkedClientMaterialId && (
            <div className="bg-[#f0f4ff] border border-[#c7d7fc] rounded-[12px] p-3">
              <p className="text-[10px] font-bold text-[#4f46e5] uppercase tracking-wide mb-2 flex items-center gap-1">
                <Link2 size={10} /> Клієнтський матеріал
              </p>
              <p className="text-[11px] text-[#4f46e5] font-medium mb-2 truncate">
                {issue.linkedClientMaterialId}
              </p>
              <a href={`${PORTAL_URL}`} target="_blank" rel="noopener"
                className="flex items-center gap-1 text-[11px] text-[#4f46e5] hover:underline font-medium">
                <ExternalLink size={10} /> Відкрити в порталі
              </a>
            </div>
          )}

          {/* Created at */}
          {issue.createdAt && (
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-[3px]">Створено</p>
              <p className="text-[11px] text-[#cfcfcf]">
                {issue.createdAt?.toDate?.()?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
