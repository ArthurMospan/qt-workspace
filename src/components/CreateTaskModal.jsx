'use client';
// src/components/CreateTaskModal.jsx — Light theme modal
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { X, ChevronDown } from 'lucide-react';
import UserAvatar from './UserAvatar';

const PRIORITIES = [
  { value: 'low',      label: 'Низький' },
  { value: 'medium',   label: 'Середній' },
  { value: 'high',     label: 'Високий' },
  { value: 'critical', label: 'Критичний' },
];

const TYPES = [
  { value: 'task',    label: 'Задача' },
  { value: 'bug',     label: 'Баг' },
  { value: 'feature', label: 'Фіча' },
  { value: 'request', label: 'Запит' },
];

const DEFAULT_STATUSES = [
  { id: 'todo',        label: 'Backlog' },
  { id: 'in-progress', label: 'В роботі' },
  { id: 'review',      label: 'Перевірка' },
  { id: 'done',        label: 'Готово' },
];

export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers = [] }) {
  const { currentUser } = useAppContext();
  const statuses = stages?.length ? stages : DEFAULT_STATUSES;

  const [form, setForm] = useState({
    title: '', description: '', status: 'todo',
    priority: 'medium', type: 'task',
    assignees: [], dueDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleAssignee = (uid) => {
    set('assignees', form.assignees.includes(uid)
      ? form.assignees.filter(a => a !== uid)
      : [...form.assignees, uid]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        ...form,
        createdBy: currentUser?.id || currentUser?.uid,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
      });
      setForm({ title: '', description: '', status: 'todo', priority: 'medium', type: 'task', assignees: [], dueDate: '' });
      onClose();
    } catch (err) {
      console.error('[CreateTask]', err);
      setError(err?.message || 'Помилка створення задачі. Перевір консоль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-[20px] shadow-xl w-full max-w-[520px] mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e9e9e9]">
          <h2 className="text-[16px] font-bold text-[#1f1f1f]">Нова задача</h2>
          <button onClick={onClose} className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Назва *</label>
            <input
              autoFocus
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Що потрібно зробити?"
              className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[10px] text-[14px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Опис</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Деталі задачі..."
              rows={3}
              className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors resize-none"
            />
          </div>

          {/* Row: Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Тип</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full px-3 py-[10px] bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors"
              >
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Пріоритет</label>
              <select
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
                className="w-full px-3 py-[10px] bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors"
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Status + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Статус</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-[10px] bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors"
              >
                {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Дедлайн</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                className="w-full px-3 py-[10px] bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors"
              />
            </div>
          </div>

          {/* Assignees */}
          {teamMembers.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Виконавці</label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => {
                  const uid = m.uid || m.id;
                  const selected = form.assignees.includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-2 px-3 py-[6px] rounded-full text-[12px] font-medium border transition-all ${
                        selected
                          ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                          : 'bg-white text-[#1f1f1f] border-[#e9e9e9] hover:border-[#9a9a9a]'
                      }`}
                    >
                      <UserAvatar user={m} size={18} />
                      {m.name || m.email}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-[12px] bg-red-50 border border-red-200 rounded-[8px] px-4 py-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!form.title.trim() || loading}
            className="w-full py-[13px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-bold hover:bg-[#303030] disabled:opacity-40 transition-all mt-1"
          >
            {loading ? 'Створення...' : 'Створити задачу'}
          </button>
        </form>
      </div>
    </div>
  );
}
