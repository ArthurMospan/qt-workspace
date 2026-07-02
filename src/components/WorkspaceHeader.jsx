'use client';
// src/components/WorkspaceHeader.jsx — Smart contextual header with 5 modes
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAppContext }    from '@/lib/context/AppContext';
import { useNotifications, requestNotifPermission } from '@/lib/hooks/useNotifications';
import { useSearch } from '@/lib/hooks/useSearch';
import useWorkspaceStore    from '@/store/useWorkspaceStore';
import UserAvatar           from '@/components/UserAvatar';
import UserStatusSetter     from '@/components/UserStatusSetter';
import SearchModal          from '@/components/SearchModal';
import TopHeader            from '@/components/ui/Layout/TopHeader';
import {
  Bell, Search, Check, MessageSquare, GitPullRequest,
  UserCheck, AlertCircle, ChevronRight, X, Hash, ArrowLeft,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useRouter, usePathname } from 'next/navigation';

const TYPE_CFG = {
  assigned:       { icon: UserCheck,      color: '#6366f1', label: 'Призначено' },
  commented:      { icon: MessageSquare,  color: '#0891b2', label: 'Коментар' },
  status_changed: { icon: GitPullRequest, color: '#10b981', label: 'Статус змінено' },
  mentioned:      { icon: AlertCircle,    color: '#f97316', label: 'Згадано' },
  alert:          { icon: AlertCircle,    color: '#dc2626', label: 'Тривога' },
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

// ── Detect header mode from pathname ────────────────────────────────
function useHeaderMode(pathname, projects, breadcrumbs = []) {
  const EXCLUDED = ['my', 'team', 'analytics', 'chat', 'settings', 'sprints'];

  if (!pathname) return { mode: 'default', project: null };

  // Explicitly check for breadcrumbs first to support any custom/nested page breadcrumbs
  if (breadcrumbs && breadcrumbs.length > 0) {
    const projectMatch = pathname.match(/^\/workspace\/([a-zA-Z0-9_-]+)(\/|$)/);
    let project = null;
    if (projectMatch && !EXCLUDED.includes(projectMatch[1])) {
      const projectId = projectMatch[1];
      project = projects?.find(p => p.id === projectId) || null;
    }
    return { mode: 'breadcrumbs', project };
  }

  if (pathname === '/workspace' || pathname === '/workspace/') {
    return { mode: 'search', project: null, placeholder: 'Пошук...' };
  }
  if (pathname.startsWith('/workspace/my')) {
    return { mode: 'search', project: null, placeholder: 'Пошук по моїх завданнях...' };
  }
  if (pathname.startsWith('/workspace/team')) {
    return { mode: 'search', project: null, placeholder: 'Пошук по команді...' };
  }
  if (pathname.startsWith('/workspace/chat')) {
    return { mode: 'chat', project: null };
  }
  if (pathname.startsWith('/workspace/analytics')) {
    return { mode: 'minimal', label: 'Аналітика' };
  }
  if (pathname.startsWith('/workspace/settings')) {
    return { mode: 'minimal', label: 'Налаштування' };
  }

  // Project pages
  const projectMatch = pathname.match(/^\/workspace\/([a-zA-Z0-9_-]+)(\/|$)/);
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
  const uid = currentUser?.id || currentUser?.uid;
  const router = useRouter();
  
  const liveNotif = useWorkspaceStore(s => s.liveNotif);
  const showLiveNotif = useWorkspaceStore(s => s.showLiveNotif);
  const clearLiveNotif = useWorkspaceStore(s => s.clearLiveNotif);

  const handleNewNotif = useCallback((n) => { showLiveNotif(n); }, [showLiveNotif]);
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(uid, { onNew: handleNewNotif });

  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const bellRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const clickOut = e => {
      if (bellOpen && bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (userOpen && userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener('mousedown', clickOut);
    return () => document.removeEventListener('mousedown', clickOut);
  }, [bellOpen, userOpen]);

  const handleNotifClick = async (n) => {
    if (!n.read) await markRead(n.id);
    setBellOpen(false);
    if (n.link) router.push(n.link);
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
              bellOpen ? 'bg-[#f4f4f5] text-[#1f1f1f]' : 'text-[#9a9a9a] hover:bg-[#f4f4f5] hover:text-[#1f1f1f]'
            } ${unreadCount > 0 ? 'animate-[bellShake_0.4s_ease]' : ''}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-[6px] right-[6px] min-w-[12px] h-[12px] bg-[#6366f1] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[2px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] bg-white border border-[#f0f0f0] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.10)] overflow-hidden z-50">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f4f4f5]">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-[#1f1f1f]">Сповіщення</h3>
                  {unreadCount > 0 && (
                    <span className="text-[9px] font-bold px-[6px] py-[2px] bg-[#6366f1]/10 text-[#6366f1] rounded-full">
                      {unreadCount} нових
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-[#9a9a9a] hover:text-[#6366f1] px-2 py-1 rounded-[6px] hover:bg-[#f4f4f5] transition-all font-medium">
                    <Check size={10} /> Всі прочитані
                  </button>
                )}
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-12">
                    <Bell size={24} className="text-[#e9e9e9] mb-3" />
                    <p className="text-[12px] text-[#cfcfcf]">Немає сповіщень</p>
                  </div>
                ) : notifications.map(n => {
                  const cfg  = TYPE_CFG[n.type] || TYPE_CFG.assigned;
                  const Icon = cfg.icon;
                  return (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      className={`w-full flex items-start gap-3 px-5 py-[12px] text-left hover:bg-[#f4f4f5] transition-colors border-b border-[#f4f4f5] last:border-0 ${!n.read ? 'bg-[#f5f7ff]' : ''}`}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-[1px]"
                        style={{ background: cfg.color + '15' }}>
                        <Icon size={13} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] leading-snug ${!n.read ? 'font-semibold text-[#1f1f1f]' : 'text-[#4a4a4a]'}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-[11px] text-[#9a9a9a] mt-[2px] line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-[#cfcfcf] mt-[3px]">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-[6px] h-[6px] bg-[#6366f1] rounded-full shrink-0 mt-2" />}
                    </button>
                  );
                })}
              </div>
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
            className="flex items-center justify-center w-[36px] h-[36px] rounded-[10px] hover:bg-[#f4f4f5] transition-all overflow-hidden"
          >
            <UserAvatar user={currentUser} size={28} />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[200px] bg-white border border-[#f0f0f0] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.10)] overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-[#f4f4f5]">
                <p className="text-[13px] font-bold text-[#1f1f1f] truncate">{currentUser?.name}</p>
                <p className="text-[11px] text-[#9a9a9a] truncate">{currentUser?.email}</p>
              </div>
              <button onClick={() => { router.push('/workspace/settings'); setUserOpen(false); }}
                className="flex w-full px-4 py-[10px] text-[13px] text-[#1f1f1f] hover:bg-[#f4f4f5] transition-colors font-medium">
                Налаштування
              </button>
              <div className="border-t border-[#f4f4f5]">
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
        const cfg  = TYPE_CFG[liveNotif.type] || TYPE_CFG.assigned;
        const Icon = cfg.icon;
        return (
          <div
            className="fixed bottom-5 right-[24px] z-[100] w-[320px] bg-white border border-[#f0f0f0] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden"
            style={{ animation: 'slideUpIn 0.3s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: cfg.color + '18' }}>
                <Icon size={15} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-[3px]"
                  style={{ color: cfg.color }}>{cfg.label}</p>
                <p className="text-[13px] font-bold text-[#1f1f1f] leading-snug">{liveNotif.title}</p>
                {liveNotif.body && (
                  <p className="text-[11px] text-[#9a9a9a] mt-1 line-clamp-2">{liveNotif.body}</p>
                )}
                {liveNotif.link && (
                  <button
                    onClick={() => { router.push(liveNotif.link); clearLiveNotif(); }}
                    className="mt-2 text-[11px] font-semibold text-[#6366f1] hover:underline"
                  >
                    Перейти
                  </button>
                )}
              </div>
              <button onClick={clearLiveNotif} className="text-[#cfcfcf] hover:text-[#1f1f1f] transition-colors p-1">
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

  const router   = useRouter();
  const pathname = usePathname();
  const { mode, project, placeholder, label } = useHeaderMode(pathname, projects, breadcrumbs);

  const [projectSearch,   setProjectSearch]   = useState(false); // inline search toggle for project mode
  const [projectQuery,    setProjectQuery]    = useState('');
  const [globalQuery,     setGlobalQuery]     = useState('');
  const [showSearch,      setShowSearch]      = useState(false);

  const projSearchRef  = useRef(null);

  const { results: searchResults, loading: searchLoading, search } = useSearch();
  const { activeOrgId } = useAppContext();

  useEffect(() => { if (uid) requestNotifPermission(); }, [uid]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (projectSearch && !projSearchRef.current?.contains(e.target)) {
        setProjectSearch(false);
        setProjectQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectSearch]);

  // Reset project search when leaving project page
  useEffect(() => {
    setProjectSearch(false);
    setProjectQuery('');
  }, [pathname]);

  return (
    <>
      <TopHeader
        mode={mode}
        hideBorder={true}
        searchValue={projectSearch ? projectQuery : (mode === 'chat' ? chatSearch : (pathname.startsWith('/workspace/team') ? teamSearch : globalQuery))}
        searchPlaceholder={placeholder}
        onSearchChange={async (q) => {
          if (projectSearch) {
            setProjectQuery(q);
          } else if (mode === 'chat') {
            setChatSearch(q);
          } else if (pathname.startsWith('/workspace/team')) {
            setTeamSearch(q);
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
            setProjectQuery('');
            setProjectSearch(false);
          } else if (mode === 'chat') {
            setChatSearch('');
          } else if (pathname.startsWith('/workspace/team')) {
            setTeamSearch('');
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
