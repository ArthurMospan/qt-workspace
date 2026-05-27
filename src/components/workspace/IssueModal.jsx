'use client';
// src/components/workspace/IssueModal.jsx — Split view: 70% content / 30% sidebar
import { useState, useRef, useEffect } from 'react';
import { X, Trash2, ExternalLink, CheckSquare, Square, Plus, Link, Clock, History, MessageSquare } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { useIssueLinks } from '@/lib/hooks/useIssueLinks';
import { sendNotification } from '@/lib/hooks/useNotifications';
import UserAvatar from '@/components/UserAvatar';
import TimeTracker from './TimeTracker';
import DependenciesPanel from './DependenciesPanel';
import EpicsPanel from './EpicsPanel';
import CommentText from './CommentText';
import { DEFAULT_COLUMNS as COLUMNS } from './BoardConfigModal';
import { can } from '@/lib/utils/can';
import { Select } from '@/components/ui/Select';
import { parseMentions, resolveUserIds } from '@/lib/utils/mentions';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { DEFAULT_PRIORITIES, DEFAULT_TYPES } from '@/lib/hooks/useWorkflowConfig';

// Fallback lists — only used if parent doesn't pass workflow config
const PRIORITIES_FALLBACK = DEFAULT_PRIORITIES.map(p => ({ id: p.id, label: `${p.emoji} ${p.label}` }));
const TYPES_FALLBACK       = DEFAULT_TYPES.map(t => ({ id: t.id, label: `${t.emoji} ${t.label}` }));

function Tab({ id, label, icon: Icon, active, onClick, badge }) {
  return (
    <button onClick={() => onClick(id)}
      className={`flex items-center gap-[6px] px-4 py-[8px] text-[12px] font-semibold border-b-2 transition-all ${
        active
          ? 'border-[#1f1f1f] text-[#1f1f1f]'
          : 'border-transparent text-[#9a9a9a] hover:text-[#1f1f1f]'
      }`}>
      <Icon size={13} />
      {label}
      {badge > 0 && (
        <span className="bg-[#f0f0f0] text-[#9a9a9a] text-[9px] font-bold px-[5px] py-[1px] rounded-full">{badge}</span>
      )}
    </button>
  );
}

