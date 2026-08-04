'use client';
// src/components/CreateTaskModal.jsx — Light theme modal
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { Check, Play, Tag as TagIcon } from 'lucide-react';
import { TaskIcon } from '@/lib/design/icons';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import MarkdownEditor from '@/components/ui/Forms/MarkdownEditor';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Label from '@/components/ui/Forms/Label';
import SelectableChip from '@/components/ui/Forms/SelectableChip';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/Forms/DatePicker';
import { fromDateInput } from '@/lib/utils/date';
import Tabs from '@/components/ui/Tabs';
import AudioTaskPanel from '@/components/AudioTaskPanel';



export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers = [], projects = null, projectContext = null, sprints = [], initialStatus = null, initialAssignees = null }) {
  const { currentUser } = useAppContext();
  const { labels: availableLabels = [], statuses = [], types = [], priorities = [] } = useWorkflowConfig();
  const [mode, setMode] = useState('task');

  const [form, setForm] = useState({
    title: '', description: '', status: 'todo',
    priority: 'medium', type: 'task',
    assignees: [], labelIds: [], dueDate: '',
    estimateHours: '',
    projectId: projects && projects.length > 0 ? projects[0].id : '',
    sprintId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedProject = projects?.find(p => p.id === form.projectId) || projectContext;
  const activeHiddenCols = selectedProject?.hiddenColumns;
  const availableSprints = useMemo(
    () => (sprints || []).filter(sprint => sprint.status !== 'completed'),
    [sprints],
  );
  const visibleStatuses = useMemo(
    () => statuses.filter(s => !(activeHiddenCols || []).includes(s.id)),
    [statuses, activeHiddenCols],
  );
  const creatableTypes = useMemo(
    () => types.filter(type => type.id !== 'epic'),
    [types],
  );

  // Reset when the dialog *opens*, not whenever the values the reset reads
  // happen to change identity. `visibleStatuses` is a useMemo over
  // `activeHiddenCols`, which comes off `projectContext` — and the project page
  // builds that as a fresh object literal every render. With those in the
  // dependency list the reset ran on ordinary re-renders, and `setMode('task')`
  // pulled the tab back to «Завдання» mid-work: that unmounts AudioTaskPanel,
  // so a set of AI-generated drafts disappeared with it. The ref makes the
  // open transition the trigger; the dependencies stay so the reset still reads
  // current values on the render that opens it.
  const hasOpened = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasOpened.current = false;
      return;
    }
    if (hasOpened.current) return;
    hasOpened.current = true;
    queueMicrotask(() => {
      setMode('task');
      setForm(f => ({
        ...f,
        projectId: f.projectId || projects?.[0]?.id || '',
        // Opened from a colleague's profile, the composer arrives with that
        // colleague already on it — otherwise "create a task for them" means
        // finding them again in a chip list.
        assignees: initialAssignees?.length ? initialAssignees : f.assignees,
        status: initialStatus || (visibleStatuses.some(s => s.id === 'todo') ? 'todo' : visibleStatuses[0]?.id || 'todo')
      }));
    });
  }, [isOpen, initialAssignees, initialStatus, visibleStatuses, projects]);

  useEffect(() => {
    if (isOpen && form.status) {
      const isValid = visibleStatuses.some(s => s.id === form.status);
      if (!isValid && visibleStatuses.length > 0) {
        queueMicrotask(() => setForm(f => ({ ...f, status: visibleStatuses[0].id })));
      }
    }
  }, [form.projectId, form.status, isOpen, visibleStatuses]);

  useEffect(() => {
    if (isOpen && form.sprintId && !availableSprints.some(sprint => sprint.id === form.sprintId)) {
      queueMicrotask(() => setForm(current => ({ ...current, sprintId: '' })));
    }
  }, [availableSprints, form.sprintId, isOpen]);

  useEffect(() => {
    if (isOpen && !creatableTypes.some(type => type.id === form.type)) {
      queueMicrotask(() => setForm(current => ({
        ...current,
        type: creatableTypes.find(type => type.id === 'task')?.id || creatableTypes[0]?.id || 'task',
      })));
    }
  }, [creatableTypes, form.type, isOpen]);

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
        sprintId: form.sprintId || null
      });
      setForm({ title: '', description: '', status: 'todo', priority: 'medium', type: 'task', assignees: [], dueDate: '', labelIds: [], estimateHours: '', projectId: '', sprintId: '' });
      onClose();
    } catch (err) {
      console.error('[CreateTask]', err);
      setError(err?.message || 'Помилка створення завдання. Перевір консоль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Нове завдання"
      size="lg"
      bodyPadding="flush"
      footer={mode === 'task' ? (
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">
            Скасувати
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            style="primary"
            size="md"
            disabled={!form.title.trim() || loading || creatableTypes.length === 0}
            loading={loading}
          >
            {loading ? 'Створення...' : 'Створити завдання'}
          </Button>
        </>
      ) : undefined}
    >
        <div className="border-b border-line px-5 py-3 sm:px-7">
          <Tabs
            tabs={[
              { id: 'task', label: 'Завдання', icon: TaskIcon },
              { id: 'audio', label: 'Аудіо-завдання (AI)', icon: Play },
            ]}
            activeTab={mode}
            onTabChange={setMode}
            className="w-full [&>button]:flex-1"
          />
        </div>

        {mode === 'task' ? (
        <form
          id="create-task-form"
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:p-7 lg:grid-cols-2"
        >
          {/* Title */}
          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <Label required>Назва</Label>
            <Input
              autoFocus
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Що потрібно зробити?"
            />
          </div>

          {/* Project Selector (if projects passed) */}
          {projects && projects.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              <Label required>Проєкт</Label>
              <Select
                value={form.projectId}
                onChange={val => set('projectId', val)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Оберіть проєкт..."
              />
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <Label>Опис</Label>
            <MarkdownEditor 
              value={form.description}
              onChange={(val) => set('description', val)}
              placeholder="Додайте деталі, чеклісти, посилання..."
              minHeight="120px"
            />
          </div>

          {/* Metadata controls share one grid, so every field has identical
              geometry and a deterministic reading order. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:col-span-2">
            <div className="flex flex-col gap-[6px]">
              <Label>Тип</Label>
              <Select
                value={form.type}
                onChange={val => set('type', val)}
                options={creatableTypes.map(t => ({
                  value: t.id,
                  label: t.label,
                  dotColor: t.color,
                }))}
                placeholder={creatableTypes.length > 0 ? 'Оберіть тип' : 'Додайте тип у налаштуваннях'}
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <Label>Пріоритет</Label>
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
            <div className="flex flex-col gap-[6px]">
              <Label>Статус</Label>
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
            {availableSprints.length > 0 && (
              <div className="flex flex-col gap-[6px]">
                <Label>Спринт</Label>
                <Select
                  value={form.sprintId}
                  onChange={val => set('sprintId', val)}
                  options={[
                    { value: '', label: 'Без спринта (Беклог)' },
                    ...availableSprints.map(s => ({ value: s.id, label: s.name }))
                  ]}
                  placeholder="Оберіть спринт..."
                />
              </div>
            )}
            <div className="flex flex-col gap-[6px]">
              <Label>Дедлайн</Label>
              <DatePicker
                value={form.dueDate}
                onChange={value => set('dueDate', value)}
                placeholder="Без дедлайну"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <Label>Оцінка (год)</Label>
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
            <div className="flex flex-col gap-[6px] lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Виконавці</Label>
                <span className="text-[10px] font-medium text-muted">Можна вибрати кількох</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => {
                  const uid = m.uid || m.id;
                  const selected = form.assignees.includes(uid);
                  return (
                    <SelectableChip
                      key={uid}
                      shape="person"
                      selected={selected}
                      onClick={() => toggleAssignee(uid)}
                    >
                      <span aria-hidden="true"><UserAvatar user={m} size="xs" /></span>
                      <span className="max-w-[180px] truncate">{m.name || m.email}</span>
                      {selected && <Check size={12} className="shrink-0" />}
                    </SelectableChip>
                  );
                })}
              </div>
              <p className="text-[10px] leading-[1.4] text-muted">
                У персональній аналітиці завдання врахується кожному вибраному виконавцю.
              </p>
            </div>
          )}

          {/* Labels */}
          {availableLabels.length > 0 && (
            <div className="flex flex-col gap-[6px] lg:col-span-2">
              <Label>Мітки (Теги)</Label>
              <div className="flex flex-wrap gap-2">
                {availableLabels.map(l => {
                  const selected = form.labelIds.includes(l.id);
                  return (
                    <SelectableChip
                      key={l.id}
                      shape="label"
                      selected={selected}
                      tone={l.color}
                      onClick={() => toggleLabel(l.id)}
                    >
                      <TagIcon size={10} className="shrink-0 opacity-70" />
                      {l.label}
                    </SelectableChip>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-[12px] bg-red-50 border border-red-200 rounded-[8px] px-4 py-2 lg:col-span-2">{error}</p>
          )}
        </form>
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
    </Dialog>
  );
}
