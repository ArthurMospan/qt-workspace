import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CakeSlice, Clock3, LockKeyhole, Mail, MapPin, Phone, Zap, Send, MoreVertical, Shield, BarChart2, X } from 'lucide-react';
import { CalendarIcon, ChatIcon, TaskIcon } from '@/lib/design/icons';
import { Surface, Card, Badge, StatusBadge, Button, IconAction, Tabs, ContextMenu, EmptyState, LoadingSpinner, Tooltip } from '@/components/ui';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { calendarEventHref } from '@/lib/utils/calendarEventNavigation.mjs';

const EVENT_TYPE_LABELS = {
  meeting: 'Мітинг',
  event: 'Подія',
  focus: 'Фокус-час',
  absence: 'Відсутність',
  release: 'Реліз / етап',
  note: 'Нотатка',
  reminder: 'Нагадування',
  milestone: 'Подія',
  birthday: 'День народження',
};

const getRealProfileDetails = (member) => {
  const skills = member.profile?.skills || member.skills;
  return {
    bio:      member.profile?.bio      || member.bio      || null,
    skills:   Array.isArray(skills) && skills.length ? skills : null,
    telegram: member.profile?.telegram || member.telegram || null,
    phone:    member.profile?.phone    || member.phone    || null,
    location: member.profile?.location || member.location || null,
    timezone: member.profile?.timezone || member.timezone || member.localization?.timezone || null,
    birthday: member.profile?.birthday || member.birthday || null,
  };
};