export default function IssueModal({
  issue, members = [], comments = [], timeLogs = [], auditLogs = [], sprints = [], allIssues = [],
  onClose, onUpdate, onDelete, onAddComment, onLogTime, onAddSubtask, onToggleSubtask,
  onDeleteTimeLog, onUpdateTimeLog,
  priorities: prioritiesProp, types: typesProp, boardColumns: boardColumnsProp,
}) {
  const PRIORITIES = (prioritiesProp || PRIORITIES_FALLBACK).map(p =>
    ({ id: p.id, label: p.label.includes(p.emoji ?? '__') ? p.label : `${p.emoji ?? ''} ${p.label}`.trim() })
  );
  const TYPES = (typesProp || TYPES_FALLBACK).map(t =>
    ({ id: t.id, label: t.label.includes(t.emoji ?? '__') ? t.label : `${t.emoji ?? ''} ${t.label}`.trim() })
  );
  const { currentUser, orgRole } = useAppContext();
  const { links, addLink, removeLink } = useIssueLinks(issue?.id);
  const showToast = useWorkspaceStore(s => s.showToast);
  const [activeTab, setActiveTab] = useState('comments');
  const [commentText, setCommentText] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [showSubInput, setShowSubInput] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    setTitleValue(issue?.title || '');
    setDescValue(issue?.description || '');
  }, [issue?.id]);

  if (!issue) return null;

  const due = issue.dueDate?.toDate ? issue.dueDate.toDate()
    : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';

  const subtasksDone = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll  = (issue.subtasks || []).length;

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const toggleAssignee = (uid) => {
    const cur = issue.assigneeIds || [];
    onUpdate({ assigneeIds: cur.includes(uid) ? cur.filter(a => a !== uid) : [...cur, uid] });
  };

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    onAddSubtask(subtaskInput.trim());
    setSubtaskInput('');
    setShowSubInput(false);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const trimmedText = commentText.trim();

    // Parse @mentions from comment
    const mentions = parseMentions(trimmedText);
    const mentionedUserIds = resolveUserIds(mentions, members);

    // Send comment
    await onAddComment(trimmedText);
    setCommentText('');

    // Send notifications
    const notifyUserIds = new Set(mentionedUserIds);

    // Also notify issue creator/assignees (but not commenter)
    if (issue.createdBy && issue.createdBy !== (currentUser?.id || currentUser?.uid)) {
      notifyUserIds.add(issue.createdBy);
    }
    issue.assigneeIds?.forEach(uid => {
      if (uid !== (currentUser?.id || currentUser?.uid)) {
        notifyUserIds.add(uid);
      }
    });

    if (notifyUserIds.size > 0) {
      await sendNotification({
        userIds: Array.from(notifyUserIds),
        type: 'commented',
        title: `${currentUser?.name || 'Користувач'} прокоментував задачу`,
        body: trimmedText.substring(0, 60) + (trimmedText.length > 60 ? '...' : ''),
        link: `/workspace/${issue.projectId}/issue/${issue.id}`,
        issueId: issue.id,
        projectId: issue.projectId,
      });
    }
  };

  const formatTime = (min) => {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}г ${m}хв` : `${m}хв`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[40px] px-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[900px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-[#f0f0f0] shrink-0">
          {/* Breadcrumb */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[#9a9a9a] mb-[3px]">
              <span>QuickTeam</span>
              <span>/</span>
              <span className="font-mono font-bold text-[#1f1f1f]">{issue.issueKey}</span>
            </div>
            <input
              ref={titleRef}
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== issue.title) onUpdate({ title: v }); }}
              className="w-full text-[17px] font-bold text-[#1f1f1f] bg-transparent focus:bg-[#f7f7f7] rounded-[6px] px-1 -ml-1 transition-colors"
            />
          </div>

          {/* Status select */}
          <div className="w-[140px]">
            <Select
              value={issue.columnId}
              onChange={val => {
                // Check if trying to move to done with blockers
                if (val === 'done' && links.some(l =>
                  l.relationType === 'blocks' && l.targetIssueId === issue.id && l.sourceIssueId
                )) {
                  showToast('Не можливо закрити: задача заблокована', 'error');
                  return;
                }
                onUpdate({ columnId: val, status: val });
              }}
              options={(boardColumnsProp || COLUMNS).map(c => ({ value: c.id, label: c.label }))}
            />
          </div>

          <button onClick={onClose} className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left column — 70% */}
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* Description */}
            <div className="px-6 py-5 border-b border-[#f7f7f7]">
              <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider block mb-2">Опис</label>
              <textarea
                value={descValue}
                onChange={e => setDescValue(e.target.value)}
                onFocus={() => setDescFocused(true)}
                onBlur={e => {
                  setDescFocused(false);
                  if (e.target.value !== (issue.description || '')) onUpdate({ description: e.target.value });
                }}
                placeholder="Додай опис задачі..."
                rows={descFocused ? 6 : 3}
                className="w-full px-[14px] py-[10px] bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-transparent focus:border-[#1f1f1f] resize-none transition-all"
              />
            </div>

            {/* Subtasks */}
            <div className="px-6 py-4 border-b border-[#f7f7f7]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">
                  Підзадачі {subtasksAll > 0 && `(${subtasksDone}/${subtasksAll})`}
                </label>
                <button onClick={() => setShowSubInput(true)}
                  className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
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
                  <label key={i} className="flex items-center gap-3 cursor-pointer group">
                    <button type="button" onClick={() => onToggleSubtask(i)}
                      className="shrink-0 text-[#9a9a9a] hover:text-[#1f1f1f]">
                      {s.done ? <CheckSquare size={15} className="text-[#10b981]" /> : <Square size={15} />}
                    </button>
                    <span className={`text-[13px] ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}>
                      {s.title}
                    </span>
                  </label>
                ))}
              </div>

              {showSubInput && (
                <div className="flex gap-2 mt-2">
                  <input autoFocus value={subtaskInput}
                    onChange={e => setSubtaskInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowSubInput(false); setSubtaskInput(''); } }}
                    placeholder="Нова підзадача..."
                    className="flex-1 px-[14px] py-[10px] bg-[#f7f7f7] rounded-[12px] text-[12px] border border-transparent focus:border-[#1f1f1f] transition-colors text-[#1f1f1f]"
                  />
                  <button onClick={handleAddSubtask}
                    className="px-[16px] py-[10px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-bold hover:bg-[#303030] transition-colors">OK</button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-[#f0f0f0] flex px-6 shrink-0">
              <Tab id="comments" label="Коментарі" icon={MessageSquare} active={activeTab === 'comments'} onClick={setActiveTab} badge={comments.length} />
              <Tab id="timelogs" label="Тайм-логи" icon={Clock} active={activeTab === 'timelogs'} onClick={setActiveTab} badge={timeLogs.length} />
              <Tab id="links" label="Залежності" icon={Link} active={activeTab === 'links'} onClick={setActiveTab} badge={links.length} />
              <Tab id="history"  label="Історія"   icon={History}       active={activeTab === 'history'}  onClick={setActiveTab} badge={0} />
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {activeTab === 'comments' && (
                <div className="flex flex-col gap-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <UserAvatar user={{ name: c.authorName, avatar: c.authorAvatar }} size={28} className="shrink-0 mt-[2px]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-[3px]">
                          <span className="text-[12px] font-bold text-[#1f1f1f]">{c.authorName}</span>
                          <span className="text-[10px] text-[#9a9a9a]">
                            {c.createdAt?.toDate?.()?.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[13px] text-[#1f1f1f] leading-relaxed bg-[#f7f7f7] rounded-[12px] px-3 py-2">
                          <CommentText text={c.text} members={members} />
                        </p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-[12px] text-[#cfcfcf] text-center py-4">Коментарів ще немає</p>
                  )}
                  {/* Comment input */}
                  <div className="flex gap-3 mt-2">
                    <UserAvatar user={currentUser} size={28} className="shrink-0 mt-[2px]" />
                    <div className="flex-1 flex gap-2">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                        placeholder="Написати коментар... (Enter — відправити)"
                        rows={2}
                        className="flex-1 px-[14px] py-[10px] bg-[#f7f7f7] rounded-[12px] text-[12px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-transparent focus:border-[#1f1f1f] transition-colors resize-none"
                      />
                      <button onClick={handleComment}
                        disabled={!commentText.trim()}
                        className="px-[16px] py-[10px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-bold disabled:opacity-40 hover:bg-[#303030] transition-colors">
                        ↩
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timelogs' && (
                <div className="flex flex-col gap-2">
                  {timeLogs.map(log => {
                    const user = members.find(m => (m.id || m.uid) === log.userId);
                    const isOwnLog = log.userId === (currentUser?.id || currentUser?.uid);
                    return (
                      <div key={log.id} className="flex items-center gap-3 py-2 border-b border-[#f7f7f7] group">
                        <UserAvatar user={user || { name: log.userId }} size={24} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#1f1f1f]">{formatTime(log.spentMinutes)}</p>
                          <p className="text-[11px] text-[#9a9a9a] truncate">{log.description || '—'}</p>
                        </div>
                        <span className="text-[10px] text-[#9a9a9a] shrink-0">
                          {log.loggedAt?.toDate?.()?.toLocaleDateString('uk-UA')}
                        </span>
                        {(isOwnLog || orgRole === 'owner') && onDeleteTimeLog && (
                          <button
                            onClick={() => onDeleteTimeLog(log.id)}
                            className="p-[4px] text-[#cfcfcf] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Видалити"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {timeLogs.length === 0 && (
                    <p className="text-[12px] text-[#cfcfcf] text-center py-4">Час ще не списано</p>
                  )}
                </div>
              )}

              {activeTab === 'links' && (
                <DependenciesPanel
                  issue={issue}
                  links={links}
                  onAddLink={(sourceId, targetId, relationType) =>
                    addLink(sourceId, targetId, relationType, currentUser?.id || currentUser?.uid)
                  }
                  onRemoveLink={removeLink}
                />
              )}

              {activeTab === 'history' && (
                <div className="flex flex-col gap-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 py-[6px] border-b border-[#f7f7f7]">
                      <div className="w-[6px] h-[6px] rounded-full bg-[#e9e9e9] mt-[6px] shrink-0" />
                      <div>
                        <p className="text-[12px] text-[#1f1f1f]">
                          <span className="font-semibold">{log.userName || 'Хтось'}</span>
                          {' '}{log.action === 'status_changed' ? `переніс ${log.from} → ${log.to}` : log.action}
                        </p>
                        <p className="text-[10px] text-[#9a9a9a]">
                          {log.createdAt?.toDate?.()?.toLocaleString('uk-UA')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-[12px] text-[#cfcfcf] text-center py-4">Історія порожня</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar — 30% */}
          <div className="w-[260px] shrink-0 border-l border-[#f0f0f0] overflow-y-auto bg-[#fafafa] px-4 py-5 flex flex-col gap-5">

            {/* Type */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Тип</p>
              <Select
                value={issue.type || 'task'}
                onChange={val => onUpdate({ type: val })}
                options={TYPES.map(t => ({ value: t.id, label: t.label }))}
              />
            </div>

            {/* Sprint */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Спринт</p>
              <Select
                value={issue.sprintId || ''}
                onChange={val => onUpdate({ sprintId: val || null })}
                options={[
                  { value: '', label: 'Backlog (без спринта)' },
                  ...sprints.map(s => ({ value: s.id, label: s.name }))
                ]}
              />
            </div>

            {/* Epic */}
            <EpicsPanel
              issue={issue}
              epics={allIssues.filter(i => i.type === 'epic')}
              allIssues={allIssues}
              onUpdateEpic={(_, epicId) => onUpdate({ parentEpicId: epicId || null })}
              onCreateEpic={async (title) => {
                const { activeOrgId, currentUser } = useAppContext();
                await addDoc(collection(db, 'issues'), {
                  organizationId: activeOrgId,
                  projectId: issue.projectId,
                  issueKey: `${issue.issueKey?.split('-')[0]}-${Date.now()}`,
                  title,
                  type: 'epic',
                  priority: 'medium',
                  columnId: 'backlog',
                  assigneeIds: [],
                  createdAt: serverTimestamp(),
                  createdBy: currentUser?.id || currentUser?.uid
                });
              }}
            />

            {/* Priority */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Пріоритет</p>
              <Select
                value={issue.priority || 'medium'}
                onChange={val => onUpdate({ priority: val })}
                options={PRIORITIES.map(p => ({ value: p.id, label: p.label }))}
              />
            </div>

            {/* Assignees */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Виконавці</p>
              <div className="flex flex-col gap-[5px]">
                {members.map(m => {
                  const uid = m.id || m.uid;
                  const active = (issue.assigneeIds || []).includes(uid);
                  return (
                    <button key={uid} onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-2 px-2 py-[5px] rounded-[12px] text-[11px] font-medium transition-all ${
                        active ? 'bg-[#1f1f1f] text-white' : 'bg-[#f7f7f7] text-[#1f1f1f] hover:bg-[#f0f0f0] border border-transparent'
                      }`}>
                      <UserAvatar user={m} size={18} />
                      <span className="truncate">{m.name || m.email}</span>
                    </button>
                  );
                })}
                {members.length === 0 && (
                  <p className="text-[11px] text-[#cfcfcf]">Немає учасників в проєкті</p>
                )}
              </div>
            </div>

            {/* Due date */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Дедлайн</p>
              <input type="date"
                value={due ? due.toISOString().split('T')[0] : ''}
                onChange={e => onUpdate({ dueDate: e.target.value ? new Date(e.target.value) : null })}
                className={`w-full px-[14px] py-[10px] rounded-[12px] text-[12px] font-medium border bg-[#f7f7f7] cursor-pointer focus:border-[#1f1f1f] transition-colors ${
                  isOverdue ? 'border-red-500 text-red-500' : 'border-transparent text-[#1f1f1f]'
                }`}
              />
            </div>

            {/* Estimate */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Оцінка (год)</p>
              <input type="number" min="0" step="0.5"
                value={issue.estimateMinutes ? issue.estimateMinutes / 60 : ''}
                onChange={e => onUpdate({ estimateMinutes: Math.round(parseFloat(e.target.value || 0) * 60) })}
                placeholder="0"
                className="w-full px-[14px] py-[10px] rounded-[12px] text-[12px] font-medium border border-transparent bg-[#f7f7f7] text-[#1f1f1f] focus:border-[#1f1f1f] transition-all"
              />
            </div>

            {/* Story Points */}
            <div>
              <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Story Points</p>
              <input type="number" min="0" step="1"
                value={issue.storyPoints || ''}
                onChange={e => onUpdate({ storyPoints: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="0"
                className="w-full px-[14px] py-[10px] rounded-[12px] text-[12px] font-medium border border-transparent bg-[#f7f7f7] text-[#1f1f1f] focus:border-[#1f1f1f] transition-all"
              />
            </div>

            {/* Time Tracker */}
            <TimeTracker
              issue={issue}
              userId={currentUser?.id || currentUser?.uid}
              onLogTime={(minutes, description) => onLogTime(minutes, description)}
            />

            {/* Client integration */}
            {issue.linkedClientMaterialId && (
              <div className="bg-[#f0f4ff] border border-[#c7d7fc] rounded-[12px] p-3">
                <p className="text-[10px] font-bold text-[#4f46e5] uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Link size={10} /> Клієнтський матеріал
                </p>
                <p className="text-[11px] text-[#4f46e5] font-medium truncate mb-2">
                  ID: {issue.linkedClientMaterialId}
                </p>
                <a href={`/stages/${issue.linkedClientMaterialId}`} target="_blank" rel="noopener"
                  className="flex items-center gap-1 text-[11px] text-[#4f46e5] hover:underline font-medium">
                  <ExternalLink size={10} /> Відкрити в порталі
                </a>
              </div>
            )}

            {/* Delete */}
            {can(orgRole, 'delete:issue') && (
              <div className="mt-auto pt-3 border-t border-[#f0f0f0]">
                <button onClick={() => { if (confirm('Видалити задачу?')) { onDelete(); onClose(); } }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-[12px] text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={12} /> Видалити задачу
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
