'use client';
// src/components/CreateTaskModal.jsx — Light theme modal
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { X, CheckSquare } from 'lucide-react';
import UserAvatar from './UserAvatar';
import MarkdownEditor from './MarkdownEditor';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { Select } from '@/components/ui/Select';

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

export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers = [], projects = null, sprints = [] }) {
  const { currentUser } = useAppContext();
  const { labels: availableLabels = [] } = useWorkflowConfig();
  const statuses = stages?.length ? stages : DEFAULT_STATUSES;

  const [form, setForm] = useState({
    title: '', description: '', status: 'todo',
    priority: 'medium', type: 'task',
    assignees: [], labelIds: [], dueDate: '',
    parentEpicId: '', estimateHours: '',
    projectId: projects && projects.length > 0 ? projects[0].id : '',
    sprintId: ''
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

  const toggleLabel = (labelId) => {
    set('labelIds', form.labelIds.includes(labelId)
      ? form.labelIds.filter(id => id !== labelId)
      : [...form.labelIds, labelId]);
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
        estimateMinutes: form.estimateHours ? Math.round(parseFloat(form.estimateHours) * 60) : 0,
        parentEpicId: form.parentEpicId || null,
        sprintId: form.sprintId || null
      });
      setForm({ title: '', description: '', status: 'todo', priority: 'medium', type: 'task', assignees: [], dueDate: '', labelIds: [], parentEpicId: '', estimateHours: '', projectId: '', sprintId: '' });
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
      <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[520px] mx-4 overflow-hidden">
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
              className="w-full px-4 py-3 bg-[#f7f7f7] rounded-[12px] text-[14px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-[#e9e9e9] focus:bg-white focus:border-[#1f1f1f] focus:ring-1 focus:ring-[#1f1f1f] transition-all shadow-sm"
            />
          </div>

          {/* Project Selector (if projects passed) */}
          {projects && projects.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Проєкт *</label>
              <Select
                value={form.projectId}
                onChange={val => set('projectId', val)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Оберіть проєкт..."
              />
            </div>
          )}

          {/* Sprint Selector */}
          {sprints && sprints.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Спринт</label>
              <Select
                value={form.sprintId}
                onChange={val => set('sprintId', val)}
                options={[
                  { value: '', label: 'Без спринта (Беклог)' },
                  ...sprints.map(s => ({ value: s.id, label: s.name }))
                ]}
                placeholder="Оберіть спринт..."
              />
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-bold text-[#1f1f1f] pl-1">Опис задачі</label>
            <MarkdownEditor 
              value={form.description}
              onChange={(val) => set('description', val)}
              placeholder="Додайте деталі, чеклісти, посилання..."
              minHeight="120px"
            />
          </div>

          {/* Row: Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Тип</label>
              <Select
                value={form.type}
                onChange={val => set('type', val)}
                options={TYPES}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Пріоритет</label>
              <Select
                value={form.priority}
                onChange={val => set('priority', val)}
                options={PRIORITIES}
              />
            </div>
          </div>

          {/* Row: Status + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Статус</label>
              <Select
                value={form.status}
                onChange={val => set('status', val)}
                options={statuses.map(s => ({ value: s.id, label: s.label }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Дедлайн</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                className="w-full px-3 py-[10px] bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:bg-white focus:border-[#1f1f1f] focus:ring-1 focus:ring-[#1f1f1f] transition-all shadow-sm cursor-pointer"
              />
            </div>
          </div>

          {/* Row: Epic + Estimate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Епік (Батьківська)</label>
              <Select
                value={form.parentEpicId}
                onChange={val => set('parentEpicId', val)}
                options={[
                  { value: '', label: 'Без епіка' },
                  ...(typeof epics !== 'undefined' ? epics : []).map(e => ({ value: e.id, label: e.title }))
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Оцінка (год)</label>
              <input
                type="number" min="0" step="0.5"
                value={form.estimateHours}
                onChange={e => set('estimateHours', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-[10px] bg-[#f7f7f7] rounded-[10px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:bg-white focus:border-[#1f1f1f] focus:ring-1 focus:ring-[#1f1f1f] transition-all shadow-sm"
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
                      className={`flex items-center gap-2 px-3 py-[6px] rounded-[20px] text-[12px] font-medium border transition-all ${
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

          {/* Labels */}
          {availableLabels.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">Мітки (Теги)</label>
              <div className="flex flex-wrap gap-2">
                {availableLabels.map(l => {
                  const selected = form.labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={`flex items-center gap-[6px] px-[10px] py-[5px] rounded-[20px] text-[11px] font-bold border transition-all ${
                        selected
                          ? 'border-transparent'
                          : 'border-[#e9e9e9] bg-white opacity-60 hover:opacity-100'
                      }`}
                      style={selected ? { background: l.color + '18', color: l.color } : { color: '#9a9a9a' }}
                    >
                      {selected && <CheckSquare size={12} />}
                      <span className="w-[6px] h-[6px] rounded-[20px] shrink-0" style={{ background: l.color }} />
                      {l.label}
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
            className="w-full py-[14px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-bold hover:bg-[#303030] disabled:opacity-40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] mt-2 shadow-md hover:shadow-lg"
          >
            {loading ? 'Створення...' : 'Створити задачу'}
          </button>
        </form>
      </div>
    </div>
  );
}
