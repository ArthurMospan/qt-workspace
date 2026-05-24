'use client';
// src/components/TaskDetailPanel.jsx
import { useState } from 'react';
import UserAvatar from './UserAvatar';
import TaskInternalChat from './TaskInternalChat';
import ClientProjectViewer from './ClientProjectViewer';

const PRIORITY = {
  urgent: { label: 'Терміново', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' },
  high:   { label: 'Високий',   color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  medium: { label: 'Середній',  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  low:    { label: 'Низький',   color: 'text-white/35',   bg: 'bg-white/5 border-white/10' },
};
const STATUS = {
  'todo':        { label: 'До виконання', color: 'text-white/45' },
  'in-progress': { label: 'В роботі',     color: 'text-blue-400' },
  'review':      { label: 'На перевірці', color: 'text-yellow-400' },
  'done':        { label: 'Готово',       color: 'text-green-400' },
};
const TABS = [
  { id: 'chat',      label: '💬 Чат' },
  { id: 'materials', label: '📂 Матеріали' },
];
const STATUSES = [
  { value: 'todo', label: 'До виконання' },
  { value: 'in-progress', label: 'В роботі' },
  { value: 'review', label: 'На перевірці' },
  { value: 'done', label: 'Готово' },
];

export default function TaskDetailPanel({ task, stages, teamMembers, onUpdate, onDelete }) {
  const [tab, setTab] = useState('chat');
  if (!task) return null;

  const p = PRIORITY[task.priority] || PRIORITY.medium;
  const s = STATUS[task.status] || STATUS['todo'];
  const assignees = (task.assignees || []).map(uid => teamMembers?.find(m => m.id === uid)).filter(Boolean);
  const linkedStage = stages?.find(st => st.id === task.stageId);

  return (
    <div className="flex flex-col h-full bg-[#161616] overflow-hidden">
      {/* Header */}
      <div className="px-[22px] pt-[20px] pb-[16px] border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-[8px] mb-[10px]">
          <span className={`text-[10px] font-bold uppercase tracking-[0.07em] px-[7px] py-[3px] rounded-full border ${p.bg} ${p.color}`}>{p.label}</span>
          <span className={`text-[11px] font-semibold ${s.color}`}>· {s.label}</span>
        </div>
        <h2 className="text-white text-[17px] font-bold leading-snug mb-[6px]">{task.title}</h2>
        {task.description && <p className="text-white/40 text-[12px] leading-relaxed">{task.description}</p>}
      </div>

      {/* Meta */}
      <div className="px-[22px] py-[14px] border-b border-white/[0.06] flex flex-col gap-[10px] shrink-0">
        <Row label="Виконавці">
          {assignees.length > 0 ? (
            <div className="flex items-center gap-[5px]">
              {assignees.map(u => (
                <div key={u.id} className="flex items-center gap-[5px]">
                  <UserAvatar user={u} className="w-[20px] h-[20px]" />
                  <span className="text-white/60 text-[11px]">{u.name}</span>
                </div>
              ))}
            </div>
          ) : <span className="text-white/25 text-[11px]">Не призначено</span>}
        </Row>

        {linkedStage && (
          <Row label="Етап">
            <span className="text-white/55 text-[11px] bg-white/[0.05] px-[7px] py-[2px] rounded-full border border-white/[0.07]">
              {linkedStage.label?.replace(/^\d+\.\s*/, '')}
            </span>
          </Row>
        )}

        {task.dueDate && (
          <Row label="Дедлайн">
            <span className="text-white/55 text-[11px]">{formatDate(task.dueDate)}</span>
          </Row>
        )}

        {/* Quick actions */}
        <div className="flex gap-[6px] pt-[2px]">
          <select value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value })}
            className="flex-1 bg-white/[0.05] border border-white/[0.07] rounded-[8px] px-[8px] py-[5px] text-white/60 text-[11px] cursor-pointer appearance-none hover:border-white/15 transition-all">
            {STATUSES.map(st => <option key={st.value} value={st.value} className="bg-[#1a1a1a]">{st.label}</option>)}
          </select>
          <button onClick={() => onDelete(task.id)}
            className="flex items-center gap-[4px] px-[9px] py-[5px] rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] hover:bg-red-500/20 transition-all">
            🗑
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] px-[22px] shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-[11px] px-[4px] mr-[18px] text-[11px] font-semibold border-b-[2px] transition-all ${
              tab === t.id ? 'text-white border-white' : 'text-white/25 border-transparent hover:text-white/50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden px-[22px] py-[14px]">
        {tab === 'chat' && <TaskInternalChat taskId={task.id} />}
        {tab === 'materials' && <ClientProjectViewer projectId={task.projectId} stageId={task.stageId} stages={stages} />}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-[10px]">
      <span className="text-white/20 text-[10px] font-medium w-[80px] shrink-0">{label}</span>
      {children}
    </div>
  );
}

function formatDate(d) {
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString('uk', { day: 'numeric', month: 'long', year: 'numeric' });
}
