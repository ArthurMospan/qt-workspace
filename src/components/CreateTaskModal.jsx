'use client';
// src/components/CreateTaskModal.jsx
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import UserAvatar from './UserAvatar';

const PRIORITIES = [
  { value: 'urgent', label: '🔴 Терміново' },
  { value: 'high',   label: '🟠 Високий' },
  { value: 'medium', label: '🟡 Середній' },
  { value: 'low',    label: '⚪ Низький' },
];
const STATUSES = [
  { value: 'todo',        label: 'До виконання' },
  { value: 'in-progress', label: 'В роботі' },
  { value: 'review',      label: 'На перевірці' },
  { value: 'done',        label: 'Готово' },
];

export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers }) {
  const { currentUser } = useAppContext();
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', status: 'todo', stageId: '', assignees: [], dueDate: '' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleAssignee = uid => set('assignees', form.assignees.includes(uid)
    ? form.assignees.filter(id => id !== uid)
    : [...form.assignees, uid]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ ...form, createdBy: currentUser.id, dueDate: form.dueDate ? new Date(form.dueDate) : null });
      setForm({ title: '', description: '', priority: 'medium', status: 'todo', stageId: '', assignees: [], dueDate: '' });
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px]" />
      <div className="relative z-10 bg-[#1a1a1a] border border-white/[0.1] rounded-[22px] w-full max-w-[520px] mx-[16px] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] pt-[22px] pb-[18px] border-b border-white/[0.07]">
          <h2 className="text-white text-[16px] font-bold">Нова задача</h2>
          <button onClick={onClose} className="w-[28px] h-[28px] rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white transition-all">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-[24px] py-[20px] flex flex-col gap-[14px]">
          {/* Title */}
          <div>
            <label className="text-white/40 text-[10px] font-bold uppercase tracking-[0.08em] block mb-[6px]">Назва *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Що потрібно зробити?" required
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[10px] px-[12px] py-[9px] text-white text-[13px] placeholder-white/20 focus:border-white/20 transition-colors" />
          </div>

          {/* Description */}
          <div>
            <label className="text-white/40 text-[10px] font-bold uppercase tracking-[0.08em] block mb-[6px]">Опис</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Деталі..." rows={3}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[10px] px-[12px] py-[9px] text-white text-[12px] placeholder-white/20 focus:border-white/20 transition-colors resize-none" />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-[10px]">
            {[['Пріоритет', 'priority', PRIORITIES], ['Статус', 'status', STATUSES]].map(([label, key, opts]) => (
              <div key={key}>
                <label className="text-white/40 text-[10px] font-bold uppercase tracking-[0.08em] block mb-[6px]">{label}</label>
                <select value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[10px] px-[10px] py-[8px] text-white text-[12px] focus:border-white/20 transition-colors appearance-none cursor-pointer">
                  {opts.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Stage + Due date */}
          <div className="grid grid-cols-2 gap-[10px]">
            {stages?.length > 0 && (
              <div>
                <label className="text-white/40 text-[10px] font-bold uppercase tracking-[0.08em] block mb-[6px]">Етап клієнта</label>
                <select value={form.stageId} onChange={e => set('stageId', e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[10px] px-[10px] py-[8px] text-white text-[12px] focus:border-white/20 transition-colors appearance-none cursor-pointer">
                  <option value="" className="bg-[#1a1a1a]">Без прив'язки</option>
                  {stages.map(s => <option key={s.id} value={s.id} className="bg-[#1a1a1a]">{s.label?.replace(/^\d+\.\s*/, '')}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-white/40 text-[10px] font-bold uppercase tracking-[0.08em] block mb-[6px]">Дедлайн</label>
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[10px] px-[10px] py-[8px] text-white/70 text-[12px] focus:border-white/20 transition-colors" />
            </div>
          </div>

          {/* Assignees */}
          {teamMembers?.length > 0 && (
            <div>
              <label className="text-white/40 text-[10px] font-bold uppercase tracking-[0.08em] block mb-[8px]">Виконавці</label>
              <div className="flex flex-wrap gap-[6px]">
                {teamMembers.map(m => {
                  const sel = form.assignees.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                      className={`flex items-center gap-[6px] px-[9px] py-[4px] rounded-full border text-[11px] font-medium transition-all ${
                        sel ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/70'
                      }`}>
                      <UserAvatar user={m} className="w-[16px] h-[16px]" />
                      {m.name}
                      {sel && <span className="text-[9px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-[10px] pt-[2px]">
            <button type="button" onClick={onClose}
              className="flex-1 h-[42px] bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white rounded-[11px] text-[13px] font-medium transition-all">
              Скасувати
            </button>
            <button type="submit" disabled={!form.title.trim() || loading}
              className="flex-1 h-[42px] bg-white text-[#111] rounded-[11px] text-[13px] font-bold hover:bg-white/90 disabled:opacity-50 transition-all">
              {loading ? 'Створення...' : 'Створити'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
