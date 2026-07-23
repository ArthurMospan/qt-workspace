'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  List,
  Plus,
  RefreshCw,
  Users,
  Video,
} from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  Button,
  EmptyState,
  FilterBar,
  LoadingSpinner,
  PageHeader,
  Select,
  Surface,
} from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import CalendarEventDialog from '@/components/workspace/calendar/CalendarEventDialog';

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const HOURS = Array.from({ length: 15 }, (_, index) => index + 7);
const TYPE_CONFIG = {
  meeting: { label: 'Мітинг', color: '#3b82f6', bg: '#eff6ff', icon: Video },
  event: { label: 'Подія', color: '#8b5cf6', bg: '#f5f3ff', icon: CalendarDays },
  focus: { label: 'Фокус-час', color: '#14b8a6', bg: '#f0fdfa', icon: Clock3 },
  absence: { label: 'Відсутність', color: '#f59e0b', bg: '#fffbeb', icon: Users },
  release: { label: 'Реліз / етап', color: '#ef4444', bg: '#fef2f2', icon: Flag },
};

function FilterDivider() {
  return <span className="mx-[2px] h-[16px] w-px shrink-0 bg-[#e3e3e3]" />;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value) {
  const date = startOfDay(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addMonths(value, amount) {
  const date = new Date(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return date;
}

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function dateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isEventOnDay(event, day) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(dayStart, 1).getTime();
  return new Date(event.startAt).getTime() < dayEnd && new Date(event.endAt).getTime() > dayStart;
}

function shortTime(value) {
  return new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function monthTitle(date) {
  const result = date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function periodTitle(anchor, view) {
  if (view === 'month') return monthTitle(anchor);
  if (view === 'day') {
    return anchor.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  if (view === 'agenda') return 'Найближчі події';
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function eventTimeLabel(event) {
  if (event.allDay) return 'Весь день';
  return `${shortTime(event.startAt)}–${shortTime(event.endAt)}`;
}

function EventCard({ event, compact = false, onClick }) {
  const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.event;
  const Icon = config.icon;
  return (
    <button
      type="button"
      onClick={clickEvent => {
        clickEvent.stopPropagation();
        onClick(event);
      }}
      className={`w-full text-left rounded-[8px] border-l-[3px] transition-[filter,transform] hover:brightness-[0.98] active:scale-[0.99] ${
        compact ? 'px-[7px] py-[5px]' : 'px-[9px] py-[7px]'
      }`}
      style={{ backgroundColor: config.bg, borderLeftColor: config.color }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={compact ? 11 : 12} style={{ color: config.color }} className="shrink-0" />
        <span className={`font-bold text-ink truncate ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{event.title}</span>
      </div>
      {!compact && <span className="block text-[10px] text-muted mt-1">{eventTimeLabel(event)}</span>}
    </button>
  );
}

function DeadlineCard({ deadline, compact = false, onClick }) {
  return (
    <button
      type="button"
      onClick={clickEvent => {
        clickEvent.stopPropagation();
        onClick(deadline);
      }}
      className={`w-full text-left rounded-[8px] bg-white border border-line hover:border-[#d4d4d4] transition-colors ${
        compact ? 'px-[7px] py-[5px]' : 'px-[9px] py-[7px]'
      } ${deadline.completed ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        <span className={`font-bold text-ink truncate ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {deadline.issueKey ? `${deadline.issueKey} · ` : ''}{deadline.title}
        </span>
      </div>
    </button>
  );
}

function AllDayRow({ days, events, deadlines, onEventClick, onDeadlineClick }) {
  return (
    <div className="grid border-b border-line bg-[#fafafa]" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(120px, 1fr))` }}>
      <div className="px-2 py-2 text-[10px] font-semibold text-muted border-r border-line">Весь день</div>
      {days.map(day => {
        const dayEvents = events.filter(event => event.allDay && isEventOnDay(event, day));
        const dayDeadlines = deadlines.filter(deadline => sameDay(deadline.dueDate, day));
        return (
          <div key={dateKey(day)} className="min-h-[48px] p-[5px] border-r last:border-r-0 border-line space-y-[4px]">
            {dayEvents.map(event => <EventCard key={event.id} event={event} compact onClick={onEventClick} />)}
            {dayDeadlines.map(deadline => <DeadlineCard key={deadline.id} deadline={deadline} compact onClick={onDeadlineClick} />)}
          </div>
        );
      })}
    </div>
  );
}

function ScheduleView({ anchor, view, events, deadlines, onEventClick, onDeadlineClick, onCreate }) {
  const days = view === 'day'
    ? [startOfDay(anchor)]
    : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));
  const today = new Date();

  return (
    <div className="min-w-[780px]">
      <div className="grid border-b border-line bg-white sticky top-0 z-10" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(120px, 1fr))` }}>
        <div className="border-r border-line" />
        {days.map((day, index) => (
          <div key={dateKey(day)} className="h-[58px] flex items-center justify-center gap-2 border-r last:border-r-0 border-line">
            <span className="text-[10px] uppercase font-bold text-muted">{DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}</span>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${
              sameDay(day, today) ? 'bg-ink text-white' : 'text-ink'
            }`}>{day.getDate()}</span>
            {view === 'week' && index > 4 && <span className="sr-only">Вихідний</span>}
          </div>
        ))}
      </div>

      <AllDayRow
        days={days}
        events={events}
        deadlines={deadlines}
        onEventClick={onEventClick}
        onDeadlineClick={onDeadlineClick}
      />

      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(120px, 1fr))` }}>
        <div className="relative border-r border-line" style={{ height: HOURS.length * 60 }}>
          {HOURS.map((hour, index) => (
            <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted" style={{ top: index * 60 }}>
              {String(hour).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map(day => {
          const timedEvents = events.filter(event => !event.allDay && sameDay(event.startAt, day));
          return (
            <div
              key={dateKey(day)}
              className={`relative border-r last:border-r-0 border-line ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-[#fcfcfc]' : 'bg-white'}`}
              style={{ height: HOURS.length * 60 }}
            >
              {HOURS.map((hour, index) => (
                <button
                  type="button"
                  key={hour}
                  aria-label={`Створити подію о ${hour}:00`}
                  className="absolute left-0 right-0 border-t border-[#ededed] hover:bg-black/[0.015] transition-colors"
                  style={{ top: index * 60, height: 60 }}
                  onClick={() => {
                    const start = new Date(day);
                    start.setHours(hour, 0, 0, 0);
                    onCreate(start);
                  }}
                />
              ))}
              {timedEvents.map(event => {
                const start = new Date(event.startAt);
                const end = new Date(event.endAt);
                const top = Math.max(0, (start.getHours() - HOURS[0]) * 60 + start.getMinutes());
                const rawHeight = Math.max(34, (end.getTime() - start.getTime()) / 60_000);
                const height = Math.min(rawHeight, HOURS.length * 60 - top);
                return (
                  <div key={event.id} className="absolute left-[4px] right-[4px] z-[2]" style={{ top: top + 2, height: Math.max(30, height - 4) }}>
                    <EventCard event={event} onClick={onEventClick} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ anchor, events, deadlines, onEventClick, onDeadlineClick, onCreate, onSelectDay }) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const today = new Date();
  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b border-line bg-white">
        {DAY_NAMES.map(name => (
          <div key={name} className="h-[38px] flex items-center justify-center text-[10px] font-bold uppercase text-muted border-r last:border-r-0 border-line">{name}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayEvents = events.filter(event => isEventOnDay(event, day));
          const dayDeadlines = deadlines.filter(deadline => sameDay(deadline.dueDate, day));
          const items = [
            ...dayEvents.map(item => ({ kind: 'event', item, time: new Date(item.startAt).getTime() })),
            ...dayDeadlines.map(item => ({ kind: 'deadline', item, time: new Date(item.dueDate).getTime() })),
          ].sort((a, b) => a.time - b.time);
          return (
            <div
              key={dateKey(day)}
              className={`min-h-[128px] p-[7px] border-r border-b border-line last:border-r-0 group ${
                day.getMonth() !== anchor.getMonth() ? 'bg-[#fafafa]' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-[6px]">
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={`w-7 h-7 rounded-full text-[11px] font-bold ${
                    sameDay(day, today) ? 'bg-ink text-white' : day.getMonth() === anchor.getMonth() ? 'text-ink hover:bg-canvas' : 'text-faint'
                  }`}
                >
                  {day.getDate()}
                </button>
                <button type="button" onClick={() => onCreate(day)} className="w-6 h-6 rounded-[7px] opacity-0 group-hover:opacity-100 hover:bg-canvas flex items-center justify-center text-muted transition-all" aria-label="Додати подію">
                  <Plus size={13} />
                </button>
              </div>
              <div className="space-y-[4px]">
                {items.slice(0, 3).map(({ kind, item }) => kind === 'event'
                  ? <EventCard key={`e-${item.id}`} event={item} compact onClick={onEventClick} />
                  : <DeadlineCard key={`d-${item.id}`} deadline={item} compact onClick={onDeadlineClick} />)}
                {items.length > 3 && (
                  <button type="button" onClick={() => onSelectDay(day)} className="text-[10px] font-semibold text-muted hover:text-ink pl-1">
                    ще {items.length - 3}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ anchor, events, deadlines, onEventClick, onDeadlineClick, onCreate }) {
  const start = startOfDay(anchor);
  const end = addDays(start, 60);
  const grouped = new Map();
  const addItem = (date, entry) => {
    const key = dateKey(date);
    if (!grouped.has(key)) grouped.set(key, { date: startOfDay(date), items: [] });
    grouped.get(key).items.push(entry);
  };
  events.forEach(event => {
    const startDate = new Date(event.startAt);
    if (startDate >= start && startDate < end) addItem(startDate, { kind: 'event', item: event, time: startDate.getTime() });
  });
  deadlines.forEach(deadline => {
    const dueDate = new Date(deadline.dueDate);
    if (dueDate >= start && dueDate < end) addItem(dueDate, { kind: 'deadline', item: deadline, time: dueDate.getTime() });
  });
  const groups = [...grouped.values()].sort((a, b) => a.date - b.date);

  if (!groups.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="У найближчі 60 днів нічого немає"
        description="Створіть мітинг, подію або командне нагадування."
        action="Створити подію"
        onAction={() => onCreate(new Date())}
      />
    );
  }

  return (
    <div className="max-w-[920px] mx-auto p-[12px] md:p-[20px] space-y-[20px]">
      {groups.map(group => (
        <section key={dateKey(group.date)} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-[8px] md:gap-[18px]">
          <div>
            <p className="text-[12px] font-bold text-ink">
              {sameDay(group.date, new Date()) ? 'Сьогодні' : group.date.toLocaleDateString('uk-UA', { weekday: 'long' })}
            </p>
            <p className="text-[11px] text-muted mt-0.5">{group.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="space-y-[7px]">
            {group.items.sort((a, b) => a.time - b.time).map(({ kind, item }) => (
              kind === 'event' ? (
                <div key={`e-${item.id}`} className="flex items-center gap-[10px]">
                  <span className="w-[70px] text-[11px] font-semibold text-muted shrink-0">{eventTimeLabel(item)}</span>
                  <EventCard event={item} onClick={onEventClick} />
                </div>
              ) : (
                <div key={`d-${item.id}`} className="flex items-center gap-[10px]">
                  <span className="w-[70px] text-[11px] font-semibold text-muted shrink-0">Дедлайн</span>
                  <DeadlineCard deadline={item} onClick={onDeadlineClick} />
                </div>
              )
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const { currentUser, projects, activeOrgId, orgRole } = useAppContext();
  const { members } = useOrganization();
  const {
    events,
    deadlines,
    loading,
    error,
    refresh,
    createEvent,
    updateEvent,
    removeEvent,
    respondToEvent,
  } = useCalendarEvents();
  const showToast = useWorkspaceStore(state => state.showToast);
  const calendarSearch = useWorkspaceStore(state => state.calendarSearch);
  const currentUserId = currentUser?.uid || currentUser?.id;
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilters, setProjectFilters] = useState([]);
  const [memberFilter, setMemberFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [initialStart, setInitialStart] = useState(null);

  const filteredEvents = useMemo(() => events.filter(event => {
    const search = calendarSearch.trim().toLowerCase();
    if (search && !`${event.title || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase().includes(search)) return false;
    if (typeFilter !== 'all' && typeFilter !== event.type) return false;
    if (projectFilters.length && !projectFilters.includes(event.projectId)) return false;
    if (memberFilter !== 'all' && !event.participantIds?.includes(memberFilter)) return false;
    return true;
  }), [calendarSearch, events, memberFilter, projectFilters, typeFilter]);
  const filteredDeadlines = useMemo(() => deadlines.filter(deadline => {
    const search = calendarSearch.trim().toLowerCase();
    if (search && !`${deadline.issueKey || ''} ${deadline.title || ''}`.toLowerCase().includes(search)) return false;
    if (typeFilter !== 'all' && typeFilter !== 'deadline') return false;
    if (projectFilters.length && !projectFilters.includes(deadline.projectId)) return false;
    if (memberFilter !== 'all' && !deadline.assigneeIds?.includes(memberFilter)) return false;
    return true;
  }), [calendarSearch, deadlines, memberFilter, projectFilters, typeFilter]);

  useEffect(() => {
    if (!events.length) return;
    const eventId = new URLSearchParams(window.location.search).get('event');
    if (!eventId) return;
    const matching = events.find(event => event.id === eventId || event.sourceEventId === eventId);
    if (matching) {
      queueMicrotask(() => {
        setSelectedEvent(matching);
        setAnchor(new Date(matching.startAt));
        setDialogOpen(true);
        window.history.replaceState(null, '', '/calendar');
      });
    }
  }, [events]);

  const movePeriod = direction => {
    setAnchor(previous => {
      if (view === 'month') return addMonths(previous, direction);
      if (view === 'week') return addDays(previous, direction * 7);
      if (view === 'agenda') return addDays(previous, direction * 30);
      return addDays(previous, direction);
    });
  };

  const openCreate = date => {
    setSelectedEvent(null);
    setInitialStart(date || new Date());
    setDialogOpen(true);
  };

  const openEvent = event => {
    setSelectedEvent(event);
    setInitialStart(null);
    setDialogOpen(true);
  };

  const handleSave = async data => {
    if (selectedEvent) await updateEvent(selectedEvent.sourceEventId || selectedEvent.id, data);
    else await createEvent(data);
    setDialogOpen(false);
    showToast(selectedEvent ? 'Подію оновлено' : 'Подію створено, запрошення надіслано', 'success');
  };

  const handleDelete = async () => {
    await removeEvent(selectedEvent.sourceEventId || selectedEvent.id);
    setDialogOpen(false);
    showToast('Подію скасовано', 'success');
  };

  const handleRespond = async response => {
    const updated = await respondToEvent(selectedEvent.sourceEventId || selectedEvent.id, response);
    setSelectedEvent(previous => ({ ...previous, participantResponses: updated.participantResponses }));
    showToast('Відповідь збережено', 'success');
  };

  const canManageSelected = !selectedEvent ||
    selectedEvent.organizerId === currentUserId ||
    ['owner', 'admin'].includes(orgRole);

  const filterOptions = [
    { value: 'all', label: 'Усі типи' },
    ...Object.entries(TYPE_CONFIG).map(([value, config]) => ({ value, label: config.label, dotColor: config.color })),
    { value: 'deadline', label: 'Дедлайни задач', dotColor: '#ef4444' },
  ];
  const projectOptions = [
    ...projects.filter(project => project.status !== 'archived').map(project => ({ value: project.id, label: project.name })),
  ];
  const memberOptions = [
    { value: 'all', label: 'Уся команда' },
    ...members.map(member => ({
      value: member.id || member.uid,
      label: member.name || member.displayName || member.email || 'Учасник',
      avatar: member.avatar || member.photoURL || '',
    })),
  ];

  return (
    <div className="flex-1 h-full overflow-hidden bg-transparent">
      <div className="w-full h-full flex flex-col page-gutter pt-[56px] pb-[12px]">
        <PageHeader
          title="Календар"
          tabs={[
            { id: 'day', label: 'День' },
            { id: 'week', label: 'Тиждень' },
            { id: 'month', label: 'Місяць' },
            { id: 'agenda', label: 'Порядок денний', icon: List },
          ]}
          activeTab={view}
          onTabChange={setView}
          actions={<Button icon={Plus} collapseAt="sm" onClick={() => openCreate(new Date())}>Нова подія</Button>}
          filters={
            <>
              <FilterBar className="overflow-visible">
                <Select variant="ghost" value={typeFilter} onChange={setTypeFilter} options={filterOptions} className="w-[136px]" />
                <MultiSelect
                  variant="ghost"
                  value={projectFilters}
                  onChange={setProjectFilters}
                  options={projectOptions}
                  placeholder="Всі проєкти"
                  searchPlaceholder="Пошук проєкту..."
                  className="w-[200px]"
                />
                <Select variant="ghost" value={memberFilter} onChange={setMemberFilter} options={memberOptions} className="w-[148px]" />
                <FilterDivider />
                <Button style="ghost" size="icon-sm" icon={ChevronLeft} onClick={() => movePeriod(-1)} aria-label="Попередній період" />
                <Button style="ghost" size="sm" onClick={() => setAnchor(new Date())}>Сьогодні</Button>
                <Button style="ghost" size="icon-sm" icon={ChevronRight} onClick={() => movePeriod(1)} aria-label="Наступний період" />
                <FilterDivider />
                <span className="max-w-[260px] truncate px-2 text-[12px] font-bold text-ink">{periodTitle(anchor, view)}</span>
              </FilterBar>
              <span className="hidden xl:inline text-[11px] text-muted">Дедлайни із задач додаються автоматично</span>
            </>
          }
        />

        <div className="flex flex-col gap-[12px] min-h-0 flex-1">
          <Surface variant="panel" padding="sm" className="min-h-0 flex-1 overflow-hidden">
            <div className="h-full bg-white rounded-[12px] overflow-auto custom-scrollbar">
              {loading ? (
                <div className="h-full min-h-[320px] flex items-center justify-center"><LoadingSpinner size="md" /></div>
              ) : error ? (
                <EmptyState
                  icon={RefreshCw}
                  title="Не вдалося завантажити календар"
                  description={error.message}
                  action="Спробувати ще раз"
                  onAction={refresh}
                />
              ) : view === 'month' ? (
                <MonthView
                  anchor={anchor}
                  events={filteredEvents}
                  deadlines={filteredDeadlines}
                  onEventClick={openEvent}
                  onDeadlineClick={deadline => router.push(`/${deadline.projectId}/issue/${deadline.id}`)}
                  onCreate={openCreate}
                  onSelectDay={day => { setAnchor(day); setView('day'); }}
                />
              ) : view === 'agenda' ? (
                <AgendaView
                  anchor={anchor}
                  events={filteredEvents}
                  deadlines={filteredDeadlines}
                  onEventClick={openEvent}
                  onDeadlineClick={deadline => router.push(`/${deadline.projectId}/issue/${deadline.id}`)}
                  onCreate={openCreate}
                />
              ) : (
                <ScheduleView
                  anchor={anchor}
                  view={view}
                  events={filteredEvents}
                  deadlines={filteredDeadlines}
                  onEventClick={openEvent}
                  onDeadlineClick={deadline => router.push(`/${deadline.projectId}/issue/${deadline.id}`)}
                  onCreate={openCreate}
                />
              )}
            </div>
          </Surface>
        </div>
      </div>

      {dialogOpen && (
        <CalendarEventDialog
          isOpen
          event={selectedEvent}
          initialStart={initialStart}
          members={members}
          projects={projects}
          currentUserId={currentUserId}
          canManage={canManageSelected}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          onRespond={handleRespond}
        />
      )}
    </div>
  );
}
