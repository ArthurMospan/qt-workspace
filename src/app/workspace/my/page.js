'use client';
// src/app/workspace/my/page.js — My Tasks: Jira-style "My Work"
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useStore } from '@/store/useStore';
import Link from 'next/link';
import { Clock, AlertTriangle, CheckCircle2, Circle, ArrowRight } from 'lucide-react';

const STATUS_CONFIG = {
  'todo':        { label: 'Backlog',    color: '#9a9a9a', icon: Circle },
  'in-progress': { label: 'В роботі',  color: '#6366f1', icon: Clock },
  'review':      { label: 'Перевірка', color: '#f97316', icon: Clock },
  'done':        { label: 'Готово',    color: '#10b981', icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  critical: { label: 'Критичний', color: '#ef4444' },
  high:     { label: 'Високий',   color: '#f97316' },
  medium:   { label: 'Середній',  color: '#eab308' },
  low:      { label: 'Низький',   color: '#9a9a9a' },
};

const FILTERS = [
  { id: 'all',      label: 'Всі' },
  { id: 'today',    label: 'Сьогодні' },
  { id: 'week',     label: 'Цей тиждень' },
  { id: 'overdue',  label: 'Прострочені' },
  { id: 'done',     label: 'Виконані' },
];

function filterTasks(tasks, filter) {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

  return tasks.filter(t => {
    if (filter === 'done') return t.status === 'done';
    if (t.status === 'done' && filter !== 'done') return false; // hide done from other filters
    const due = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate ? new Date(t.dueDate) : null;
    if (filter === 'today')   return due && due <= todayEnd;
    if (filter === 'week')    return due && due <= weekEnd;
    if (filter === 'overdue') return due && due < now;
    return true;
  });
}

function TaskRow({ task, projects, onStatusChange }) {
  const project = projects?.find(p => p.id === task.projectId);
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low;
  const StatusIcon = status.icon;

  const due = task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== 'done';
  const formatDate = d => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

  const nextStatus = {
    'todo': 'in-progress',
    'in-progress': 'review',
    'review': 'done',
    'done': 'todo',
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-[#fafafa] border-b border-[#f0f0f0] last:border-0 group transition-colors">
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(task.id, nextStatus[task.status])}
        title={`Змінити на: ${STATUS_CONFIG[nextStatus[task.status]]?.label}`}
        className="shrink-0 hover:scale-110 transition-transform"
      >
        <StatusIcon size={16} style={{ color: status.color }} />
      </button>

      {/* Title + project */}
      <div className="flex-1 min-w-0">
        <Link href={`/workspace/${task.projectId}`}
          className="text-[13px] font-semibold text-[#1f1f1f] hover:text-[#6366f1] transition-colors truncate block">
          {task.title}
        </Link>
        {project && (
          <p className="text-[11px] text-[#9a9a9a] mt-[1px] truncate">{project.name}</p>
        )}
      </div>

      {/* Priority */}
      <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full shrink-0" style={{ color: priority.color, background: priority.color + '18' }}>
        {priority.label}
      </span>

      {/* Due date */}
      {due && (
        <div className={`flex items-center gap-[4px] text-[11px] font-medium shrink-0 ${isOverdue ? 'text-red-500' : 'text-[#9a9a9a]'}`}>
          {isOverdue && <AlertTriangle size={11} />}
          {formatDate(due)}
        </div>
      )}

      {/* Open arrow */}
      <Link href={`/workspace/${task.projectId}`}
        className="shrink-0 text-[#e9e9e9] group-hover:text-[#9a9a9a] transition-colors">
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function Section({ title, tasks, projects, onStatusChange, emptyText }) {
  if (tasks.length === 0) return (
    <div className="bg-white border border-[#e9e9e9] rounded-[14px] mb-4">
      <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[#1f1f1f]">{title}</h3>
        <span className="text-[11px] font-semibold text-[#cfcfcf] bg-[#f7f7f7] px-2 py-[2px] rounded-full">0</span>
      </div>
      <div className="px-5 py-6 text-center text-[12px] text-[#cfcfcf]">{emptyText}</div>
    </div>
  );

  return (
    <div className="bg-white border border-[#e9e9e9] rounded-[14px] mb-4 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[#1f1f1f]">{title}</h3>
        <span className="text-[11px] font-semibold text-[#9a9a9a] bg-[#f7f7f7] px-2 py-[2px] rounded-full">{tasks.length}</span>
      </div>
      {tasks.map(t => <TaskRow key={t.id} task={t} projects={projects} onStatusChange={onStatusChange} />)}
    </div>
  );
}

export default function MyTasksPage() {
  const { currentUser, projects } = useAppContext();
  const { tasks, loading, updateTask } = useAllMyTasks(currentUser?.uid);
  const showToast = useStore(s => s.showToast);
  const [filter, setFilter] = useState('all');

  const handleStatusChange = async (taskId, newStatus) => {
    await updateTask(taskId, { status: newStatus });
    showToast('Статус оновлено ✓');
  };

  const filtered = filterTasks(tasks, filter);
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const overdue = filtered.filter(t => {
    const due = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate ? new Date(t.dueDate) : null;
    return due && due < now && t.status !== 'done';
  });
  const today = filtered.filter(t => {
    const due = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate ? new Date(t.dueDate) : null;
    return due && due >= now && due <= todayEnd;
  });
  const upcoming = filtered.filter(t => {
    const due = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate ? new Date(t.dueDate) : null;
    const overdueFl = due && due < now;
    const todayFl   = due && due >= now && due <= todayEnd;
    return !overdueFl && !todayFl && t.status !== 'done';
  });
  const done = filtered.filter(t => t.status === 'done');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 shrink-0">
        <h1 className="text-[#1f1f1f] text-[22px] font-bold">Мої задачі</h1>
        <p className="text-[#9a9a9a] text-[13px] mt-1">{tasks.filter(t => t.status !== 'done').length} активних</p>
      </div>

      {/* Filter tabs */}
      <div className="px-8 pb-4 flex items-center gap-2 shrink-0">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-[6px] rounded-full text-[12px] font-semibold transition-all ${
              filter === f.id
                ? 'bg-[#1f1f1f] text-white'
                : 'bg-white text-[#9a9a9a] border border-[#e9e9e9] hover:border-[#9a9a9a] hover:text-[#1f1f1f]'
            }`}>
            {f.label}
            {f.id === 'overdue' && overdue.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[9px] font-bold px-[5px] py-[1px] rounded-full">{overdue.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : filter === 'all' ? (
          <>
            <Section title="🔴 Прострочено" tasks={overdue} projects={projects} onStatusChange={handleStatusChange} emptyText="Немає прострочених задач" />
            <Section title="📅 Сьогодні" tasks={today} projects={projects} onStatusChange={handleStatusChange} emptyText="Немає задач на сьогодні" />
            <Section title="📋 Заплановано" tasks={upcoming} projects={projects} onStatusChange={handleStatusChange} emptyText="Немає запланованих задач" />
            <Section title="✅ Виконано" tasks={done} projects={projects} onStatusChange={handleStatusChange} emptyText="Немає виконаних задач" />
          </>
        ) : (
          <div className="bg-white border border-[#e9e9e9] rounded-[14px] overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-[#cfcfcf] text-[13px]">Немає задач у цій категорії</div>
            ) : (
              filtered.map(t => <TaskRow key={t.id} task={t} projects={projects} onStatusChange={handleStatusChange} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
