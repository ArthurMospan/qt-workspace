'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Link2,
  MapPin,
  Minus,
  Trash2,
  Users,
} from 'lucide-react';
import { Button, Dialog, Input, Select, Textarea } from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmProvider';

const TYPE_OPTIONS = [
  { value: 'meeting', label: 'Мітинг', dotColor: '#3b82f6' },
  { value: 'event', label: 'Подія', dotColor: '#8b5cf6' },
  { value: 'focus', label: 'Фокус-час', dotColor: '#14b8a6' },
  { value: 'absence', label: 'Відсутність', dotColor: '#f59e0b' },
  { value: 'release', label: 'Реліз / етап', dotColor: '#ef4444' },
];

const RESPONSE_OPTIONS = [
  { value: 'accepted', label: 'Буду', icon: Check },
  { value: 'tentative', label: 'Можливо', icon: Minus },
  { value: 'declined', label: 'Не буду', icon: Minus },
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
  const start = event?.startAt ? new Date(event.startAt) : new Date(initialStart || Date.now());
  if (!event?.startAt) {
    start.setMinutes(start.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (start.getMinutes() === 0) start.setHours(start.getHours() + 1);
  }
  const end = event?.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
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
  };
}

function memberLabel(member) {
  return member.name || member.displayName || member.email || 'Учасник';
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
}) {
  const confirm = useConfirm();
  const [form, setForm] = useState(() => initialForm(event, initialStart, currentUserId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      await onSave({
        title: form.title,
        type: form.type,
        description: form.description,
        location: form.location,
        meetingUrl: form.meetingUrl,
        projectId: form.projectId,
        visibility: form.visibility,
        participantIds: form.participantIds,
        allDay: form.allDay,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
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
      <Button style="secondary" size="md" onClick={onClose}>Скасувати</Button>
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
      title={event ? (canManage ? 'Подія' : 'Деталі події') : 'Нова подія'}
      size="lg"
      footer={footer}
    >
      <form id="calendar-event-form" onSubmit={submit} className="flex flex-col gap-[20px]">
        <div className="space-y-[8px]">
          <label className="text-[12px] font-bold text-ink">Назва</label>
          <Input
            autoFocus
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

        <div className="rounded-[14px] bg-canvas p-[12px] space-y-[12px]">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-[12px] font-bold text-ink">Подія на весь день</span>
              <span className="block text-[11px] text-muted mt-0.5">Без прив’язки до конкретної години</span>
            </span>
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={e => update('allDay', e.target.checked)}
              disabled={!canManage}
              className="w-4 h-4 accent-[#1f1f1f]"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
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
            <Users size={14} /> Учасники
          </label>
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
          {event && form.participantIds.length > 0 && (
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
            ]}
            disabled={!canManage}
          />
        </div>

        {event && isParticipant && event.organizerId !== currentUserId && (
          <div className="rounded-[14px] border border-line p-[14px]">
            <p className="text-[12px] font-bold text-ink mb-[10px]">Ваша відповідь</p>
            <div className="flex flex-wrap gap-[8px]">
              {RESPONSE_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  style={response === option.value ? 'primary' : 'secondary'}
                  size="sm"
                  icon={option.icon}
                  onClick={() => handleResponse(option.value)}
                  disabled={saving}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {event?.meetingUrl && !canManage && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[36px] items-center justify-center gap-2 rounded-[10px] bg-ink px-4 text-[13px] font-bold text-white hover:bg-ink-hover"
          >
            <Link2 size={15} /> Приєднатися
          </a>
        )}

        {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
      </form>
    </Dialog>
  );
}
