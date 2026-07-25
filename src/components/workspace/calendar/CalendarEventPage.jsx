'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Repeat2,
  Settings2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { useCalendarEventTimeLogs } from '@/lib/hooks/useCalendarEventTimeLogs';
import {
  calendarEventSourceId,
  findCalendarEvent,
} from '@/lib/utils/calendarEventNavigation.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import UserAvatar from '@/components/UserAvatar';
import {
  Button,
  ContextMenu,
  DatePicker,
  EmptyState,
  Input,
  LoadingSpinner,
  Popover,
  Select,
  TaskAttributesPanel,
  Textarea,
  ToggleSwitch,
  useConfirm,
} from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import {
  CALENDAR_EVENT_RECURRENCE_OPTIONS,
  CALENDAR_EVENT_REMINDER_OPTIONS,
  CALENDAR_EVENT_TYPE_OPTIONS,
  CalendarEventDetails,
  calendarEventFormInitialValue,
  calendarEventFormPayload,
} from '@/components/workspace/calendar/CalendarEventDialog';

const VISIBILITY_OPTIONS = [
  { value: 'team', label: 'Уся команда' },
  { value: 'participants', label: 'Лише учасники' },
  { value: 'private', label: 'Лише я', icon: LockKeyhole },
];

function memberLabel(member) {
  return member?.name || member?.displayName || member?.email || 'Учасник';
}

function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return '—';
  if (diff < 60_000) return 'щойно';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} хв тому`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} год тому`;
  const days = Math.floor(diff / 86_400_000);
  return days === 1 ? 'вчора' : `${days} днів тому`;
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : '—';
}

function AttributeValue({ children, muted = false }) {
  return (
    <div className={`flex h-[22px] min-w-0 items-center truncate text-[13px] font-medium ${muted ? 'text-muted' : 'text-ink'}`}>
      {children}
    </div>
  );
}

