'use client';
// src/components/CreateTaskModal.jsx — Light theme modal
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { Check, Play, Tag as TagIcon } from 'lucide-react';
import { TaskIcon } from '@/lib/design/icons';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import MarkdownEditor from '@/components/ui/Forms/MarkdownEditor';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { resolveCategoryStatusId } from '@/lib/utils/statusCategories.mjs';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Label from '@/components/ui/Forms/Label';
import FormGroup from '@/components/ui/Forms/FormGroup';
import SelectableChip from '@/components/ui/Forms/SelectableChip';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/Forms/DatePicker';
import { fromDateInput } from '@/lib/utils/date';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import Tabs from '@/components/ui/Tabs';
import AudioTaskPanel from '@/components/AudioTaskPanel';
import { taskTypeSelectOption } from '@/lib/design/taskTypeIcons';
import { prioritySelectOptions } from '@/lib/utils/priorities.mjs';
import Alert from '@/components/ui/Feedback/Alert';
import ToggleSwitch from '@/components/ui/Forms/ToggleSwitch';
import { userFacingErrorMessage } from '@/lib/utils/errors';
import { issuePath } from '@/lib/utils/issueKeys.mjs';
import {
  MAX_ISSUE_ESTIMATE_HOURS,
  clampIssueEstimateHours,
  issueEstimateHoursError,
} from '@/lib/utils/issueEstimate.mjs';