export default function ProfileView({ user, onClose }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const router = useRouter();
  const { currentUser, projects, orgRole, activeOrgId } = useAppContext();
  const { tasks } = useAllMyTasks(user?.id || user?.uid);
  const { positions = [], doneStatusIds } = useWorkflowConfig();
  const { members: orgMembers } = useOrganization();
  const { events: calendarEvents, loading: calendarLoading } = useCalendarEvents();
  const [activeTab, setActiveTab] = useState('profile');

  if (!user) return null;

  const uid = user.id || user.uid;
  const isMe = uid === (currentUser?.id || currentUser?.uid);
  const isAdminOrOwner = orgRole === 'admin' || orgRole === 'owner';
  // Live membership record — hourlyRate lives in orgMemberships, not the user doc
  const memberRecord = orgMembers.find(m => (m.id || m.uid) === uid);
  
  const isOnline = user.lastActive && (now - new Date(user.lastActive).getTime() < 120000);
  const details = getRealProfileDetails(user);

  const positionName = positions.find(p => p.id === user.positionId)?.label || user.positionId || user.title || user.email;

  const allActiveTasks = tasks.filter(task => {
    const project = projects.find(item => item.id === task.projectId);
    return project?.status !== 'archived' && !doneStatusIds.includes(task.columnId || task.status);
  });
  const nowTime = now;
  const agendaEvents = calendarEvents
    .filter(event => {
      const endTime = new Date(event.endAt).getTime();
      if (!Number.isFinite(endTime) || endTime < nowTime) return false;
      return event.birthdayUserId === uid ||
        event.organizerId === uid ||
        event.participantIds?.includes(uid);
    })
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    .slice(0, 30);

  const handleTaskClick = (task) => {
    if (onClose) onClose();
    router.push(`/${task.projectId}/issue/${task.id}`);
  };

  const handleEmergencyCall = async () => {
    try {
      const emergencyText = `🆘 ЕКСТРЕННИЙ ВИКЛИК від ${currentUser?.name || 'Учасника'}!`;
      const link = `/chat?dm=${encodeURIComponent(currentUser?.id || currentUser?.uid || '')}`;

      await sendNotification({
        userIds: [uid],
        type: 'emergency',
        title: '🆘 Екстрений виклик',
        body: emergencyText,
        link,
        organizationId: activeOrgId,
      });

      useWorkspaceStore.getState().showToast(`Виклик надіслано ${user.name || 'користувачу'}`, 'success');
      if (onClose) onClose();
    } catch (e) {
      console.error(e);
      useWorkspaceStore.getState().showToast('Помилка при надсиланні виклику', 'error');
    }
  };

  const tabsConfig = [
    { id: 'profile', label: 'Профіль' },
    { id: 'tasks', label: `Задачі (${allActiveTasks.length})` },
    { id: 'events', label: `Події (${agendaEvents.length})` },
  ];

  const memberMenu = [
    { label: 'Екстрений виклик', icon: Zap, isDanger: true, onClick: handleEmergencyCall },
    ...(isAdminOrOwner ? [
      { isDivider: true },
      { label: 'Керування доступом', icon: Shield, onClick: () => { if(onClose) onClose(); router.push(`/settings?section=team&user=${uid}`); } },
      { label: 'Аналітика учасника', icon: BarChart2, onClick: () => { if(onClose) onClose(); router.push(`/analytics?tab=workload&teamMember=${uid}`); } },
    ] : []),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white relative">
      {onClose && (
        <div className="absolute top-4 right-4 z-10">
          <Button style="secondary" size="icon" icon={X} onClick={onClose} aria-label="Закрити" />
        </div>
      )}
      {/* HEADER SECTION */}
      <div className="shrink-0 pt-8 pb-4 flex flex-col items-center">
        <div className="flex flex-col items-center text-center px-8">
          <div className="relative mb-2">
            <UserAvatar user={user} size="hero" />
            {isOnline && (
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10b981] rounded-full ring-4 ring-white" />
            )}
            {(user.status || user.statusEmoji) && (
              <div data-ui-surface="local" className="absolute top-[-20px] left-[65%] bg-white border border-[#f0f0f0] rounded-[18px] px-[12px] py-[8px] shadow-lg flex items-center gap-[6px] z-20 max-w-[180px] min-w-[50px]">
                <span className="text-[18px] shrink-0">{user.statusEmoji}</span>
                {user.status && (
                  <span className="text-[13px] font-normal text-ink tracking-tight truncate">
                    {user.status}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1 text-center items-center">
            <h2 className="ui-type-profile-title text-ink">{user.name || user.email} {isMe && <span className="text-muted font-normal text-[18px]">(ти)</span>}</h2>
            <p className="text-[14px] text-muted font-medium">
              {positionName}
            </p>
          </div>

          {/* Actions — four 56px circles.
              Labels went first: four one-word buttons read as a sentence rather
              than a set of actions. Then the icons themselves, which were
              invented here — `CheckSquare` for a task, `CalendarPlus` for an
              event, `MessageCircle` for chat — while the sidebar, the mobile bar
              and the palette each showed something else for the same three
              things. They all read the same three names now.
              The emergency call moved into the menu: it is the one action here
              nobody performs by accident, and it was the loudest thing on a
              colleague's profile. */}
          {!isMe && (
            <div className="flex items-center gap-2 mt-4">
              {/* Each circle carries its name twice: as the accessible label a
                  screen reader reads, and as a tooltip for everyone else. An
                  icon on its own says nothing, and these four are the whole
                  action row — there is no text anywhere near them. */}
              <Tooltip content="Написати повідомлення">
                <IconAction
                  label="Написати повідомлення"
                  icon={ChatIcon}
                  size="xl"
                  appearance="contrast"
                  onClick={() => {
                    if (onClose) onClose();
                    router.push(`/chat?dm=${encodeURIComponent(uid)}`);
                  }}
                />
              </Tooltip>
              <Tooltip content="Створити завдання">
                <IconAction
                  label="Створити завдання для учасника"
                  icon={TaskIcon}
                  size="xl"
                  appearance="contrast"
                  onClick={() => {
                    if (onClose) onClose();
                    router.push(`/my?new=1&assignee=${encodeURIComponent(uid)}`);
                  }}
                />
              </Tooltip>
              <Tooltip content="Створити подію">
                <IconAction
                  label="Створити подію з учасником"
                  icon={CalendarIcon}
                  size="xl"
                  appearance="contrast"
                  onClick={() => {
                    if (onClose) onClose();
                    router.push(`/calendar?new=1&with=${encodeURIComponent(uid)}`);
                  }}
                />
              </Tooltip>
              {/* The tooltip goes around the menu, not around its trigger:
                  ContextMenu clones the trigger to attach its own onClick, and
                  Tooltip does not forward props to what it wraps — so a Tooltip
                  as the trigger would swallow the click that opens the menu. */}
              <Tooltip content="Ще дії">
                <ContextMenu
                  trigger={
                    <IconAction label="Інші дії з учасником" icon={MoreVertical} size="xl" appearance="contrast" />
                  }
                  items={memberMenu}
                />
              </Tooltip>
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="mt-6 flex justify-center w-full px-8">
          <Tabs variant="raised" tabs={tabsConfig} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* BODY SECTION */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 w-full max-w-[800px] mx-auto">
        
        {activeTab === 'profile' && (
          <div className="flex flex-col gap-8">
            {/* Про себе */}
            {(details.bio || isMe) && (
              <div className="flex flex-col gap-3">
                <h3 className="ui-type-column-title text-muted uppercase tracking-wider">Про себе</h3>
                {details.bio ? (
                  <p className="text-[14px] text-ink leading-relaxed">
                    {details.bio}
                  </p>
                ) : (
                  <p className="text-[14px] text-faint italic">
                    Додайте опис у налаштуваннях профілю.
                  </p>
                )}
              </div>
            )}

            {/* Анкета */}
            <div className="flex flex-col gap-4">
              <h3 className="ui-type-column-title text-muted uppercase tracking-wider">Контакти</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                {/* Telegram */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-canvas flex items-center justify-center shrink-0">
                    <Send size={14} className="text-ink" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-muted leading-none mb-1">Telegram</span>
                    {details.telegram ? (
                      <a href={`https://t.me/${details.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[13px] text-ink hover:underline font-medium truncate leading-none">
                        {details.telegram}
                      </a>
                    ) : (
                      <span className="text-[13px] text-faint leading-none">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-canvas flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-ink" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-muted leading-none mb-1">Телефон (Контактний номер)</span>
                    {details.phone ? (
                      <span className="text-[13px] text-ink font-medium leading-none truncate">{details.phone}</span>
                    ) : (
                      <span className="text-[13px] text-faint leading-none">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-canvas flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-ink" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-muted leading-none mb-1">Локація (Місто, країна)</span>
                    {details.location ? (
                      <span className="text-[13px] text-ink font-medium leading-none truncate">{details.location}</span>
                    ) : (
                      <span className="text-[13px] text-faint leading-none">Не вказано</span>
                    )}
                  </div>
                </div>
                
                {/* Email */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-canvas flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-ink" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-muted leading-none mb-1">Email</span>
                    {user.email ? (
                      <span className="text-[13px] text-ink font-medium leading-none truncate">{user.email}</span>
                    ) : (
                      <span className="text-[13px] text-faint leading-none">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Birthday */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-canvas flex items-center justify-center shrink-0">
                    <CakeSlice size={14} className="text-ink" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-muted leading-none mb-1">День народження</span>
                    <span className={`text-[13px] font-medium leading-none truncate ${details.birthday ? 'text-ink' : 'text-faint'}`}>
                      {details.birthday
                        ? new Date(`${details.birthday}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Не вказано'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rates section removed as user requested to only configure rates via settings positions */}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-2">
            {allActiveTasks.length === 0 ? (
              <div data-ui-surface="local" className="bg-canvas rounded-[16px] p-8 text-center border border-[#f0f0f0]">
                <p className="text-[14px] text-muted">Немає активних задач</p>
              </div>
            ) : (
              allActiveTasks.map(task => {
                const projectName = projects.find(p => p.id === task.projectId)?.name || 'Проєкт';
                return (
                  <TaskRow
                    key={task.id}
                    issue={task}
                    projectId={task.projectId}
                    projectName={projectName}
                    showProjectName
                    onClick={() => handleTaskClick(task)}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="ui-type-column-title uppercase tracking-wider text-muted">Порядок денний</h3>
              <p className="mt-1 text-[12px] text-muted">Найближчі події, мітинги, нотатки й важливі дати учасника.</p>
            </div>
            {calendarLoading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : agendaEvents.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="Найближчих подій немає"
                description="Нові події з календаря з’являться тут автоматично"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {agendaEvents.map(event => {
                  const start = new Date(event.startAt);
                  return (
                    // `Card` with an onClick renders a real button, so the row
                    // keeps its keyboard and screen-reader behaviour while the
                    // border, radius and hover come from the kit. The flex row
                    // moves inside: Card sets `block` on the button itself, and
                    // a `flex` from here would be the same property in the same
                    // layer, decided by emission order rather than intent.
                    <Card
                      key={event.id}
                      preset="bordered"
                      padding="sm"
                      interactive
                      onClick={() => {
                        if (onClose) onClose();
                        router.push(calendarEventHref(event));
                      }}
                    >
                      <span className="flex items-center gap-3">
                      <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-canvas">
                        <span className="text-[10px] font-bold uppercase text-muted">
                          {start.toLocaleDateString('uk-UA', { month: 'short' })}
                        </span>
                        <span className="text-[17px] font-black leading-none text-ink">{start.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-bold text-ink">{event.title}</span>
                          {event.visibility === 'private' && <LockKeyhole size={11} className="shrink-0 text-muted" />}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                          <Clock3 size={11} />
                          {event.allDay
                            ? 'Весь день'
                            : start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                          <span>·</span>
                          {EVENT_TYPE_LABELS[event.type] || 'Подія'}
                        </span>
                      </span>
                      </span>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
