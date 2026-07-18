'use client';
// src/components/CreateTaskModal.jsx — Light theme modal
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { X, Check, CheckSquare, Sparkles } from 'lucide-react';
import UserAvatar from './UserAvatar';
import MarkdownEditor from './MarkdownEditor';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fromDateInput } from '@/lib/utils/date';



export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers = [], projects = null, sprints = [], initialStatus = null, epics = [] }) {
  const { currentUser } = useAppContext();
  const router = useRouter();
  const { labels: availableLabels = [], statuses = [], types = [], priorities = [] } = useWorkflowConfig();

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

  const selectedProject = projects?.find(p => p.id === form.projectId);
  const activeHiddenCols = selectedProject?.hiddenColumns;
  const visibleStatuses = useMemo(
    () => statuses.filter(s => !(activeHiddenCols || []).includes(s.id)),
    [statuses, activeHiddenCols],
  );

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => setForm(f => ({
          ...f,
          projectId: f.projectId || projects?.[0]?.id || '',
          status: initialStatus || (visibleStatuses.some(s => s.id === 'todo') ? 'todo' : visibleStatuses[0]?.id || 'todo')
        })));
    }
  }, [isOpen, initialStatus, visibleStatuses, projects]);

  useEffect(() => {
    if (isOpen && form.status) {
      const isValid = visibleStatuses.some(s => s.id === form.status);
      if (!isValid && visibleStatuses.length > 0) {
        queueMicrotask(() => setForm(f => ({ ...f, status: visibleStatuses[0].id })));
      }
    }
  }, [form.projectId, form.status, isOpen, visibleStatuses]);

  if (!isOpen) return null;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleAssignee = (uid) => setForm(current => ({
    ...current,
    assignees: current.assignees.includes(uid)
      ? current.assignees.filter(assignee => assignee !== uid)
      : [...current.assignees, uid],
  }));

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
        dueDate: form.dueDate ? fromDateInput(form.dueDate, { endOfDay: true }) : null,
        estimateMinutes: form.estimateHours ? Math.round(parseFloat(form.estimateHours) * 60) : 0,
        parentEpicId: form.parentEpicId || null,
        sprintId: form.sprintId || null
      });
      setForm({ title: '', description: '', status: 'todo', priority: 'medium', type: 'task', assignees: [], dueDate: '', labelIds: [], parentEpicId: '', estimateHours: '', projectId: '', sprintId: '' });
      onClose();
    } catch (err) {
      console.error('[CreateTask]', err);
      setError(err?.message || 'Помилка створення завдання. Перевір консоль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — mobile: bottom sheet */}
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="relative bg-white rounded-t-[20px] sm:rounded-[16px] shadow-2xl w-full max-w-[880px] sm:mx-4 max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-[10px] bg-ink text-white flex items-center justify-center shrink-0"><CheckSquare size={17} /></span>
            <div className="min-w-0">
              <h2 id="create-task-title" className="text-[17px] font-bold text-ink">Нове завдання</h2>
              <p className="text-[11px] text-muted mt-[2px]">Заповніть основне, решту можна додати пізніше</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* ШІ-імпорт живе тут (а не в сайдбарі) — це допоміжна функція
                створення задач: із запису дзвінка → чернетки задач */}
            <Button
              style="ghost" size="sm" icon={Sparkles} type="button"
              onClick={() => {
                onClose();
                router.push(`/ai-call${form.projectId ? `?project=${form.projectId}` : ''}`);
              }}
              title="Створити задачі з запису дзвінка за допомогою ШІ"
            >
              <span className="hidden sm:inline">З дзвінка (ШІ)</span>
            </Button>
            <Button style="ghost" size="icon" icon={X} onClick={onClose} type="button" aria-label="Закрити">
              Закрити
            </Button>
          </div>
        </div>

        <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5 overflow-y-auto flex-1">
          {/* Title */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Назва *</label>
            <Input
              autoFocus
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Що потрібно зробити?"
            />
          </div>

          {/* Project Selector (if projects passed) */}
          {projects && projects.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Проєкт *</label>
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
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Спринт</label>
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
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="text-[12px] font-bold text-ink pl-1">Опис завдання</label>
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
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Тип</label>
              <Select
                value={form.type}
                onChange={val => set('type', val)}
                options={types.map(t => ({ value: t.id, label: t.label }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Пріоритет</label>
              <Select
                value={form.priority}
                onChange={val => set('priority', val)}
                options={priorities.map(p => ({ value: p.id, label: p.label }))}
              />
            </div>
          </div>

          {/* Row: Status + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Статус</label>
              <Select
                value={form.status}
                onChange={val => set('status', val)}
                options={visibleStatuses.map(s => ({ value: s.id, label: s.label }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Дедлайн</label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>
          </div>

          {/* Row: Epic + Estimate */}
          <div className="grid grid-cols-2 gap-3">
            {epics.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Епік (Батьківська)</label>
                <Select
                  value={form.parentEpicId}
                  onChange={val => set('parentEpicId', val)}
                  options={[
                    { value: '', label: 'Без епіка' },
                    ...epics.map(e => ({ value: e.id, label: e.title || e.issueKey || e.id }))
                  ]}
                />
              </div>
            )}
            <div className={epics.length > 0 ? '' : 'col-span-2'}>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Оцінка (год)</label>
              <Input
                type="number" min="0" step="0.5"
                value={form.estimateHours}
                onChange={e => set('estimateHours', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Assignees */}
          {teamMembers.length > 0 && (
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Виконавці</label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => {
                  const uid = m.uid || m.id;
                  const selected = form.assignees.includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => toggleAssignee(uid)}
                      aria-pressed={selected}
                      className={`flex items-center gap-2 px-3 py-[6px] rounded-[8px] text-[12px] font-medium border transition-all ${
                        selected
                          ? 'bg-ink text-white border-ink'
                          : 'bg-white text-ink border-line hover:border-muted'
                      }`}
                    >
                      <span aria-hidden="true"><UserAvatar user={m} size={18} /></span>
                      <span className="max-w-[180px] truncate">{m.name || m.email}</span>
                      {selected && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Labels */}
          {availableLabels.length > 0 && (
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Мітки (Теги)</label>
              <div className="flex flex-wrap gap-2">
                {availableLabels.map(l => {
                  const selected = form.labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={`flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[11px] font-bold border transition-all ${
                        selected
                          ? 'border-transparent'
                          : 'border-line bg-white opacity-60 hover:opacity-100'
                      }`}
                      style={selected ? { background: l.color + '18', color: l.color } : { color: '#9a9a9a' }}
                    >
                      {selected && <CheckSquare size={12} />}
                      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: l.color }} />
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-[12px] bg-red-50 border border-red-200 rounded-[8px] px-4 py-2 lg:col-span-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-4 border-t border-line flex justify-end gap-3 bg-canvas shrink-0">
          <Button style="secondary" size="md" onClick={onClose} type="button">
            Скасувати
          </Button>
          <Button
            type="submit"
            style="primary"
            size="md"
            disabled={!form.title.trim() || loading}
            loading={loading}
          >
            {loading ? 'Створення...' : 'Створити завдання'}
          </Button>
        </div>
      </form>
    </div>
  );
}
