'use client';
// src/components/CreateTaskModal.jsx — Light theme modal
import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { X, Check, ListTodo, Mic2, Tag as TagIcon } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import MarkdownEditor from './MarkdownEditor';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/Forms/DatePicker';
import { fromDateInput } from '@/lib/utils/date';
import Tabs from '@/components/ui/Tabs';
import AudioTaskPanel from '@/components/AudioTaskPanel';



export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers = [], projects = null, projectContext = null, sprints = [], initialStatus = null, epics = [] }) {
  const { currentUser } = useAppContext();
  const { labels: availableLabels = [], statuses = [], types = [], priorities = [] } = useWorkflowConfig();
  const [mode, setMode] = useState('task');

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
      queueMicrotask(() => {
        setMode('task');
        setForm(f => ({
          ...f,
          projectId: f.projectId || projects?.[0]?.id || '',
          status: initialStatus || (visibleStatuses.some(s => s.id === 'todo') ? 'todo' : visibleStatuses[0]?.id || 'todo')
        }));
      });
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
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — mobile: bottom sheet */}
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-full sm:w-[min(760px,92vw)] sm:rounded-none sm:pb-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 id="create-task-title" className="text-[18px] font-bold text-ink">Нове завдання</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button style="ghost" size="icon" icon={X} onClick={onClose} type="button" aria-label="Закрити">
              Закрити
            </Button>
          </div>
        </div>

        <div className="border-b border-line px-5 py-3 sm:px-7">
          <Tabs
            tabs={[
              { id: 'task', label: 'Завдання', icon: ListTodo },
              { id: 'audio', label: 'Аудіо-завдання (AI)', icon: Mic2 },
            ]}
            activeTab={mode}
            onTabChange={setMode}
            className="w-full [&>button]:flex-1"
          />
        </div>

        {mode === 'task' ? (
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
                options={types.map(t => ({
                  value: t.id,
                  label: t.label,
                  badgeColor: t.color,
                }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Пріоритет</label>
              <Select
                value={form.priority}
                onChange={val => set('priority', val)}
                options={priorities.map(p => ({
                  value: p.id,
                  label: p.label,
                  dotColor: p.color,
                }))}
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
                options={visibleStatuses.map(s => ({
                  value: s.id,
                  label: s.label,
                  dotColor: s.color,
                }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Дедлайн</label>
              <DatePicker
                value={form.dueDate}
                onChange={value => set('dueDate', value)}
                placeholder="Без дедлайну"
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
                      aria-pressed={selected}
                      className={`inline-flex items-center gap-1.5 rounded-[8px] px-[10px] py-[3px] text-[11px] font-medium transition-colors ${
                        selected
                          ? ''
                          : 'bg-ink/5 text-[#404040] hover:bg-ink/10'
                      }`}
                      style={selected ? { background: `${l.color}14`, color: l.color } : undefined}
                    >
                      <TagIcon size={10} className="shrink-0 opacity-70" />
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
        ) : (
          <div className="flex-1 overflow-y-auto p-5 sm:p-7">
            <AudioTaskPanel
              projects={projects || []}
              projectContext={projectContext}
              teamMembers={teamMembers}
              onSubmit={onSubmit}
              onFinished={onClose}
            />
          </div>
        )}

        {/* Footer */}
        {mode === 'task' && (
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
        )}
      </form>
    </div>
  );
}
