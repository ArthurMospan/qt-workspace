'use client';
// src/components/WorkspaceHeader.jsx — Smart contextual header with 5 modes
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAppContext }    from '@/lib/context/AppContext';
import { requestNotifPermission } from '@/lib/hooks/useNotifications';
import { useDeadlineReminders } from '@/lib/hooks/useDeadlineReminders';
import { useSearch } from '@/lib/hooks/useSearch';
import useWorkspaceStore    from '@/store/useWorkspaceStore';
import UserAvatar           from '@/components/UserAvatar';
import UserStatusSetter     from '@/components/UserStatusSetter';
import SearchModal          from '@/components/SearchModal';
import TopHeader            from '@/components/ui/Layout/TopHeader';
import Segmented            from '@/components/ui/Segmented';
import {
  Bell, Search, Check, CheckCheck, MessageSquare, GitPullRequest,
  UserCheck, AlertCircle, AtSign, CalendarClock, Settings, Trash2, Mail,
  ChevronRight, X, Hash, ArrowLeft,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useRouter, usePathname } from 'next/navigation';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';

const TYPE_CFG = {
  assigned:       { icon: UserCheck,      color: '#6366f1', label: 'Призначено' },
  commented:      { icon: MessageSquare,  color: '#0891b2', label: 'Коментар' },
  status_changed: { icon: GitPullRequest, color: '#10b981', label: 'Статус змінено' },
  mentioned:      { icon: AtSign,         color: '#f97316', label: 'Згадано' },
  deadline:       { icon: CalendarClock,  color: '#d97706', label: 'Дедлайн' },
  alert:          { icon: AlertCircle,    color: '#dc2626', label: 'Тривога' },
  test:           { icon: Bell,           color: '#6366f1', label: 'Тест' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'Щойно';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// Day bucket for the notification list (Сьогодні / Вчора / Раніше)
function dayGroupLabel(ts) {
  if (!ts) return 'Раніше';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d >= today) return 'Сьогодні';
  if (d >= yesterday) return 'Вчора';
  return 'Раніше';
}

// Actor avatar with a small type badge, or a plain type icon when no actor
function NotifIcon({ n, size = 28 }) {
  const cfg  = TYPE_CFG[n.type] || TYPE_CFG.assigned;
  const Icon = cfg.icon;
  if (n.actorName || n.actorAvatar) {
    return (
      <div className="relative shrink-0 mt-[1px]">
        <UserAvatar user={{ name: n.actorName, avatar: n.actorAvatar }} size={size} />
        <span
          className="absolute -bottom-[3px] -right-[3px] w-[14px] h-[14px] rounded-full flex items-center justify-center border-2 border-white"
          style={{ background: cfg.color }}
        >
          <Icon size={7} className="text-white" />
        </span>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-[1px]"
      style={{ background: cfg.color + '15' }}>
      <Icon size={13} style={{ color: cfg.color }} />
    </div>
  );
}

// ── Detect header mode from pathname ────────────────────────────────
function useHeaderMode(pathname, projects, breadcrumbs = []) {
  const EXCLUDED = ['my', 'team', 'analytics', 'chat', 'settings', 'sprints'];

  if (!pathname) return { mode: 'default', project: null };

  // Explicitly check for breadcrumbs first to support any custom/nested page breadcrumbs
  if (breadcrumbs && breadcrumbs.length > 0) {
    const projectMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)(\/|$)/);
    let project = null;
    if (projectMatch && !EXCLUDED.includes(projectMatch[1])) {
      const projectId = projectMatch[1];
      project = projects?.find(p => p.id === projectId) || null;
    }
    return { mode: 'breadcrumbs', project };
  }

  if (pathname === '/') {
    return { mode: 'search', project: null, placeholder: 'Пошук...' };
  }
  if (pathname.startsWith('/my')) {
    return { mode: 'search', project: null, placeholder: 'Пошук по моїх завданнях...' };
  }
  if (pathname.startsWith('/team')) {
    return { mode: 'search', project: null, placeholder: 'Пошук по команді...' };
  }
  if (pathname.startsWith('/sprints')) {
    return { mode: 'search', project: null, placeholder: 'Пошук по спринтах і завданнях...' };
  }
  if (pathname.startsWith('/chat')) {
    return { mode: 'chat', project: null };
  }
  if (pathname.startsWith('/analytics')) {
    return { mode: 'search', project: null, placeholder: 'Пошук в аналітиці...' };
  }
  if (pathname.startsWith('/settings')) {
    return { mode: 'minimal', label: 'Налаштування' };
  }

  // Project pages
  const projectMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)(\/|$)/);
  if (projectMatch && !EXCLUDED.includes(projectMatch[1])) {
    const projectId = projectMatch[1];
    const isIssuePage = pathname.includes('/issue/');
    const project = projects?.find(p => p.id === projectId) || null;

    if (isIssuePage) {
      return { mode: 'breadcrumbs', project };
    }
    return { mode: 'project', project };
  }

  return { mode: 'search', project: null };
}

