'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  BellRing,
  CircleHelp,
  Check,
  Clock3,
  ExternalLink,
  Flag,
  Link2,
  LockKeyhole,
  MapPin,
  Pencil,
  Repeat2,
  StickyNote,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  Button,
  DatePicker,
  Dialog,
  Input,
  Label,
  Pill,
  Select,
  Textarea,
  TimeLogRow,
  TimePicker,
  ToggleSwitch,
} from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { useCalendarEventTimeLogs } from '@/lib/hooks/useCalendarEventTimeLogs';

export const CALENDAR_EVENT_TYPE_OPTIONS = [
  { value: 'meeting', label: 'Мітинг', color: '#3b82f6', bg: '#eff6ff', icon: Video },
  { value: 'event', label: 'Подія', color: '#8b5cf6', bg: '#f5f3ff', icon: CalendarDays },
  { value: 'focus', label: 'Фокус-час', color: '#14b8a6', bg: '#f0fdfa', icon: Clock3 },
  { value: 'absence', label: 'Відсутність', color: '#f59e0b', bg: '#fffbeb', icon: Users },
  { value: 'release', label: 'Реліз / етап', color: '#ef4444', bg: '#fef2f2', icon: Flag },
  { value: 'note', label: 'Нотатка', color: '#64748b', bg: '#f8fafc', icon: StickyNote },
  { value: 'reminder', label: 'Нагадування', color: '#f97316', bg: '#fff7ed', icon: BellRing },
];
const TYPE_LABELS = new Map([
  ...CALENDAR_EVENT_TYPE_OPTIONS.map(option => [option.value, option.label]),
  ['birthday', 'День народження'],
]);

const RESPONSE_OPTIONS = [
  { value: 'accepted', label: 'Буду', icon: Check, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'tentative', label: 'Можливо', icon: CircleHelp, activeClass: 'bg-amber-500 text-white border-amber-500' },
  { value: 'declined', label: 'Не буду', icon: X, activeClass: 'bg-red-500 text-white border-red-500' },
];

export const CALENDAR_EVENT_RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Не повторювати' },
  { value: 'daily', label: 'Щодня' },
  { value: 'weekly', label: 'Щотижня' },
  { value: 'monthly', label: 'Щомісяця' },
];

