'use client';
// src/components/WorkspaceHeader.jsx
// Context-aware: shows breadcrumbs when set, else search.
// Live notification popup in bottom-left corner.
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAppContext }    from '@/lib/context/AppContext';
import { useNotifications, requestNotifPermission } from '@/lib/hooks/useNotifications';
import useWorkspaceStore    from '@/store/useWorkspaceStore';
import UserAvatar           from '@/components/UserAvatar';
import {
  Bell, Search, Check, MessageSquare, GitPullRequest,
  UserCheck, AlertCircle, ChevronRight, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const TYPE_CFG = {
  assigned:       { icon: UserCheck,      color: '#6366f1', label: 'Призначено' },
  commented:      { icon: MessageSquare,  color: '#0891b2', label: 'Коментар' },
  status_changed: { icon: GitPullRequest, color: '#10b981', label: 'Статус змінено' },
  mentioned:      { icon: AlertCircle,    color: '#f97316', label: 'Згадано' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'щойно';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export default function WorkspaceHeader() {
  const { currentUser, signOut } = useAppContext();
  const uid  = currentUser?.id || currentUser?.uid;

  const breadcrumbs  = useWorkspaceStore(s => s.breadcrumbs);
  const liveNotif    = useWorkspaceStore(s => s.liveNotif);
  const showLiveNotif = useWorkspaceStore(s => s.showLiveNotif);
  const clearLiveNotif = useWorkspaceStore(s => s.clearLiveNotif);

  // Pass onNew callback into useNotifications
  const handleNewNotif = useCallback((n) => {
    showLiveNotif(n);
  }, [showLiveNotif]);

  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(uid, { onNew: handleNewNotif });
  const router = useRouter();

  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const bellRef = useRef(null);
  const userRef = useRef(null);

  // Request browser notification permission on first render
  useEffect(() => { if (uid) requestNotifPermission(); }, [uid]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!bellRef.current?.contains(e.target)) setBellOpen(false);
      if (!userRef.current?.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = async (n) => {
    await markRead(n.id);
    setBellOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <>
      {/* ─── Main header bar ─────────────────────────────────────────── */}
      <header className="h-[48px] shrink-0 bg-white border-b border-[#e9e9e9] flex items-center px-4 gap-3 z-30">

        {/* Left: breadcrumbs OR search */}
        <div className="flex-1 min-w-0">
          {breadcrumbs.length > 0 ? (
            // BREADCRUMBS mode (e.g. on issue page)
            <nav className="flex items-center gap-1 min-w-0">
              {breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight size={11} className="text-[#e9e9e9] shrink-0" />}
                  {crumb.href ? (
                    <Link href={crumb.href}
                      className="text-[12px] text-[#9a9a9a] hover:text-[#1f1f1f] font-medium truncate transition-colors max-w-[160px]">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[12px] font-bold text-[#1f1f1f] truncate max-w-[300px]">
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          ) : (
            // SEARCH mode (default)
            <div className="flex items-center gap-2 px-3 py-[6px] bg-[#f7f7f7] rounded-[8px] text-[12px] text-[#9a9a9a] max-w-[420px] cursor-pointer hover:bg-[#f0f0f0] transition-colors">
              <Search size={13} />
              <span>Пошук задачі або проєкту...</span>
              <span className="ml-auto font-mono text-[10px] text-[#e9e9e9]">⌘K</span>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {/* ── Bell ──────────────────────── */}
          <div className="relative" ref={bellRef}>
            <button
              id="notif-bell"
              onClick={() => { setBellOpen(o => !o); setUserOpen(false); }}
              className={`relative w-9 h-9 flex items-center justify-center rounded-[8px] transition-all ${
                bellOpen ? 'bg-[#f0f0f0] text-[#1f1f1f]' : 'text-[#9a9a9a] hover:bg-[#f7f7f7] hover:text-[#1f1f1f]'
              } ${unreadCount > 0 ? 'animate-[bellShake_0.4s_ease]' : ''}`}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-[5px] right-[5px] min-w-[14px] h-[14px] bg-[#6366f1] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[3px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[360px] bg-white border border-[#e9e9e9] rounded-[16px] shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold text-[#1f1f1f]">Сповіщення</h3>
                    {unreadCount > 0 && (
                      <span className="text-[9px] font-bold px-[6px] py-[2px] bg-[#6366f1]/10 text-[#6366f1] rounded-full">
                        {unreadCount} нових
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead}
                      className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#6366f1] px-2 py-1 rounded-[6px] hover:bg-[#f7f7f7] transition-all font-medium">
                      <Check size={10} /> Всі прочитані
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y divide-[#f7f7f7]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center py-10">
                      <Bell size={24} className="text-[#e9e9e9] mb-2" />
                      <p className="text-[12px] text-[#cfcfcf]">Немає сповіщень</p>
                    </div>
                  ) : notifications.map(n => {
                    const cfg  = TYPE_CFG[n.type] || TYPE_CFG.assigned;
                    const Icon = cfg.icon;
                    return (
                      <button key={n.id} onClick={() => handleNotifClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-[10px] text-left hover:bg-[#fafafa] transition-colors ${!n.read ? 'bg-[#f5f7ff]' : ''}`}>
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

          {/* ── User avatar ───────────────── */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => { setUserOpen(o => !o); setBellOpen(false); }}
              className="flex items-center justify-center w-9 h-9 rounded-[8px] hover:bg-[#f7f7f7] transition-all ml-1"
            >
              <UserAvatar user={currentUser} size={28} />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[200px] bg-white border border-[#e9e9e9] rounded-[12px] shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#f0f0f0]">
                  <p className="text-[12px] font-bold text-[#1f1f1f] truncate">{currentUser?.name}</p>
                  <p className="text-[10px] text-[#9a9a9a] truncate">{currentUser?.email}</p>
                </div>
                <button onClick={() => { router.push('/workspace/settings'); setUserOpen(false); }}
                  className="flex w-full px-4 py-[9px] text-[12px] text-[#1f1f1f] hover:bg-[#f7f7f7] transition-colors">
                  Налаштування
                </button>
                <div className="border-t border-[#f0f0f0]">
                  <button onClick={() => signOut()}
                    className="flex w-full px-4 py-[9px] text-[12px] text-red-500 hover:bg-red-50 transition-colors font-medium">
                    Вийти
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Live notification popup (bottom-left) ───────────────────── */}
      {liveNotif && (() => {
        const cfg  = TYPE_CFG[liveNotif.type] || TYPE_CFG.assigned;
        const Icon = cfg.icon;
        return (
          <div
            className="fixed bottom-5 left-[240px] z-[100] w-[320px] bg-white border border-[#e9e9e9] rounded-[16px] shadow-2xl overflow-hidden"
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
                    Перейти →
                  </button>
                )}
              </div>
              <button onClick={clearLiveNotif}
                className="text-[#cfcfcf] hover:text-[#1f1f1f] transition-colors shrink-0 mt-[1px]">
                <X size={14} />
              </button>
            </div>
            {/* Progress bar auto-dismiss */}
            <div className="h-[2px] bg-[#f0f0f0]">
              <div className="h-full rounded-full"
                style={{ background: cfg.color, animation: 'shrinkBar 6s linear forwards' }} />
            </div>
          </div>
        );
      })()}

      {/* ─── Keyframe styles ─────────────────────────────────────────── */}
      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shrinkBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes bellShake {
          0%,100% { transform: rotate(0deg); }
          20%      { transform: rotate(-15deg); }
          40%      { transform: rotate(15deg); }
          60%      { transform: rotate(-8deg); }
          80%      { transform: rotate(8deg); }
        }
      `}</style>
    </>
  );
}