export function WorkspaceHeaderRight({ currentUser, signOut, mode }) {
  const router = useRouter();
  const { activeOrgId, allOrgs } = useAppContext();
  const liveNotif = useWorkspaceStore(s => s.liveNotif);
  const clearLiveNotif = useWorkspaceStore(s => s.clearLiveNotif);
  const notifications = useWorkspaceStore(s => s.notifications);
  const notificationActions = useWorkspaceStore(s => s.notificationActions);
  const showToast = useWorkspaceStore(s => s.showToast);
  const markAllRead = notificationActions?.markAllRead;
  const markRead = notificationActions?.markRead;
  const markUnread = notificationActions?.markUnread;
  const removeNotification = notificationActions?.removeNotification;
  const clearRead = notificationActions?.clearRead;

  const [bellOpen, setBellOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'
  const [userOpen, setUserOpen] = useState(false);
  const bellRef = useRef(null);
  const userRef = useRef(null);

  const scopedNotifications = notifications.filter(n => n.organizationId === activeOrgId);
  const unreadCount = scopedNotifications.filter(n => !n.read).length;
  const shownNotifications = notifFilter === 'unread'
    ? scopedNotifications.filter(n => !n.read)
    : scopedNotifications;
  const readCount = scopedNotifications.length - unreadCount;
  const orgName = organizationId => allOrgs.find(org => org.id === organizationId)?.name || 'Невідома організація';
  // Group by day, preserving the sorted order
  const notifGroups = [];
  shownNotifications.forEach(n => {
    const label = dayGroupLabel(n.createdAt);
    const last = notifGroups[notifGroups.length - 1];
    if (!last || last.label !== label) notifGroups.push({ label, items: [n] });
    else last.items.push(n);
  });

  useEffect(() => {
    const clickOut = e => {
      if (bellOpen && bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (userOpen && userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener('mousedown', clickOut);
    return () => document.removeEventListener('mousedown', clickOut);
  }, [bellOpen, userOpen]);

  const handleNotifClick = (n) => {
    if (n.organizationId && !allOrgs.some(org => org.id === n.organizationId)) {
      showToast('Ви більше не маєте доступу до організації цього сповіщення', 'error');
      return;
    }
    const link = withNotificationOrganization(n.link, n.organizationId);
    if (!link) {
      showToast('Посилання у сповіщенні недійсне', 'error');
      return;
    }
    setBellOpen(false);
    clearLiveNotif();
    router.push(link);
    if (!n.read) markRead?.(n.id).catch(() => showToast('Не вдалося позначити сповіщення прочитаним', 'error'));
  };

  const handleMarkAllRead = () => {
    markAllRead?.(activeOrgId)
      .catch(() => showToast('Не вдалося оновити сповіщення', 'error'));
  };

  const handleClearRead = () => {
    clearRead?.(activeOrgId)
      .catch(() => showToast('Не вдалося очистити сповіщення', 'error'));
  };

  return (
    <>
      <div className="flex items-center gap-[6px] shrink-0 ml-4 z-50">
        {/* ── Bell ──────────────────────── */}
        {mode !== 'chat' && (
          <div className="relative" ref={bellRef}>
            <button
              id="notif-bell"
            onClick={() => { setBellOpen(o => !o); setUserOpen(false); }}
            className={`relative w-[36px] h-[36px] flex items-center justify-center rounded-[10px] transition-all ${
              bellOpen ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas hover:text-ink'
            } ${unreadCount > 0 ? 'animate-[bellShake_0.4s_ease]' : ''}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-[6px] right-[6px] min-w-[12px] h-[12px] bg-ink text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[2px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="fixed md:absolute right-[8px] md:right-0 top-[56px] md:top-[calc(100%+8px)] w-[min(380px,calc(100vw-16px))] bg-white border border-[#f0f0f0] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.10)] overflow-hidden z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-canvas">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-ink">Сповіщення</h3>
                  {unreadCount > 0 && (
                    <span className="text-[9px] font-bold px-[6px] py-[2px] bg-ink/8 text-ink rounded-full">
                      {unreadCount} нових
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} title="Позначити всі прочитаними"
                      className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-muted hover:text-ink hover:bg-canvas transition-all">
                      <CheckCheck size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => { setBellOpen(false); router.push('/settings?section=notifications'); }}
                    title="Налаштування сповіщень"
                    className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-muted hover:text-ink hover:bg-canvas transition-all">
                    <Settings size={13} />
                  </button>
                </div>
              </div>

              {/* Filter */}
              <div className="px-4 pt-[10px] pb-2">
                <Segmented
                  className="bg-canvas w-max"
                  value={notifFilter}
                  onChange={setNotifFilter}
                  options={[
                    { value: 'all', label: 'Всі' },
                    { value: 'unread', label: unreadCount > 0 ? `Непрочитані · ${unreadCount}` : 'Непрочитані' },
                  ]}
                />
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto">
                {shownNotifications.length === 0 ? (
                  <div className="flex flex-col items-center py-12">
                    <Bell size={24} className="text-line mb-3" />
                    <p className="text-[12px] text-faint">
                      {notifFilter === 'unread' ? 'Все прочитано 👌' : 'Немає сповіщень'}
                    </p>
                  </div>
                ) : notifGroups.map(group => (
                  <div key={group.label}>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-faint uppercase tracking-wider">
                      {group.label}
                    </p>
                    {group.items.map(n => (
                      <div key={n.id} onClick={() => handleNotifClick(n)}
                        className={`group relative w-full flex items-start gap-3 px-4 py-[10px] text-left cursor-pointer hover:bg-canvas transition-colors ${!n.read ? 'bg-[#f5f7ff]' : ''}`}>
                        <NotifIcon n={n} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] leading-snug pr-4 ${!n.read ? 'font-semibold text-ink' : 'text-[#4a4a4a]'}`}>
                            {n.title}
                          </p>
                          {n.body && <p className="text-[11px] text-muted mt-[2px] line-clamp-2">{n.body}</p>}
                          <p className="text-[10px] text-faint mt-[3px] flex items-center gap-1">
                            <span>{timeAgo(n.createdAt)}</span>
                          </p>
                        </div>
                        {!n.read && (
                          <span className="w-[6px] h-[6px] bg-ink rounded-full shrink-0 mt-2 group-hover:opacity-0 transition-opacity" />
                        )}
                        {/* Hover actions */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title={n.read ? 'Позначити непрочитаним' : 'Позначити прочитаним'}
                            onClick={e => {
                              e.stopPropagation();
                              const action = n.read ? markUnread : markRead;
                              action?.(n.id).catch(() => showToast('Не вдалося оновити сповіщення', 'error'));
                            }}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[8px] bg-white border border-line text-muted hover:text-ink shadow-sm transition-colors">
                            {n.read ? <Mail size={12} /> : <Check size={12} />}
                          </button>
                          <button
                            title="Видалити"
                            onClick={e => {
                              e.stopPropagation();
                              removeNotification?.(n.id).catch(() => showToast('Не вдалося видалити сповіщення', 'error'));
                            }}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[8px] bg-white border border-line text-muted hover:text-red-500 shadow-sm transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Footer */}
              {scopedNotifications.length > 0 && (
                <div className="flex items-center justify-between px-4 py-[10px] border-t border-canvas bg-[#fafafa]">
                  <button
                    onClick={handleClearRead}
                    disabled={readCount === 0}
                    className="text-[11px] font-medium text-muted hover:text-red-500 disabled:opacity-40 disabled:hover:text-muted transition-colors">
                    Очистити прочитані{readCount > 0 ? ` (${readCount})` : ''}
                  </button>
                  <span className="text-[10px] text-faint">останні {scopedNotifications.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* ── Status dot (Chat mode only) ── */}
        {mode === 'chat' && (
          <UserStatusSetter />
        )}

        {/* ── User avatar ───────────────── */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserOpen(o => !o); setBellOpen(false); }}
            className="flex items-center justify-center w-[36px] h-[36px] rounded-[10px] hover:bg-canvas transition-all overflow-hidden"
          >
            <UserAvatar user={currentUser} size={28} />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[200px] bg-white border border-[#f0f0f0] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.10)] overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-canvas">
                <p className="text-[13px] font-bold text-ink truncate">{currentUser?.name}</p>
                <p className="text-[11px] text-muted truncate">{currentUser?.email}</p>
              </div>
              <button onClick={() => { router.push('/settings'); setUserOpen(false); }}
                className="flex w-full px-4 py-[10px] text-[13px] text-ink hover:bg-canvas transition-colors font-medium">
                Налаштування
              </button>
              <div className="border-t border-canvas">
                <button onClick={() => signOut()}
                  className="flex w-full px-4 py-[10px] text-[13px] text-red-500 hover:bg-red-50 transition-colors font-medium">
                  Вийти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Live notification popup ────────────────────────────────── */}
      {liveNotif && (() => {
        const cfg = TYPE_CFG[liveNotif.type] || TYPE_CFG.assigned;
        return (
          <div
            className="fixed bottom-[72px] md:bottom-5 right-[12px] md:right-[24px] z-[100] w-[min(320px,calc(100vw-24px))] bg-white border border-[#f0f0f0] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden"
            style={{ animation: 'slideUpIn 0.3s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className="flex items-start gap-3 px-4 py-4">
              <NotifIcon n={liveNotif} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-[3px]"
                  style={{ color: cfg.color }}>{cfg.label}</p>
                {liveNotif.organizationId && (
                  <p className="text-[10px] font-semibold text-ink mb-1 truncate">
                    {orgName(liveNotif.organizationId)}
                  </p>
                )}
                <p className="text-[13px] font-bold text-ink leading-snug">{liveNotif.title}</p>
                {liveNotif.body && (
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">{liveNotif.body}</p>
                )}
                {liveNotif.link && (
                  <button
                    onClick={() => handleNotifClick(liveNotif)}
                    className="mt-2 text-[11px] font-semibold text-ink hover:underline"
                  >
                    Перейти
                  </button>
                )}
              </div>
              <button onClick={clearLiveNotif} className="text-faint hover:text-ink transition-colors p-1">
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default function WorkspaceHeader() {
  const { currentUser, signOut, projects } = useAppContext();
  const uid  = currentUser?.id || currentUser?.uid;

  const breadcrumbs    = useWorkspaceStore(s => s.breadcrumbs);
  const chatSearch     = useWorkspaceStore(s => s.chatSearch);
  const setChatSearch  = useWorkspaceStore(s => s.setChatSearch);
  const teamSearch     = useWorkspaceStore(s => s.teamSearch);
  const setTeamSearch  = useWorkspaceStore(s => s.setTeamSearch);
  const workspaceSearch = useWorkspaceStore(s => s.workspaceSearch);
  const setWorkspaceSearch = useWorkspaceStore(s => s.setWorkspaceSearch);
  const myTaskSearch = useWorkspaceStore(s => s.myTaskSearch);
  const setMyTaskSearch = useWorkspaceStore(s => s.setMyTaskSearch);
  const projectSearchQuery = useWorkspaceStore(s => s.projectSearch);
  const setProjectSearchQuery = useWorkspaceStore(s => s.setProjectSearch);
  const sprintSearch = useWorkspaceStore(s => s.sprintSearch);
  const setSprintSearch = useWorkspaceStore(s => s.setSprintSearch);
  const analyticsSearch = useWorkspaceStore(s => s.analyticsSearch);
  const setAnalyticsSearch = useWorkspaceStore(s => s.setAnalyticsSearch);

  const router   = useRouter();
  const pathname = usePathname();
  const { mode, project, placeholder, label } = useHeaderMode(pathname, projects, breadcrumbs);

  const [projectSearch,   setProjectSearch]   = useState(false); // inline search toggle for project mode
  const [globalQuery,     setGlobalQuery]     = useState('');
  const [showSearch,      setShowSearch]      = useState(false);

  const { results: searchResults, loading: searchLoading, search } = useSearch();
  const { activeOrgId } = useAppContext();

  useEffect(() => { if (uid) requestNotifPermission(); }, [uid]);

  // Client-side deadline reminders (24h before due + daily for overdue)
  useDeadlineReminders(uid, activeOrgId);

  // Reset project search when leaving project page
  useEffect(() => {
    queueMicrotask(() => {
      setProjectSearch(false);
    });
  }, [pathname]);

  const contextualSearchValue = projectSearch
    ? projectSearchQuery
    : mode === 'chat'
      ? chatSearch
      : pathname.startsWith('/team')
        ? teamSearch
        : pathname.startsWith('/my')
          ? myTaskSearch
          : pathname.startsWith('/sprints')
            ? sprintSearch
            : pathname.startsWith('/analytics')
              ? analyticsSearch
              : pathname === '/'
                ? workspaceSearch
                : globalQuery;

  return (
    <>
      <TopHeader
        mode={mode}
        hideBorder={true}
        searchValue={contextualSearchValue}
        searchPlaceholder={placeholder}
        onSearchChange={async (q) => {
          if (projectSearch) {
            setProjectSearchQuery(q);
          } else if (mode === 'chat') {
            setChatSearch(q);
          } else if (pathname.startsWith('/team')) {
            setTeamSearch(q);
          } else if (pathname.startsWith('/my')) {
            setMyTaskSearch(q);
          } else if (pathname.startsWith('/sprints')) {
            setSprintSearch(q);
          } else if (pathname.startsWith('/analytics')) {
            setAnalyticsSearch(q);
          } else if (pathname === '/') {
            setWorkspaceSearch(q);
          } else {
            setGlobalQuery(q);
            if (q.trim() && activeOrgId) {
              setShowSearch(true);
              await search(q, activeOrgId);
            } else {
              setShowSearch(false);
            }
          }
        }}
        onSearchClear={() => {
          if (projectSearch) {
            setProjectSearchQuery('');
            setProjectSearch(false);
          } else if (mode === 'chat') {
            setChatSearch('');
          } else if (pathname.startsWith('/team')) {
            setTeamSearch('');
          } else if (pathname.startsWith('/my')) {
            setMyTaskSearch('');
          } else if (pathname.startsWith('/sprints')) {
            setSprintSearch('');
          } else if (pathname.startsWith('/analytics')) {
            setAnalyticsSearch('');
          } else if (pathname === '/') {
            setWorkspaceSearch('');
          } else {
            setGlobalQuery('');
            setShowSearch(false);
          }
        }}
        projectName={project?.name}
        projectSearchActive={projectSearch}
        onProjectSearchToggle={() => setProjectSearch(true)}
        breadcrumbs={breadcrumbs}
        onlineUsers={useWorkspaceStore.getState().chatOnlineUsers || []}
        rightContent={<WorkspaceHeaderRight currentUser={currentUser} signOut={signOut} mode={mode} />}
      />

      {/* ─── Search Modal ────────────────────────────────────────────── */}
      <SearchModal
        isOpen={showSearch}
        results={searchResults}
        loading={searchLoading}
        query={globalQuery}
        onClose={() => setShowSearch(false)}
        projects={projects}
      />
    </>
  );
}