export const CALENDAR_EVENT_REMINDER_OPTIONS = [
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

export function calendarEventFormInitialValue(event, initialStart, currentUserId) {
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
    type: CALENDAR_EVENT_TYPE_OPTIONS.some(option => option.value === event?.type)
      ? event.type
      : event?.type
        ? 'event'
        : 'meeting',
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

export function calendarEventFormPayload(form, currentUserId) {
  const title = form.title.trim();
  if (!title) throw new Error('Вкажіть назву події');

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
  if (endAt <= startAt) throw new Error('Завершення має бути пізніше за початок');

  return {
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
  canTrackTime,
  trackingDisabledReason,
  onAddTime,
  onDeleteTime,
  onRespond,
  showOverview = true,
}) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const project = projects.find(item => item.id === event.projectId);
  const recurrence = CALENDAR_EVENT_RECURRENCE_OPTIONS.find(option => option.value === event.recurrence?.frequency);
  const reminderLabels = (event.reminderMinutes || [])
    .map(minutes => CALENDAR_EVENT_REMINDER_OPTIONS.find(option => option.value === minutes)?.label)
    .filter(Boolean);
  return (
    <div className="space-y-[18px]">
      {showOverview && (
        <>
      <div data-ui-surface="local" className="overflow-hidden rounded-[18px] border border-black/[0.05] bg-white">
        <div className="bg-gradient-to-br from-black/[0.035] to-transparent p-[18px]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone="dark" size="wide-sm">
              {TYPE_LABELS.get(event.type) || 'Подія'}
            </Pill>
            {project && <Pill tone="surface" size="wide-sm" appearance="soft-outline">{project.name}</Pill>}
            {event.recurrence?.frequency !== 'none' && <Pill tone="surface" size="wide-sm" appearance="soft-outline" icon={Repeat2}>{recurrence?.label}</Pill>}
          </div>
          <h2 className="ui-type-detail-title leading-tight text-ink">{event.title}</h2>
          <div className="mt-4 grid gap-2 text-[12px] text-muted sm:grid-cols-2">
            <div data-ui-surface="local" className="flex items-start gap-2 rounded-[12px] bg-white p-3 ring-1 ring-black/[0.04]">
              <CalendarDays size={15} className="mt-0.5 shrink-0 text-ink" />
              <span>{event.allDay ? start.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }) : `${start.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })}, ${start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`}</span>
            </div>
            {(event.location || event.meetingUrl) && (
              <div data-ui-surface="local" className="flex items-start gap-2 rounded-[12px] bg-white p-3 ring-1 ring-black/[0.04]">
                {event.meetingUrl ? <Link2 size={15} className="mt-0.5 shrink-0 text-ink" /> : <MapPin size={15} className="mt-0.5 shrink-0 text-ink" />}
                <span className="truncate">{event.location || 'Онлайн-мітинг'}</span>
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
        </>
      )}

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Учасники</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(event.participantIds || []).map(uid => {
            const member = members.find(item => (item.id || item.uid) === uid);
            const state = event.participantResponses?.[uid] || 'pending';
            return (
              <div key={uid} data-ui-surface="local" className="flex items-center gap-2.5 rounded-[12px] border border-black/[0.05] bg-white p-2.5">
                <span className="h-8 w-8 overflow-hidden rounded-full"><UserAvatar user={member || { name: memberLabel(member || {}) }} size="md" /></span>
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
        <div data-ui-surface="panel" data-ui-padding="compact-md" className="ui-surface">
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
          <ExternalLink size={15} /> Приєднатися до мітингу
        </a>
      )}

      {!event.readOnly && ['meeting', 'event', 'focus', 'release'].includes(event.type) && (
        <div data-ui-surface="bordered-card" data-ui-padding="compact-md" className="ui-surface">
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
              <Pill tone="neutral" size="wide-sm">
                План: {Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000))} хв
              </Pill>
            )}
          </div>
          {canTrackTime ? (
            <form className="grid gap-2 sm:grid-cols-[110px_1fr_auto]" onSubmit={onAddTime}>
              <Input name="minutes" type="number" min="1" max="10080" required placeholder="Хвилини" aria-label="Витрачено хвилин" />
              <Input name="description" maxLength={2000} placeholder="Що зроблено (необов’язково)" aria-label="Опис роботи" />
              <Button type="submit" size="sm" loading={timeSaving}>Додати</Button>
            </form>
          ) : (
            <p className="rounded-[10px] bg-canvas px-3 py-2 text-[11px] text-muted">
              {trackingDisabledReason === 'visibility'
                ? 'Трекінг часу доступний лише для командних подій, щоб деталі подій з обмеженою видимістю не потрапили в командну аналітику.'
                : 'У вас немає доступу до трекінгу часу цієї події або її проєкту.'}
            </p>
          )}
          {timeLogs.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {timeLogs.map(log => {
                const member = members.find(item => (item.id || item.uid) === log.userId);
                return (
                  <TimeLogRow
                    key={log.id}
                    member={member || { name: memberLabel(member || {}) }}
                    spentLabel={`${log.spentMinutes} хв`}
                    description={log.description}
                    canEdit={log.userId === currentUserId}
                    onDelete={() => onDeleteTime(log.id)}
                  />
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
  const [form, setForm] = useState(() => calendarEventFormInitialValue(event, initialStart, currentUserId));
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
    canTrackTime,
    trackingDisabledReason,
    addTimeLog,
    deleteTimeLog,
  } = useCalendarEventTimeLogs(
    event?.readOnly ? '' : eventId,
    occurrenceStartAt,
    event?.projectId || '',
  );

  const memberOptions = useMemo(() => members.map(member => ({
    value: member.id || member.uid,
    label: memberLabel(member),
    user: member,
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
    setSaving(true);
    setError('');
    try {
      await onSave(calendarEventFormPayload(form, currentUserId));
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
          canTrackTime={canTrackTime}
          trackingDisabledReason={trackingDisabledReason}
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
        <div className="flex flex-col gap-[6px]">
          <Label required>Назва</Label>
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
          <div className="flex flex-col gap-[6px]">
            <Label>Тип</Label>
            <Select
              value={form.type}
              onChange={value => update('type', value)}
              options={CALENDAR_EVENT_TYPE_OPTIONS}
              disabled={!canManage}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <Label>Проєкт</Label>
            <Select
              value={form.projectId}
              onChange={value => update('projectId', value)}
              options={projectOptions}
              disabled={!canManage}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div className="flex flex-col gap-[6px]">
            <Label icon={Repeat2}>Повторення</Label>
            <Select value={form.recurrenceFrequency} onChange={value => update('recurrenceFrequency', value)} options={CALENDAR_EVENT_RECURRENCE_OPTIONS} />
            {form.recurrenceFrequency !== 'none' && (
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Input type="number" min="1" max="12" value={form.recurrenceInterval} onChange={eventObject => update('recurrenceInterval', eventObject.target.value)} aria-label="Інтервал повторення" />
                <DatePicker
                  value={form.recurrenceUntil}
                  minDate={form.startDate}
                  onChange={value => update('recurrenceUntil', value)}
                  aria-label="Повторювати до дати"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-[6px]">
            <Label icon={BellRing}>Нагадування</Label>
            <MultiSelect
              value={form.reminderMinutes}
              onChange={value => update('reminderMinutes', value)}
              options={CALENDAR_EVENT_REMINDER_OPTIONS}
              placeholder="Додати нагадування"
              searchPlaceholder="Знайти інтервал..."
              className="w-full"
              dropdownClassName="w-full"
            />
            <p className="text-[10px] text-muted">Можна вибрати до п’яти нагадувань.</p>
          </div>
        </div>

        <div data-ui-surface="local" className="overflow-hidden rounded-[14px] border border-line bg-white">
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
            <div className="flex flex-col gap-[6px]">
              <Label icon={CalendarDays}>Початок</Label>
              <div className="flex gap-[8px]">
                <DatePicker
                  value={form.startDate}
                  onChange={value => update('startDate', value)}
                  disabled={!canManage}
                  aria-label="Дата початку"
                />
                {!form.allDay && (
                  <TimePicker
                    value={form.startTime}
                    onChange={value => update('startTime', value)}
                    disabled={!canManage}
                    aria-label="Час початку"
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <Label icon={Clock3}>Завершення</Label>
              <div className="flex gap-[8px]">
                <DatePicker
                  value={form.endDate}
                  onChange={value => update('endDate', value)}
                  disabled={!canManage}
                  aria-label="Дата завершення"
                />
                {!form.allDay && (
                  <TimePicker
                    value={form.endTime}
                    onChange={value => update('endTime', value)}
                    disabled={!canManage}
                    aria-label="Час завершення"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[6px]">
          <Label icon={form.visibility === 'private' ? LockKeyhole : Users}>
            {form.visibility === 'private'
              ? (form.type === 'note' ? 'Приватна нотатка' : 'Приватна подія')
              : 'Учасники'}
          </Label>
          {form.visibility === 'private' ? (
            <div data-ui-surface="compact-bordered-panel" data-ui-padding="row" className="ui-surface text-[12px] text-muted">
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
                  <Pill key={uid} tone="neutral" size="wide-sm" weight="medium">
                    {memberLabel(member || {})}
                    <span className={state === 'accepted' ? 'text-emerald-600' : state === 'declined' ? 'text-red-500' : 'text-muted'}>
                      · {state === 'accepted' ? 'буде' : state === 'tentative' ? 'можливо' : state === 'declined' ? 'не буде' : 'очікуємо'}
                    </span>
                  </Pill>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
          <div className="flex flex-col gap-[6px]">
            <Label icon={MapPin}>Місце</Label>
            <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Офіс або кімната" disabled={!canManage} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <Label icon={Link2}>Посилання</Label>
            <Input type="url" value={form.meetingUrl} onChange={e => update('meetingUrl', e.target.value)} placeholder="https://meet..." disabled={!canManage} />
          </div>
        </div>

        <div className="flex flex-col gap-[6px]">
          <Label>Опис</Label>
          <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Контекст, порядок денний або важливі деталі" disabled={!canManage} rows={4} />
        </div>

        <div className="flex flex-col gap-[6px]">
          <Label>Видимість</Label>
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
