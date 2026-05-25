'use client';
// src/components/WorkspaceHeader.jsx
// Top bar: search + notification bell + user menu
import { useState, useRef, useEffect } from 'react';
import { useAppContext }    from '@/lib/context/AppContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { Bell, Search, Check, MessageSquare, GitPullRequest, UserCheck, AlertCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';

const TYPE_CFG = {
  assigned:       { icon: UserCheck,      color: '#6366f1' },
  commented:      { icon: MessageSquare,  color: '#0891b2' },
  status_changed: { icon: GitPullRequest, color: '#10b981' },
  mentioned:      { icon: AlertCircle,    color: '#f97316' },
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
  const uid = currentUser?.id || currentUser?.uid;
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(uid);
  const router = useRouter();

  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const bellRef = useRef(null);
  const userRef = useRef(null);

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
    <header className="h-[48px] shrink-0 bg-white border-b border-[#e9e9e9] flex items-center px-4 gap-3 z-30">
      {/* Search */}
      <div className="flex-1 max-w-[460px]">
        <div className="flex items-center gap-2 px-3 py-[6px] bg-[#f7f7f7] rounded-[8px] text-[12px] text-[#9a9a9a]">
          <Search size={13} />
          <span>Пошук задачі або проєкту...</span>
          <span className="ml-auto font-mono text-[10px] text-[#cfcfcf]">⌘K</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* ── Notifications bell ─────────────────── */}
        <div className="relative" ref={bellRef}>
          <button
            id="notif-bell"
            onClick={() => { setBellOpen(o => !o); setUserOpen(false); }}
            className={`relative w-9 h-9 flex items-center justify-center rounded-[8px] transition-all ${
              bellOpen ? 'bg-[#f0f0f0] text-[#1f1f1f]' : 'text-[#9a9a9a] hover:bg-[#f7f7f7] hover:text-[#1f1f1f]'
            }`}
            aria-label="Сповіщення"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-[5px] right-[5px] min-w-[14px] h-[14px] bg-[#6366f1] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[3px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-[360px] bg-white border border-[#e9e9e9] rounded-[16px] shadow-2xl overflow-hidden">
              {/* Header */}
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

              {/* List */}
              <div className="max-h-[420px] overflow-y-auto divide-y divide-[#f7f7f7]">
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
                      {!n.read && <span className="w-[6px] h-[6px] bg-[#6366f1] rounded-full shrink-0 mt-2 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── User avatar menu ───────────────────── */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => { setUserOpen(o => !o); setBellOpen(false); }}
            className="flex items-center justify-center w-9 h-9 rounded-[8px] hover:bg-[#f7f7f7] transition-all ml-1"
          >
            <UserAvatar user={currentUser} size={28} />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-[200px] bg-white border border-[#e9e9e9] rounded-[12px] shadow-xl overflow-hidden">
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
  );
}
