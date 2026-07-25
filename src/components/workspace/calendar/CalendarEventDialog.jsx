'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  BellRing,
  CircleHelp,
  Check,
  Clock3,
  Diamond,
  ExternalLink,
  Link2,
  LockKeyhole,
  MapPin,
  Pencil,
  Repeat2,
  StickyNote,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Button, Dialog, Input, Select, Textarea, ToggleSwitch } from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import UserAvatar from '@/components/UserAvatar';
import { useCalendarEventTimeLogs } from '@/lib/hooks/useCalendarEventTimeLogs';

const TYPE_OPTIONS = [
  { value: 'meeting', label: 'Мітинг', dotColor: '#3b82f6' },
  { value: 'event', label: 'Подія', dotColor: '#8b5cf6' },
  { value: 'focus', label: 'Фокус-час', dotColor: '#14b8a6' },
  { value: 'absence', label: 'Відсутність', dotColor: '#f59e0b' },
  { value: 'release', label: 'Реліз / етап', dotColor: '#ef4444' },
  { value: 'note', label: 'Нотатка', icon: StickyNote },
  { value: 'reminder', label: 'Нагадування', icon: BellRing },
  { value: 'milestone', label: 'Віха', icon: Diamond },
];
const TYPE_LABELS = new Map([
  ...TYPE_OPTIONS.map(option => [option.value, option.label]),
  ['birthday', 'День народження'],
]);

