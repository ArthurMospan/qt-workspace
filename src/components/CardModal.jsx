'use client';
// src/components/CardModal.jsx — Trello-style full card detail modal
import { useState } from 'react';
import { X, Trash2, CheckSquare, Square, Plus, Clock, User } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import UserAvatar from './UserAvatar';
import { Select } from '@/components/ui/Select';

const STATUSES = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'В роботі' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Готово' },
];

const PRIORITIES = [
  { id: 'low',      label: 'Низький',   color: '#9a9a9a' },
  { id: 'medium',   label: 'Середній',  color: '#eab308' },
  { id: 'high',     label: 'Високий',   color: '#f97316' },
  { id: 'critical', label: 'Критичний', color: '#ef4444' },
];

export default function CardModal({ task, members, onClose, onUpdate, onDelete }) {
  const { currentUser } = useAppContext();
  const [subtaskInput, setSubtaskInput] = useState('');
  const [showSubInput, setShowSubInput] = useState(false);

  if (!task) return null;

  const update = (patch) => onUpdate(task.id, patch);

  const due = task.dueDate?.toDate ? task.dueDate.toDate()
    : task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== 'done';

  const subtasksDone = (task.subtasks || []).filter(s => s.done).length;
  const subtasksAll  = (task.subtasks || []).length;

  const toggleAssignee = (uid) => {
    const cur = task.assignees || [];
    update({ assignees: cur.includes(uid) ? cur.filter(a => a !== uid) : [...cur, uid] });
  };

  const toggleSubtask = (i) => {
    const subs = [...(task.subtasks || [])];
    subs[i] = { ...subs[i], done: !subs[i].done };
    update({ subtasks: subs });
  };

  const addSubtask = () => {
    if (!subtaskInput.trim()) return;
    const subs = [...(task.subtasks || []), { title: subtaskInput.trim(), done: false }];
    update({ subtasks: subs });
    setSubtaskInput('');
    setShowSubInput(false);
  };

  const assignees = (task.assignees || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px] px-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative bg-white rounded-[20px] shadow-2xl w-full max-w-[680px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#f0f0f0] shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              {/* Editable title */}
              <textarea
                defaultValue={task.title}
                onBlur={e => { if (e.target.value.trim() !== task.title) update({ title: e.target.value.trim() }); }}
                rows={1}
                className="w-full text-[18px] font-bold text-[#1f1f1f] resize-none bg-transparent focus:bg-[#f7f7f7] rounded-[8px] px-2 py-1 -mx-2 transition-colors"
                style={{ minHeight: 32, fieldSizing: 'content' }}
              />
              <div className="flex items-center gap-2 mt-2 px-2">
                {/* Status pill */}
                <div className="w-[120px]">
                  <Select
                    value={task.status}
                    onChange={val => update({ status: val })}
                    options={STATUSES.map(s => ({ value: s.id, label: s.label }))}
                  />
                </div>
                {/* Priority pill */}
                <div className="w-[120px]">
                  <Select
                    value={task.priority || 'low'}
                    onChange={val => update({ priority: val })}
                    options={PRIORITIES.map(p => ({ value: p.id, label: p.label, dotColor: p.color }))}
                  />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors shrink-0 mt-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — main content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
            {/* Description */}
            <div>
              <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-2">Опис</label>
              <textarea
                defaultValue={task.description || ''}
                onBlur={e => { if (e.target.value !== (task.description || '')) update({ description: e.target.value }); }}
                placeholder="Додай опис..."
                rows={3}
                className="w-full px-3 py-2 bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-transparent focus:border-[#e9e9e9] resize-none transition-colors"
              />
            </div>

            {/* Subtasks */}
            {(subtasksAll > 0 || showSubInput) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide">
                    Чеклист {subtasksAll > 0 && `(${subtasksDone}/${subtasksAll})`}
                  </label>
                </div>
                {subtasksAll > 0 && (
                  <div className="h-[3px] bg-[#f0f0f0] rounded-full mb-3 overflow-hidden">
                    <div className="h-full bg-[#1f1f1f] rounded-full transition-all"
                      style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
                  </div>
                )}
                <div className="flex flex-col gap-[6px]">
                  {(task.subtasks || []).map((s, i) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer group">
                      <button onClick={() => toggleSubtask(i)}
                        className="shrink-0 text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
                        {s.done
                          ? <CheckSquare size={15} className="text-[#1f1f1f]" />
                          : <Square size={15} />}
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
                      onKeyDown={e => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') setShowSubInput(false); }}
                      placeholder="Пункт чеклиста..."
                      className="flex-1 px-3 py-[7px] bg-[#f7f7f7] rounded-[8px] text-[12px] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors text-[#1f1f1f]"
                    />
                    <button onClick={addSubtask}
                      className="px-3 py-[7px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold">
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — sidebar actions */}
          <div className="w-[200px] shrink-0 bg-[#f7f7f7] px-4 py-5 flex flex-col gap-4 border-l border-[#f0f0f0]">
            {/* Assignees */}
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Виконавці</p>
              <div className="flex flex-col gap-[6px]">
                {members.map(m => {
                  const uid = m.id || m.uid;
                  const active = (task.assignees || []).includes(uid);
                  return (
                    <button key={uid} onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-2 px-2 py-[5px] rounded-[8px] text-[11px] font-medium transition-all ${
                        active ? 'bg-[#1f1f1f] text-white' : 'bg-white text-[#1f1f1f] hover:bg-[#e9e9e9]'
                      }`}>
                      <UserAvatar user={m} size={18} />
                      <span className="truncate">{m.name || m.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due date */}
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Дедлайн</p>
              <input type="date"
                value={due ? due.toISOString().split('T')[0] : ''}
                onChange={e => update({ dueDate: e.target.value ? new Date(e.target.value) : null })}
                className={`w-full px-2 py-[6px] rounded-[8px] text-[11px] font-medium border bg-white transition-colors ${
                  isOverdue ? 'border-red-300 text-red-500' : 'border-[#e9e9e9] text-[#1f1f1f]'
                }`}
              />
              {isOverdue && <p className="text-[10px] text-red-500 mt-1">Прострочено</p>}
            </div>

            {/* Checklist */}
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Дії</p>
              <button onClick={() => setShowSubInput(true)}
                className="w-full flex items-center gap-2 px-2 py-[6px] bg-white rounded-[8px] text-[11px] font-medium text-[#1f1f1f] hover:bg-[#e9e9e9] transition-colors border border-[#e9e9e9]">
                <CheckSquare size={12} /> Чеклист
              </button>
            </div>

            {/* Delete */}
            <div className="mt-auto">
              <button onClick={() => { onDelete(task.id); onClose(); }}
                className="w-full flex items-center gap-2 px-2 py-[6px] bg-white rounded-[8px] text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors border border-[#e9e9e9]">
                <Trash2 size={12} /> Видалити
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