export default function CalendarEventPage({ eventId, occurrenceStartAt = '' }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { currentUser, projects = [], orgRole } = useAppContext();
  const { members } = useOrganization();
  const {
    events,
    loading,
    error: loadError,
    refresh,
    updateEvent,
    removeEvent,
    respondToEvent,
  } = useCalendarEvents();
  const showToast = useWorkspaceStore(state => state.showToast);
  const currentUserId = currentUser?.uid || currentUser?.id || '';
  const event = useMemo(
    () => findCalendarEvent(events, eventId, occurrenceStartAt),
    [eventId, events, occurrenceStartAt],
  );
  const sourceEventId = calendarEventSourceId(event) || eventId;
  const {
    logs: timeLogs,
    totalMinutes,
    loading: timeLoading,
    addTimeLog,
    deleteTimeLog,
  } = useCalendarEventTimeLogs(event?.readOnly ? '' : sourceEventId, event?.startAt || '');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const canManage = Boolean(event && !event.readOnly && (
    event.organizerId === currentUserId
    || (event.visibility !== 'private' && ['owner', 'admin'].includes(orgRole))
  ));
  const response = event?.participantResponses?.[currentUserId] || 'pending';
  const isParticipant = event?.participantIds?.includes(currentUserId);
  const organizer = members.find(member => (member.id || member.uid) === event?.organizerId);
  const projectOptions = useMemo(() => [
    { value: '', label: 'Без проєкту' },
    ...projects
      .filter(project => project.status !== 'archived')
      .map(project => ({ value: project.id, label: project.name })),
  ], [projects]);
  const memberOptions = useMemo(() => members.map(member => ({
    value: member.id || member.uid,
    label: memberLabel(member),
    avatar: member.avatar || member.photoURL || '',
  })), [members]);

  const copyEventLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Посилання на подію скопійовано');
    } catch {
      showToast('Не вдалося скопіювати посилання', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    useWorkspaceStore.setState({
      breadcrumbs: [
        { label: 'Календар', href: '/calendar' },
        {
          label: event?.title || 'Подія',
          href: null,
          onClick: event ? copyEventLink : undefined,
          title: 'Копіювати посилання на подію',
        },
      ],
    });
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, [copyEventLink, event]);

  const enterEdit = () => {
    if (!canManage || !event) return;
    setDraft(calendarEventFormInitialValue(event, event.startAt, currentUserId));
    setActionError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setActionError('');
    setDetailsOpen(false);
    setIsEditing(false);
  };

  const updateDraft = (key, value) => {
    setDraft(previous => ({ ...previous, [key]: value }));
  };

  const saveEdit = async () => {
    if (!draft || !canManage) return;
    setSaving(true);
    setActionError('');
    try {
      await updateEvent(sourceEventId, calendarEventFormPayload(draft, currentUserId));
      showToast('Подію оновлено', 'success');
      setIsEditing(false);
      setDraft(null);
      setDetailsOpen(false);
    } catch (saveError) {
      setActionError(saveError.message || 'Не вдалося зберегти подію');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManage) return;
    const approved = await confirm({
      title: 'Видалити подію?',
      message: 'Усі запрошені отримають сповіщення про скасування.',
      confirmText: 'Видалити',
      danger: true,
    });
    if (!approved) return;
    try {
      await removeEvent(sourceEventId);
      showToast('Подію скасовано', 'success');
      router.push('/calendar');
    } catch (deleteError) {
      setActionError(deleteError.message || 'Не вдалося видалити подію');
    }
  };

  const handleRespond = async value => {
    setSaving(true);
    setActionError('');
    try {
      await respondToEvent(sourceEventId, value);
      showToast('Відповідь збережено', 'success');
    } catch (responseError) {
      setActionError(responseError.message || 'Не вдалося зберегти відповідь');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTime = async formEvent => {
    formEvent.preventDefault();
    const formElement = formEvent.currentTarget;
    const data = new FormData(formElement);
    setTimeSaving(true);
    setActionError('');
    try {
      await addTimeLog({
        userId: currentUserId,
        projectId: event?.projectId || '',
        spentMinutes: Number(data.get('minutes')),
        description: data.get('description'),
      });
      formElement.reset();
      showToast('Час події додано в аналітику', 'success');
    } catch (timeError) {
      setActionError(timeError.message || 'Не вдалося додати час');
    } finally {
      setTimeSaving(false);
    }
  };

  const handleDeleteTime = async logId => {
    setActionError('');
    try {
      await deleteTimeLog(logId);
      showToast('Запис часу видалено', 'success');
    } catch (timeError) {
      setActionError(timeError.message || 'Не вдалося видалити запис часу');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-[420px] flex-1 items-center justify-center bg-white">
        <EmptyState
          icon={loadError ? RefreshCw : CalendarDays}
          title={loadError ? 'Не вдалося завантажити подію' : 'Подію не знайдено'}
          description={loadError?.message || 'Можливо, подію видалили або у вас немає до неї доступу.'}
          action={loadError ? 'Спробувати ще раз' : 'Повернутися до календаря'}
          onAction={loadError ? refresh : () => router.push('/calendar')}
        />
      </div>
    );
  }

  const view = isEditing && draft ? draft : calendarEventFormInitialValue(event, event.startAt, currentUserId);
  const typeOption = CALENDAR_EVENT_TYPE_OPTIONS.find(option => option.value === view.type);
  const projectOption = projectOptions.find(option => option.value === view.projectId);
  const recurrenceOption = CALENDAR_EVENT_RECURRENCE_OPTIONS.find(option => option.value === view.recurrenceFrequency);
  const reminderLabels = view.reminderMinutes
    .map(value => CALENDAR_EVENT_REMINDER_OPTIONS.find(option => option.value === value)?.label)
    .filter(Boolean);
  const visibilityOption = VISIBILITY_OPTIONS.find(option => option.value === view.visibility);
  const attributeItemClass = 'flex min-w-0 flex-col gap-[4px] rounded-[10px] px-2 py-1.5 transition-colors';
  const attributeLabelClass = 'block overflow-hidden text-[10px] font-bold uppercase tracking-wider text-muted';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-transparent">
      <div className="page-gutter flex min-h-0 flex-1 flex-col overflow-y-auto pb-[40px] pt-[56px] custom-scrollbar">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col">
          <div className="sticky top-0 z-[30] bg-white pb-[12px] pt-[12px]">
            <div className="flex w-full items-start justify-between gap-[16px]">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={inputEvent => updateDraft('title', inputEvent.target.value)}
                    className="w-full border-b-2 border-ink bg-transparent pb-1 text-[24px] font-bold leading-tight tracking-tight text-ink outline-none"
                    placeholder="Назва події…"
                  />
                ) : (
                  <h1 className="text-[24px] font-bold leading-tight tracking-tight text-ink">{event.title}</h1>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] font-medium text-muted">
                  <div className="flex items-center gap-1.5">
                    <span>Організатор:</span>
                    <UserAvatar user={organizer || { name: 'Учасник' }} size={16} />
                    <span className="font-semibold text-ink">{memberLabel(organizer)}</span>
                  </div>
                  <span className="h-[3px] w-[3px] rounded-full bg-faint" />
                  <span>створили <strong className="font-semibold text-ink">{relativeTime(event.createdAt)}</strong></span>
                  <span className="h-[3px] w-[3px] rounded-full bg-faint" />
                  <span>оновили <strong className="font-semibold text-ink">{relativeTime(event.updatedAt || event.createdAt)}</strong></span>
                  {event.sourceEventId && (
                    <>
                      <span className="h-[3px] w-[3px] rounded-full bg-faint" />
                      <span className="inline-flex items-center gap-1"><Repeat2 size={11} /> Серія подій</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pt-1">
                {isEditing ? (
                  <>
                    <Button style="secondary" size="md" icon={X} onClick={cancelEdit}>Скасувати</Button>
                    <Button size="md" icon={Check} onClick={saveEdit} loading={saving}>Зберегти</Button>
                  </>
                ) : (
                  <>
                    {canManage && (
                      <Button
                        style="secondary"
                        size="icon-lg"
                        icon={Pencil}
                        onClick={enterEdit}
                        aria-label="Редагувати подію"
                        title="Редагувати подію"
                      />
                    )}
                    <ContextMenu
                      trigger={(
                        <Button
                          style="secondary"
                          size="icon-lg"
                          icon={MoreHorizontal}
                          aria-label="Опції події"
                          title="Опції"
                        />
                      )}
                      dropdownClassName="w-[210px]"
                      items={[
                        { label: 'Копіювати посилання', icon: Copy, onClick: copyEventLink },
                        ...(canManage ? [
                          { label: 'Редагувати', icon: Pencil, onClick: enterEdit },
                          { label: 'Видалити', icon: Trash2, onClick: handleDelete, isDanger: true },
                        ] : []),
                      ]}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="relative -mx-2 mt-[12px] px-2">
              <TaskAttributesPanel
                singleRow
                compact
                primaryClassName="grid w-full grid-cols-2 items-center gap-1.5 overflow-visible sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1.25fr_92px] [&>*]:min-w-0"
                primaryChildren={(
                  <>
                    <div className={attributeItemClass}>
                      <span className={attributeLabelClass}>Тип</span>
                      {isEditing ? (
                        <Select
                          compact
                          value={draft.type}
                          onChange={value => updateDraft('type', value)}
                          options={CALENDAR_EVENT_TYPE_OPTIONS}
                          buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[8px] bg-transparent px-0 text-[13px] font-medium"
                        />
                      ) : (
                        <AttributeValue><span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: typeOption?.dotColor || '#8b5cf6' }} />{typeOption?.label || 'Подія'}</AttributeValue>
                      )}
                    </div>

                    <div className={attributeItemClass}>
                      <span className={attributeLabelClass}>Проєкт</span>
                      {isEditing ? (
                        <Select
                          compact
                          value={draft.projectId}
                          onChange={value => updateDraft('projectId', value)}
                          options={projectOptions}
                          buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[8px] bg-transparent px-0 text-[13px] font-medium"
                        />
                      ) : (
                        <AttributeValue muted={!event.projectId}>{projectOption?.label || 'Без проєкту'}</AttributeValue>
                      )}
                    </div>

                    <div className={attributeItemClass}>
                      <span className={attributeLabelClass}>Дата</span>
                      {isEditing ? (
                        <DatePicker
                          hideIcon
                          value={draft.startDate}
                          onChange={value => updateDraft('startDate', value)}
                          inputClassName="h-[22px] w-full cursor-pointer bg-transparent p-0 text-[13px] font-medium text-ink outline-none"
                        />
                      ) : (
                        <AttributeValue>{new Date(event.startAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}</AttributeValue>
                      )}
                    </div>

                    <Popover
                      position="bottom"
                      hideCloseIcon
                      className="h-full"
                      trigger={(
                        <button type="button" className={`${attributeItemClass} h-full w-full text-left hover:bg-[#ebebeb]`}>
                          <span className={attributeLabelClass}>Час</span>
                          <AttributeValue>{event.allDay && !isEditing ? 'Весь день' : `${isEditing ? draft.startTime : formatTime(event.startAt)}–${isEditing ? draft.endTime : formatTime(event.endAt)}`}</AttributeValue>
                        </button>
                      )}
                    >
                      <div className="w-[300px] max-w-full space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[12px] font-bold text-ink">Подія на весь день</p>
                            <p className="mt-0.5 text-[10px] text-muted">Без конкретної години</p>
                          </div>
                          <ToggleSwitch
                            checked={view.allDay}
                            onChange={value => updateDraft('allDay', value)}
                            disabled={!isEditing}
                            size="sm"
                            ariaLabel="Подія на весь день"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Початок</span>
                            <Input type="date" value={view.startDate} onChange={inputEvent => updateDraft('startDate', inputEvent.target.value)} disabled={!isEditing} />
                            {!view.allDay && <Input type="time" value={view.startTime} onChange={inputEvent => updateDraft('startTime', inputEvent.target.value)} disabled={!isEditing} />}
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Завершення</span>
                            <Input type="date" value={view.endDate} onChange={inputEvent => updateDraft('endDate', inputEvent.target.value)} disabled={!isEditing} />
                            {!view.allDay && <Input type="time" value={view.endTime} onChange={inputEvent => updateDraft('endTime', inputEvent.target.value)} disabled={!isEditing} />}
                          </div>
                        </div>
                        {!isEditing && <p className="text-[11px] text-muted">Редагування доступне організатору або адміністратору.</p>}
                      </div>
                    </Popover>

                    <div className={attributeItemClass}>
                      <span className={attributeLabelClass}>Учасники</span>
                      {isEditing ? (
                        <MultiSelect
                          value={draft.participantIds}
                          onChange={value => updateDraft('participantIds', value)}
                          options={memberOptions}
                          placeholder="Додати"
                          searchPlaceholder="Знайти учасника…"
                          className="w-full"
                          dropdownClassName="w-[280px]"
                        />
                      ) : (
                        <AttributeValue><Users size={13} className="mr-1.5 shrink-0 text-muted" />{event.participantIds?.length || 0} учасників</AttributeValue>
                      )}
                    </div>

                    <Popover
                      position="bottom"
                      hideCloseIcon
                      className="flex h-full items-center"
                      onOpenChange={setDetailsOpen}
                      trigger={(
                        <button
                          type="button"
                          className={`flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-bold transition-colors ${detailsOpen ? 'bg-white text-ink' : 'text-muted hover:bg-[#ebebeb] hover:text-ink'}`}
                          aria-expanded={detailsOpen}
                        >
                          <Settings2 size={14} />
                          <span>Деталі</span>
                        </button>
                      )}
                    >
                      <div className="w-[300px] max-w-full space-y-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Видимість</span>
                          {isEditing ? (
                            <Select value={draft.visibility} onChange={value => updateDraft('visibility', value)} options={VISIBILITY_OPTIONS} />
                          ) : <AttributeValue>{visibilityOption?.label}</AttributeValue>}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Повторення</span>
                          {isEditing ? (
                            <>
                              <Select value={draft.recurrenceFrequency} onChange={value => updateDraft('recurrenceFrequency', value)} options={CALENDAR_EVENT_RECURRENCE_OPTIONS} />
                              {draft.recurrenceFrequency !== 'none' && (
                                <div className="grid grid-cols-[100px_1fr] gap-2 pt-1">
                                  <Input type="number" min="1" max="12" value={draft.recurrenceInterval} onChange={inputEvent => updateDraft('recurrenceInterval', inputEvent.target.value)} aria-label="Інтервал повторення" />
                                  <Input type="date" value={draft.recurrenceUntil} min={draft.startDate} onChange={inputEvent => updateDraft('recurrenceUntil', inputEvent.target.value)} aria-label="Повторювати до дати" />
                                </div>
                              )}
                            </>
                          ) : <AttributeValue><Repeat2 size={13} className="mr-1.5 text-muted" />{recurrenceOption?.label}</AttributeValue>}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Нагадування</span>
                          {isEditing ? (
                            <MultiSelect
                              value={draft.reminderMinutes}
                              onChange={value => updateDraft('reminderMinutes', value)}
                              options={CALENDAR_EVENT_REMINDER_OPTIONS}
                              placeholder="Додати нагадування"
                              searchPlaceholder="Знайти інтервал…"
                              className="w-full"
                              dropdownClassName="w-[280px]"
                            />
                          ) : (
                            <AttributeValue muted={!reminderLabels.length}><BellRing size={13} className="mr-1.5" />{reminderLabels.length ? reminderLabels.join(', ') : 'Без нагадувань'}</AttributeValue>
                          )}
                        </div>
                      </div>
                    </Popover>
                  </>
                )}
              />
            </div>
          </div>

          <main className="grid gap-[20px] pt-[8px] lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-[20px]">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Опис</p>
                {isEditing ? (
                  <Textarea
                    value={draft.description}
                    onChange={inputEvent => updateDraft('description', inputEvent.target.value)}
                    placeholder="Контекст, порядок денний або важливі деталі"
                    rows={7}
                    className="min-h-[180px]"
                  />
                ) : (
                  <div className="min-h-[140px] whitespace-pre-wrap rounded-[14px] bg-canvas p-4 text-[13px] leading-relaxed text-ink">
                    {event.description || <span className="text-faint">Опис не додано</span>}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[14px] border border-line bg-white p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted"><MapPin size={13} /> Місце</p>
                  {isEditing ? (
                    <Input value={draft.location} onChange={inputEvent => updateDraft('location', inputEvent.target.value)} placeholder="Офіс або кімната" />
                  ) : (
                    <p className="text-[13px] font-medium text-ink">{event.location || <span className="text-faint">Не вказано</span>}</p>
                  )}
                </div>
                <div className="rounded-[14px] border border-line bg-white p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted"><Link2 size={13} /> Посилання</p>
                  {isEditing ? (
                    <Input type="url" value={draft.meetingUrl} onChange={inputEvent => updateDraft('meetingUrl', inputEvent.target.value)} placeholder="https://meet…" />
                  ) : event.meetingUrl ? (
                    <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:underline">
                      Приєднатися <ExternalLink size={12} />
                    </a>
                  ) : (
                    <p className="text-[13px] text-faint">Не вказано</p>
                  )}
                </div>
              </div>
            </section>

            <aside className="rounded-[16px] border border-line bg-white p-[14px]">
              <CalendarEventDetails
                event={event}
                members={members}
                projects={projects}
                currentUserId={currentUserId}
                response={response}
                isParticipant={isParticipant}
                saving={saving}
                error={actionError}
                timeLogs={timeLogs}
                totalMinutes={totalMinutes}
                timeLoading={timeLoading}
                timeSaving={timeSaving}
                onAddTime={handleAddTime}
                onDeleteTime={handleDeleteTime}
                onRespond={handleRespond}
                showOverview={false}
              />
            </aside>
          </main>

          {isEditing && actionError && (
            <p className="mt-4 text-[12px] font-medium text-red-600">{actionError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
