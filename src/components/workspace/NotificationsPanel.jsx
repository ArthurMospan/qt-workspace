'use client';
// src/components/workspace/NotificationsPanel.jsx
import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { Bell, Check, MessageSquare, GitPullRequest, UserCheck, AlertCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TYPE_CFG = {
  assigned:       { icon: UserCheck,       color: '#6366f1', label: 'Призначено' },
  commented:      { icon: MessageSquare,   color: '#0891b2', label: 'Коментар' },
  status_changed: { icon: GitPullRequest,  color: '#10b981', label: 'Статус' },
  mentioned:      { icon: AlertCircle,     color: '#f97316', label: 'Згадка' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'щойно';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} хв`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export default function NotificationsPanel({ collapsed }) {
  const { currentUser } = useAppContext();
  const uid = currentUser?.id || currentUser?.uid;
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(uid);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const router   = useRouter();

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (n) => {
    await markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Сповіщення"
        className={`relative flex items-center gap-[9px] w-full px-[9px] py-[7px] rounded-[8px] text-[12px] font-medium transition-all ${
          open ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
        }`}
      >
        <Bell size={14} className="shrink-0" />
        {!collapsed && <span>Сповіщення</span>}
        {unreadCount > 0 && (
          <span className={`${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} flex items-center justify-center min-w-[16px] h-[16px] bg-[#6366f1] text-white text-[9px] font-bold rounded-full px-[4px]`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute ${collapsed ? 'left-[52px] bottom-0' : 'left-full ml-2 bottom-0'} w-[340px] bg-white border border-[#e9e9e9] rounded-[16px] shadow-2xl z-50 overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-[#1f1f1f]">Сповіщення</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-[2px] bg-[#6366f1]/10 text-[#6366f1] rounded-full">
                  {unreadCount} нових
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-[#9a9a9a] hover:text-[#1f1f1f] px-2 py-1 rounded-[6px] hover:bg-[#f7f7f7] transition-all">
                  <Check size={11} /> Всі прочитані
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[#9a9a9a] hover:text-[#1f1f1f] p-1">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Bell size={28} className="text-[#e9e9e9] mb-3" />
                <p className="text-[12px] text-[#cfcfcf]">Немає сповіщень</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg  = TYPE_CFG[n.type] || TYPE_CFG.assigned;
                const Icon = cfg.icon;
                return (
                  <button key={n.id} onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#f7f7f7] transition-colors border-b border-[#f7f7f7] last:border-0 ${
                      !n.read ? 'bg-[#f5f7ff]' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-[1px]"
                      style={{ background: cfg.color + '18' }}>
                      <Icon size={13} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-snug ${!n.read ? 'font-semibold text-[#1f1f1f]' : 'text-[#1f1f1f]'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-[#9a9a9a] mt-[2px] line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[#cfcfcf] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span className="w-[6px] h-[6px] bg-[#6366f1] rounded-full shrink-0 mt-[7px]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