// `initialCategory` is what the «+» on a category column of «Мої завдання»
// asks for: the composer has no project yet, and a category has a different
// status in every project, so the status can only be resolved once a project is
// chosen — and again if it is changed.
export default function CreateTaskModal({ isOpen, onClose, onSubmit, stages, teamMembers = [], projects = null, projectContext = null, sprints = [], initialStatus = null, initialCategory = null, initialAssignees = null, initialSprintId = null }) {
  const router = useRouter();
  const { currentUser, activeOrg } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);
  const { labels: availableLabels = [], statuses = [], types = [], priorities = [] } = useWorkflowConfig();
  const [mode, setMode] = useState('task');

  const [form, setForm] = useState({
    title: '', description: '', status: 'backlog',
    priority: 'medium', type: 'task',
    assignees: [], labelIds: [], dueDate: '',
    estimateHours: '',
    projectId: projects && projects.length > 0 ? projects[0].id : '',
    sprintId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draftTouched, setDraftTouched] = useState(false);
  // Missing required fields are reported under the field that is missing, the
  // same way the project dialog does it. The submit button used to be disabled
  // instead, which says "you cannot do this" without ever saying why.
  const [fieldErrors, setFieldErrors] = useState({});
  const [createAnother, setCreateAnother] = useState(false);
  const titleInputRef = useRef(null);

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
  // Resolved against the whole workflow, never against the already-filtered
  // list: a status's category is read from its place in the full workflow.
  const categoryStatusId = useMemo(
    () => (initialCategory
      ? resolveCategoryStatusId(initialCategory, statuses, {
        hiddenStatusIds: activeHiddenCols || [],
      })
      : null),
    [activeHiddenCols, initialCategory, statuses],
  );
  const defaultStatusId = () => (
    initialStatus
    || categoryStatusId
    || resolveCategoryStatusId('backlog', statuses, {
      hiddenStatusIds: activeHiddenCols || [],
    })
    || visibleStatuses[0]?.id
    || 'backlog'
  );

  const initialForm = () => ({
    title: '',
    description: '',
    status: defaultStatusId(),
    priority: 'medium',
    type: 'task',
    assignees: initialAssignees?.length
      ? initialAssignees
      : [currentUser?.id || currentUser?.uid].filter(Boolean),
    labelIds: [],
    dueDate: '',
    estimateHours: '',
    projectId: projects?.[0]?.id || projectContext?.id || '',
    // Планування спринтів на телефоні — це не перетягування картки, а «додати
    // завдання сюди». Спринт, з якого відкрили діалог, уже обраний.
    sprintId: initialSprintId || '',
  });

  const resetDraft = () => {
    setMode('task');
    setForm(initialForm());
    setError('');
    setFieldErrors({});
    setDraftTouched(false);
    setCreateAnother(false);
  };

  const resetForAnother = () => {
    setMode('task');
    // Keep the routing/context choices that make a run of similar tasks fast,
    // but clear the content that would accidentally duplicate real work.
    setForm(current => ({
      ...initialForm(),
      projectId: current.projectId,
      status: current.status,
      priority: current.priority,
      type: current.type,
      assignees: current.assignees,
      sprintId: current.sprintId,
    }));
    setError('');
    setFieldErrors({});
    setDraftTouched(false);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const closeAndReset = () => {
    if (loading) return;
    resetDraft();
    onClose();
  };

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
      resetDraft();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialAssignees, initialStatus, initialSprintId, categoryStatusId, visibleStatuses, projects]);

  useEffect(() => {
    if (isOpen && form.status) {
      const isValid = visibleStatuses.some(s => s.id === form.status);
      if (!isValid && visibleStatuses.length > 0) {
        // Switching the project keeps the *category* the column asked for and
        // takes that project's status for it; falling straight to the first
        // visible status would quietly move the task to another column.
        const next = categoryStatusId || visibleStatuses[0].id;
        queueMicrotask(() => setForm(f => ({ ...f, status: next })));
      }
    }
  }, [categoryStatusId, form.projectId, form.status, isOpen, visibleStatuses]);

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

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setDraftTouched(true);
    // The message goes as soon as the reason for it does.
    setFieldErrors(current => (current[key] ? { ...current, [key]: '' } : current));
  };

  const toggleAssignee = (uid) => {
    setDraftTouched(true);
    setForm(current => ({
      ...current,
      assignees: current.assignees.includes(uid)
        ? current.assignees.filter(assignee => assignee !== uid)
        : [...current.assignees, uid],
    }));
  };

  const toggleLabel = (labelId) => {
    set('labelIds', form.labelIds.includes(labelId)
      ? form.labelIds.filter(id => id !== labelId)
      : [...form.labelIds, labelId]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Вкажіть назву завдання';
    const estimateError = issueEstimateHoursError(form.estimateHours);
    if (estimateError) nextErrors.estimateHours = estimateError;
    if (projects && projects.length > 0 && !form.projectId) {
      nextErrors.projectId = 'Оберіть проєкт';
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError('');
    try {
      const submitted = {
        ...form,
        createdBy: currentUser?.id || currentUser?.uid,
        dueDate: form.dueDate
          ? fromDateInput(form.dueDate, { endOfDay: true, timeZone })
          : null,
        estimateMinutes: form.estimateHours ? Math.round(parseFloat(form.estimateHours) * 60) : 0,
        sprintId: form.sprintId || null,
      };
      const created = await onSubmit(submitted);
      if (createAnother) {
        resetForAnother();
        return;
      }

      const createdProjectId = created?.projectId || submitted.projectId || projectContext?.id;
      const createdProject = projects?.find(project => project.id === createdProjectId)
        || (projectContext?.id === createdProjectId ? projectContext : createdProjectId);
      resetDraft();
      onClose();
      if (created?.id && createdProjectId) {
        router.push(issuePath(created, createdProject));
      }
    } catch (err) {
      console.error('[CreateTask]', err);
      setError(userFacingErrorMessage(err, 'Не вдалося створити завдання'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={closeAndReset}
      title="Нове завдання"
      size="lg"
      bodyPadding="flush"
      isDirty={mode === 'task' && draftTouched}
      closeConfirmation="Закрити форму й втратити незбережені зміни?"
      footer={mode === 'task' ? (
        <>
          <ToggleSwitch
            checked={createAnother}
            onChange={setCreateAnother}
            size="sm"
            label="Створити ще одне"
            className="mr-auto self-center"
          />
          <Button style="secondary" size="md" onClick={closeAndReset} type="button">
            Скасувати
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            style="primary"
            size="md"
            disabled={creatableTypes.length === 0}
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
          noValidate
          className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:p-7 lg:grid-cols-2"
        >
          {error && (
            <div role="alert" className="lg:col-span-2">
              <Alert
                variant="error"
                title="Не вдалося створити завдання"
                description={error}
              />
            </div>
          )}

          {/* Title */}
          <FormGroup label="Назва" required error={fieldErrors.title} className="lg:col-span-2">
            <Input
              ref={titleInputRef}
              autoFocus
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Що потрібно зробити?"
              error={Boolean(fieldErrors.title)}
            />
          </FormGroup>

          {/* Project Selector (if projects passed) */}
          {projects && projects.length > 0 && (
            <FormGroup label="Проєкт" required error={fieldErrors.projectId}>
              <Select
                value={form.projectId}
                onChange={val => set('projectId', val)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Оберіть проєкт..."
              />
            </FormGroup>
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
                options={creatableTypes.map(taskTypeSelectOption)}
                placeholder={creatableTypes.length > 0 ? 'Оберіть тип' : 'Додайте тип у налаштуваннях'}
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <Label>Пріоритет</Label>
              <Select
                value={form.priority}
                onChange={val => set('priority', val)}
                options={prioritySelectOptions(priorities)}
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
                    { value: '', label: 'Без спринта' },
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
            <FormGroup label="Оцінка (год)" error={fieldErrors.estimateHours}>
              <Input
                type="number"
                min="0"
                max={MAX_ISSUE_ESTIMATE_HOURS}
                step="0.5"
                value={form.estimateHours}
                onChange={event => {
                  const next = clampIssueEstimateHours(event.target.value);
                  setForm(current => ({ ...current, estimateHours: next.value }));
                  setDraftTouched(true);
                  setFieldErrors(current => ({ ...current, estimateHours: next.error }));
                }}
                placeholder="0"
                error={Boolean(fieldErrors.estimateHours)}
              />
            </FormGroup>
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