const RESPONSE_OPTIONS = [
  { value: 'accepted', label: 'Буду', icon: Check, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'tentative', label: 'Можливо', icon: CircleHelp, activeClass: 'bg-amber-500 text-white border-amber-500' },
  { value: 'declined', label: 'Не буду', icon: X, activeClass: 'bg-red-500 text-white border-red-500' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Не повторювати' },
  { value: 'daily', label: 'Щодня' },
  { value: 'weekly', label: 'Щотижня' },
  { value: 'monthly', label: 'Щомісяця' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'У момент початку' },
  { value: 5, label: 'За 5 хвилин' },
  { value: 10, label: 'За 10 хвилин' },
  { value: 15, label: 'За 15 хвилин' },
  { value: 30, label: 'За 30 хвилин' },
  { value: 60, label: 'За 1 годину' },
  { value: 120, label: 'За 2 години' },
  { value: 1440, label: 'За 1 день' },
  { value: 2880, label: 'За 2 дні' },
  { value: 10080, label: 'За 1 тиждень' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function localDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialForm(event, initialStart, currentUserId) {
  const editableStart = event?.sourceEventId ? event.seriesStartAt : event?.startAt;
  const editableEnd = event?.sourceEventId ? event.seriesEndAt : event?.endAt;
  const start = editableStart ? new Date(editableStart) : new Date(initialStart || Date.now());
  if (!event?.startAt) {
    start.setMinutes(start.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (start.getMinutes() === 0) start.setHours(start.getHours() + 1);
  }
  const end = editableEnd ? new Date(editableEnd) : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: event?.title || '',
    type: event?.type || 'meeting',
    description: event?.description || '',
    location: event?.location || '',
    meetingUrl: event?.meetingUrl || '',
    projectId: event?.projectId || '',
    visibility: event?.visibility || 'team',
    participantIds: event?.participantIds || (currentUserId ? [currentUserId] : []),
    allDay: event?.allDay === true,
    startDate: localDateValue(start),
    startTime: localTimeValue(start),
    endDate: localDateValue(end),
    endTime: localTimeValue(end),
    recurrenceFrequency: event?.recurrence?.frequency || 'none',
    recurrenceInterval: event?.recurrence?.interval || 1,
    recurrenceUntil: event?.recurrence?.until || '',
    reminderMinutes: event?.reminderMinutes || [15],
  };
}

function memberLabel(member) {
  return member.name || member.displayName || member.email || 'Учасник';
}

function responseLabel(value) {
  if (value === 'accepted') return 'Буде';
  if (value === 'tentative') return 'Можливо';
  if (value === 'declined') return 'Не буде';
  return 'Очікуємо';
}

export function CalendarEventDetails({
  event,
  members,
  projects,
  currentUserId,
  response,
  isParticipant,
  saving,
  error,
  timeLogs,
  totalMinutes,
  timeLoading,
  timeSaving,
  onAddTime,
  onDeleteTime,
  onRespond,
}) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const project = projects.find(item => item.id === event.projectId);
  const recurrence = RECURRENCE_OPTIONS.find(option => option.value === event.recurrence?.frequency);
  const reminderLabels = (event.reminderMinutes || [])
    .map(minutes => REMINDER_OPTIONS.find(option => option.value === minutes)?.label)
    .filter(Boolean);
  return (
    <div className="space-y-[18px]">
      <div className="overflow-hidden rounded-[18px] border border-black/[0.05] bg-white">
        <div className="bg-gradient-to-br from-black/[0.035] to-transparent p-[18px]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-white">
              {TYPE_LABELS.get(event.type) || 'Подія'}
            </span>
            {project && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-muted ring-1 ring-black/[0.05]">{project.name}</span>}
            {event.recurrence?.frequency !== 'none' && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-muted ring-1 ring-black/[0.05]"><Repeat2 size={11} /> {recurrence?.label}</span>}
          </div>
          <h2 className="text-[20px] font-bold leading-tight text-ink">{event.title}</h2>
          <div className="mt-4 grid gap-2 text-[12px] text-muted sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-[12px] bg-white p-3 ring-1 ring-black/[0.04]">
              <CalendarDays size={15} className="mt-0.5 shrink-0 text-ink" />
              <span>{event.allDay ? start.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }) : `${start.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })}, ${start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`}</span>
            </div>
            {(event.location || event.meetingUrl) && (
              <div className="flex items-start gap-2 rounded-[12px] bg-white p-3 ring-1 ring-black/[0.04]">
                {event.meetingUrl ? <Link2 size={15} className="mt-0.5 shrink-0 text-ink" /> : <MapPin size={15} className="mt-0.5 shrink-0 text-ink" />}
                <span className="truncate">{event.location || 'Онлайн-зустріч'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {event.description && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Опис</p>
          <p className="whitespace-pre-wrap rounded-[14px] bg-canvas p-4 text-[13px] leading-relaxed text-ink">{event.description}</p>
        </div>
      )}

      {reminderLabels.length > 0 && (
        <div className="flex items-start gap-2 rounded-[12px] border border-line px-3 py-2.5 text-[12px] text-muted">
          <BellRing size={15} className="mt-0.5 shrink-0 text-ink" />
          <span>Нагадування: {reminderLabels.join(', ').toLocaleLowerCase('uk-UA')}</span>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Учасники</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(event.participantIds || []).map(uid => {
            const member = members.find(item => (item.id || item.uid) === uid);
            const state = event.participantResponses?.[uid] || 'pending';
            return (
              <div key={uid} className="flex items-center gap-2.5 rounded-[12px] border border-black/[0.05] bg-white p-2.5">
                <span className="h-8 w-8 overflow-hidden rounded-full"><UserAvatar user={member || { name: memberLabel(member || {}) }} size={32} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-ink">{memberLabel(member || {})}</p>
                  <p className={`text-[10px] font-semibold ${state === 'accepted' ? 'text-emerald-600' : state === 'declined' ? 'text-red-500' : state === 'tentative' ? 'text-amber-600' : 'text-muted'}`}>{responseLabel(state)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isParticipant && event.organizerId !== currentUserId && (
        <div className="rounded-[16px] bg-canvas p-[14px]">
          <p className="mb-2 text-[12px] font-bold text-ink">Ви приєднаєтесь?</p>
          <div className="grid grid-cols-3 gap-2">
            {RESPONSE_OPTIONS.map(option => {
              const Icon = option.icon;
              const active = response === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onRespond(option.value)}
                  disabled={saving}
                  className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[12px] border text-[11px] font-bold transition-all disabled:opacity-50 ${active ? option.activeClass : 'border-black/[0.06] bg-white text-muted hover:border-black/15 hover:text-ink'}`}
                >
                  <Icon size={16} /> {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {event.meetingUrl && (
        <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-ink px-4 text-[13px] font-bold text-white hover:bg-ink-hover">
          <ExternalLink size={15} /> Приєднатися до зустрічі
        </a>
      )}

      {!event.readOnly && ['meeting', 'event', 'focus', 'release'].includes(event.type) && (
        <div className="rounded-[16px] border border-line bg-white p-[14px]">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold text-ink">Фактично витрачений час</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {timeLoading ? 'Завантаження…' : totalMinutes > 0 ? `Всього ${Math.floor(totalMinutes / 60)} год ${totalMinutes % 60} хв` : 'Час ще не списували'}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-faint">
                {event.projectId
                  ? 'Потрапляє в аналітику команди та в рахунок обраного проєкту.'
                  : 'Потрапляє в аналітику команди. Щоб додати час у рахунок, прив’яжіть подію до проєкту.'}
              </p>
            </div>
            {!event.allDay && (
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-bold text-muted">
                План: {Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000))} хв
              </span>
            )}
          </div>
          <form className="grid gap-2 sm:grid-cols-[110px_1fr_auto]" onSubmit={onAddTime}>
            <Input name="minutes" type="number" min="1" max="10080" required placeholder="Хвилини" aria-label="Витрачено хвилин" />
            <Input name="description" maxLength={2000} placeholder="Що зроблено (необов’язково)" aria-label="Опис роботи" />
            <Button type="submit" size="sm" loading={timeSaving}>Додати</Button>
          </form>
          {timeLogs.length > 0 && (
            <div className="mt-3 divide-y divide-line border-t border-line">
              {timeLogs.map(log => {
                const member = members.find(item => (item.id || item.uid) === log.userId);
                const canDelete = log.userId === currentUserId;
                return (
                  <div key={log.id} className="flex items-start gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-ink">{memberLabel(member || {})} · {log.spentMinutes} хв</p>
                      {log.description && <p className="mt-0.5 break-words text-[11px] text-muted">{log.description}</p>}
                    </div>
                    {canDelete && (
                      <button type="button" onClick={() => onDeleteTime(log.id)} className="rounded-[7px] p-1.5 text-muted hover:bg-red-50 hover:text-red-500" aria-label="Видалити запис часу">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default function CalendarEventDialog({
  isOpen,
  event,
  initialStart,
  members,
  projects,
  currentUserId,
  canManage,
  onClose,
  onSave,
  onDelete,
  onRespond,
  initialMode,
  onCancelEdit,
}) {
  const confirm = useConfirm();
  const [form, setForm] = useState(() => initialForm(event, initialStart, currentUserId));
  const [mode, setMode] = useState(initialMode || (event ? 'details' : 'edit'));
  const [saving, setSaving] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);
  const [error, setError] = useState('');
  const eventId = event?.sourceEventId || event?.id || '';
  const occurrenceStartAt = event?.startAt || '';
  const {
    logs: timeLogs,
    totalMinutes,
    loading: timeLoading,
    addTimeLog,
    deleteTimeLog,
  } = useCalendarEventTimeLogs(event?.readOnly ? '' : eventId, occurrenceStartAt);

  const memberOptions = useMemo(() => members.map(member => ({
    value: member.id || member.uid,
    label: memberLabel(member),
    avatar: member.avatar || member.photoURL || '',
  })), [members]);
  const projectOptions = useMemo(() => [
    { value: '', label: 'Без проєкту' },
    ...projects.filter(project => project.status !== 'archived').map(project => ({
      value: project.id,
      label: project.name,
    })),
  ], [projects]);
  const response = event?.participantResponses?.[currentUserId] || 'pending';
  const isParticipant = event?.participantIds?.includes(currentUserId);

  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  const submit = async eventObject => {
    eventObject.preventDefault();
    if (!canManage) return;
    const title = form.title.trim();
    if (!title) {
      setError('Вкажіть назву події');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let startAt;
      let endAt;
      if (form.allDay) {
        startAt = new Date(`${form.startDate}T00:00:00`);
        endAt = new Date(`${form.endDate}T00:00:00`);
        if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);
      } else {
        startAt = new Date(`${form.startDate}T${form.startTime}:00`);
        endAt = new Date(`${form.endDate}T${form.endTime}:00`);
      }
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) {
        throw new Error('Вкажіть коректні дату й час');
      }
      if (endAt <= startAt) {
        throw new Error('Завершення має бути пізніше за початок');
      }
      await onSave({
        title,
        type: form.type,
        description: form.description,
        location: form.location,
        meetingUrl: form.meetingUrl,
        projectId: form.projectId,
        visibility: form.visibility,
        participantIds: form.visibility === 'private'
          ? (currentUserId ? [currentUserId] : [])
          : form.participantIds,
        allDay: form.allDay,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        recurrence: {
          frequency: form.recurrenceFrequency,
          interval: Number(form.recurrenceInterval) || 1,
          until: form.recurrenceUntil,
        },
        reminderMinutes: form.reminderMinutes,
      });
    } catch (saveError) {
      setError(saveError.message || 'Не вдалося зберегти подію');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!await confirm({
      title: 'Видалити подію?',
      message: 'Усі запрошені отримають сповіщення про скасування.',
      confirmText: 'Видалити',
      danger: true,
    })) return;
    setSaving(true);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError.message || 'Не вдалося видалити подію');
      setSaving(false);
    }
  };

  const handleResponse = async value => {
    setSaving(true);
    setError('');
    try {
      await onRespond(value);
    } catch (responseError) {
      setError(responseError.message || 'Не вдалося зберегти відповідь');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTime = async formEvent => {
    formEvent.preventDefault();
    const formElement = formEvent.currentTarget;
    const data = new FormData(formElement);
    setTimeSaving(true);
    setError('');
    try {
      await addTimeLog({
        userId: currentUserId,
        projectId: event?.projectId || '',
        spentMinutes: Number(data.get('minutes')),
        description: data.get('description'),
      });
      formElement.reset();
    } catch (timeError) {
      setError(timeError.message || 'Не вдалося додати час');
    } finally {
      setTimeSaving(false);
    }
  };

  const handleDeleteTime = async logId => {
    try {
      await deleteTimeLog(logId);
    } catch (timeError) {
      setError(timeError.message || 'Не вдалося видалити запис часу');
    }
  };

  if (event && mode === 'details') {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Деталі події"
        size="lg"
        footer={(
          <>
            {canManage && !event.readOnly && <Button style="secondary" size="md" icon={Pencil} onClick={() => setMode('edit')}>Редагувати</Button>}
            <Button style="secondary" size="md" onClick={onClose}>Закрити</Button>
          </>
        )}
      >
        <CalendarEventDetails
          event={event}
          members={members}
          projects={projects}
          currentUserId={currentUserId}
          response={response}
          isParticipant={isParticipant}
          saving={saving}
          error={error}
          timeLogs={timeLogs}
          totalMinutes={totalMinutes}
          timeLoading={timeLoading}
          timeSaving={timeSaving}
          onAddTime={handleAddTime}
          onDeleteTime={handleDeleteTime}
          onRespond={handleResponse}
        />
      </Dialog>
    );
  }

  const footer = canManage ? (
    <>
      {event && (
        <Button
          style="ghost"
          color="red"
          size="md"
          icon={Trash2}
          className="mr-auto"
          onClick={handleDelete}
          disabled={saving}
        >
          Видалити
        </Button>
      )}
      <Button
        style="secondary"
        size="md"
        onClick={() => {
          if (event && onCancelEdit) onCancelEdit();
          else if (event) setMode('details');
          else onClose();
        }}
      >
        Скасувати
      </Button>
      <Button type="submit" form="calendar-event-form" size="md" loading={saving}>
        {event ? 'Зберегти' : 'Створити подію'}
      </Button>
    </>
  ) : (
    <Button style="secondary" size="md" onClick={onClose}>Закрити</Button>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={event ? (canManage ? 'Редагування події' : 'Деталі події') : 'Нова подія'}
      size="lg"
      footer={footer}
    >
      <form id="calendar-event-form" onSubmit={submit} className="flex flex-col gap-[20px]">
        <div className="space-y-[8px]">
          <label className="text-[12px] font-bold text-ink">Назва</label>
          <Input
            autoFocus
            required
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="Наприклад, синхронізація команди"
            disabled={!canManage}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
          <div className="space-y-[8px]">
            <label className="text-[12px] font-bold text-ink">Тип</label>
            <Select
              value={form.type}
              onChange={value => update('type', value)}
              options={TYPE_OPTIONS}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-[8px]">
            <label className="text-[12px] font-bold text-ink">Проєкт</label>
            <Select
              value={form.projectId}
              onChange={value => update('projectId', value)}
              options={projectOptions}
              disabled={!canManage}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div className="space-y-[8px]">
            <label className="flex items-center gap-1.5 text-[12px] font-bold text-ink"><Repeat2 size={14} /> Повторення</label>
            <Select value={form.recurrenceFrequency} onChange={value => update('recurrenceFrequency', value)} options={RECURRENCE_OPTIONS} />
            {form.recurrenceFrequency !== 'none' && (
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Input type="number" min="1" max="12" value={form.recurrenceInterval} onChange={eventObject => update('recurrenceInterval', eventObject.target.value)} aria-label="Інтервал повторення" />
                <Input type="date" value={form.recurrenceUntil} min={form.startDate} onChange={eventObject => update('recurrenceUntil', eventObject.target.value)} aria-label="Повторювати до дати" />
              </div>
            )}
          </div>
          <div className="space-y-[8px]">
            <label className="flex items-center gap-1.5 text-[12px] font-bold text-ink"><BellRing size={14} /> Нагадування</label>
            <MultiSelect
              value={form.reminderMinutes}
              onChange={value => update('reminderMinutes', value)}
              options={REMINDER_OPTIONS}
              placeholder="Додати нагадування"
              searchPlaceholder="Знайти інтервал..."
              className="w-full"
              dropdownClassName="w-full"
            />
            <p className="text-[10px] text-muted">Можна вибрати до п’яти нагадувань.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-line bg-canvas px-[14px] py-[12px]">
            <span>
              <span className="block text-[12px] font-bold text-ink">Подія на весь день</span>
              <span className="block text-[11px] text-muted mt-0.5">Без прив’язки до конкретної години</span>
            </span>
            <ToggleSwitch
              checked={form.allDay}
              onChange={value => update('allDay', value)}
              disabled={!canManage}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-[12px] p-[14px] sm:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="text-[11px] font-semibold text-muted flex items-center gap-1.5">
                <CalendarDays size={13} /> Початок
              </label>
              <div className="flex gap-[8px]">
                <Input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} disabled={!canManage} />
                {!form.allDay && <Input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} disabled={!canManage} />}
              </div>
            </div>
            <div className="space-y-[6px]">
              <label className="text-[11px] font-semibold text-muted flex items-center gap-1.5">
                <Clock3 size={13} /> Завершення
              </label>
              <div className="flex gap-[8px]">
                <Input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} disabled={!canManage} />
                {!form.allDay && <Input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} disabled={!canManage} />}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-[8px]">
          <label className="text-[12px] font-bold text-ink flex items-center gap-1.5">
            {form.visibility === 'private' ? <LockKeyhole size={14} /> : <Users size={14} />}
            {form.visibility === 'private'
              ? (form.type === 'note' ? 'Приватна нотатка' : 'Приватна подія')
              : 'Учасники'}
          </label>
          {form.visibility === 'private' ? (
            <div className="rounded-[12px] border border-line bg-canvas px-3 py-2.5 text-[12px] text-muted">
              Цю подію бачите лише ви. Запрошення та командні сповіщення не надсилаються.
            </div>
          ) : (
            <MultiSelect
              value={form.participantIds}
              onChange={value => update('participantIds', value)}
              options={memberOptions}
              placeholder="Додати учасників"
              searchPlaceholder="Знайти учасника..."
              disabled={!canManage}
              className="w-full"
              dropdownClassName="w-full"
            />
          )}
          {event && form.visibility !== 'private' && form.participantIds.length > 0 && (
            <div className="flex flex-wrap gap-[6px] pt-[2px]">
              {form.participantIds.map(uid => {
                const member = members.find(item => (item.id || item.uid) === uid);
                const state = event.participantResponses?.[uid] || 'pending';
                return (
                  <span key={uid} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] text-ink">
                    {memberLabel(member || {})}
                    <span className={state === 'accepted' ? 'text-emerald-600' : state === 'declined' ? 'text-red-500' : 'text-muted'}>
                      · {state === 'accepted' ? 'буде' : state === 'tentative' ? 'можливо' : state === 'declined' ? 'не буде' : 'очікуємо'}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
          <div className="space-y-[8px]">
            <label className="text-[12px] font-bold text-ink flex items-center gap-1.5">
              <MapPin size={14} /> Місце
            </label>
            <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Офіс або кімната" disabled={!canManage} />
          </div>
          <div className="space-y-[8px]">
            <label className="text-[12px] font-bold text-ink flex items-center gap-1.5">
              <Link2 size={14} /> Посилання
            </label>
            <Input type="url" value={form.meetingUrl} onChange={e => update('meetingUrl', e.target.value)} placeholder="https://meet..." disabled={!canManage} />
          </div>
        </div>

        <div className="space-y-[8px]">
          <label className="text-[12px] font-bold text-ink">Опис</label>
          <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Контекст, порядок денний або важливі деталі" disabled={!canManage} rows={4} />
        </div>

        <div className="space-y-[8px]">
          <label className="text-[12px] font-bold text-ink">Видимість</label>
          <Select
            value={form.visibility}
            onChange={value => update('visibility', value)}
            options={[
              { value: 'team', label: 'Уся команда' },
              { value: 'participants', label: 'Лише учасники' },
              { value: 'private', label: 'Лише я', icon: LockKeyhole },
            ]}
            disabled={!canManage}
          />
        </div>

        {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
      </form>
    </Dialog>
  );
}
