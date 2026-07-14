'use client';
// src/components/MobileNav.jsx — mobile bottom tab bar + «Ще» sheet
// Renders only below md (the wrapper in workspace/layout.js is md:hidden).
// Primary destinations live in the bar; everything else from the desktop
// sidebar (спринти, команда, налаштування, список проєктів, таймер) —
// у висувній шторці «Ще».
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useUnreadChatCount } from '@/lib/hooks/useUnreadChatCount';
import { Counter } from '@/components/ui';
import { can } from '@/lib/utils/can';
import {
  Folder, CheckCircle2, MessageSquare, PieChart, Menu, X,
  Zap, Users, Settings, Plus, Clock, Square as StopIcon, ChevronsUpDown,
} from 'lucide-react';
import OrgSwitcherScreen from '@/components/OrgSwitcherScreen';

const TABS = [
  { href: '/',           icon: Folder,        label: 'Проєкти', exact: true },
  { href: '/my',        icon: CheckCircle2,  label: 'Мої' },
  { href: '/chat',      icon: MessageSquare, label: 'Чат' },
  { href: '/analytics', icon: PieChart,      label: 'Аналітика' },
];

const MORE_NAV = [
  { href: '/sprints',  icon: Zap,      label: 'Спринти' },
  { href: '/team',     icon: Users,    label: 'Команда' },
  { href: '/settings', icon: Settings, label: 'Налаштування' },
];

// Separate component so the store's 1-second timerElapsed tick re-renders
// only this capsule (rendered only inside the open sheet), not the whole nav.
function SheetTimerCapsule({ onNavigate, onStop }) {
  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const timerElapsed = useWorkspaceStore(s => s.timerElapsed);
  const formatElapsed = useWorkspaceStore(s => s.formatElapsed);
  if (!activeTimer) return null;
  return (
    <div className="px-[16px] pb-[8px]">
      <div
        onClick={() => onNavigate(activeTimer)}
        className="bg-[#333333] rounded-[12px] flex items-center justify-between pl-[12px] pr-[6px] py-[6px] cursor-pointer">
        <div className="flex items-center gap-[8px]">
          <Clock size={14} className="text-[#3b82f6] animate-pulse" />
          <span className="text-white text-[13px] font-mono font-medium">{formatElapsed(timerElapsed)}</span>
        </div>
        <button onClick={onStop} title="Зупинити та зберегти"
          className="flex items-center justify-center w-[30px] h-[30px] rounded-[8px] bg-[#ef4444] text-white">
          <StopIcon size={12} className="fill-current" />
        </button>
      </div>
    </div>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeOrg, activeOrgId, orgRole } = useAppContext();
  const unreadChats = useUnreadChatCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);

  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const stopTimer = useWorkspaceStore(s => s.stopTimer);
  const notifications = useWorkspaceStore(s => s.notifications);
  const otherOrgUnreadCount = notifications.filter(item =>
    !item.read && item.organizationId && item.organizationId !== activeOrgId).length;

  // Close the sheet on navigation
  useEffect(() => { queueMicrotask(() => setMoreOpen(false)); }, [pathname]);

  // Lock body scroll while the sheet is open
  useEffect(() => {
    if (moreOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [moreOpen]);

  const isActive = (href, exact) => (exact ? pathname === href : pathname.startsWith(href));
  // «Ще» is highlighted when the current page lives in the sheet
  const moreActive = MORE_NAV.some(i => isActive(i.href));

  const handleStopTimer = e => {
    e.stopPropagation();
    const result = stopTimer();
    setMoreOpen(false);
    if (result?.projectId) {
      const suffix = result.minutes > 0 ? `?logTime=${result.minutes}` : '';
      router.push(`/${result.projectId}/issue/${result.issueId}${suffix}`);
    }
  };

  const handleTimerNavigate = (timer) => {
    setMoreOpen(false);
    if (timer.projectId) router.push(`/${timer.projectId}/issue/${timer.issueId}`);
  };

  return (
    <>
      {/* ── Bottom tab bar ─────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-ink flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] h-[56px] transition-colors ${
                active ? 'text-white' : 'text-[#8a8a8a]'
              }`}>
              <Icon size={20} />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
              {label === 'Чат' && unreadChats > 0 && (
                <span className="absolute top-[6px] left-[calc(50%+4px)]">
                  <Counter value={unreadChats} size="sm" status="info" dark />
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(o => !o)}
          className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] h-[56px] transition-colors ${
            moreOpen || moreActive ? 'text-white' : 'text-[#8a8a8a]'
          }`}>
          <Menu size={20} />
          <span className="text-[10px] font-semibold leading-none">Ще</span>
          {activeTimer && (
            <span className="absolute top-[7px] left-[calc(50%+6px)] w-[8px] h-[8px] bg-[#ef4444] rounded-full animate-pulse" />
          )}
          {otherOrgUnreadCount > 0 && !activeTimer && (
            <span className="absolute top-[5px] left-[calc(50%+4px)]">
              <Counter value={otherOrgUnreadCount} size="sm" status="info" dark />
            </span>
          )}
        </button>
      </nav>

      {/* ── «Ще» bottom sheet ──────────────────────────────────────── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-ink rounded-t-[24px] max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            {/* Handle + org row */}
            <div className="sticky top-0 bg-ink pt-[10px] pb-[4px]">
              <div className="w-[36px] h-[4px] bg-white/20 rounded-full mx-auto mb-[12px]" />
              <div className="flex items-center justify-between px-[20px] pb-[8px]">
                <button
                  onClick={() => setShowOrgSwitcher(true)}
                  className="flex items-center gap-[6px] text-white min-w-0">
                  <span className="text-[15px] font-bold truncate">{activeOrg?.name || 'QuickTeam'}</span>
                  {otherOrgUnreadCount > 0 && (
                    <Counter value={otherOrgUnreadCount} size="sm" status="info" dark />
                  )}
                  <ChevronsUpDown size={14} className="text-muted shrink-0" />
                </button>
                <button onClick={() => setMoreOpen(false)} className="text-muted p-[6px] -mr-[6px]">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Active timer capsule (subscribes to the 1s tick internally) */}
            <SheetTimerCapsule onNavigate={handleTimerNavigate} onStop={handleStopTimer} />

            {/* Secondary nav */}
            <div className="flex flex-col gap-[2px] px-[8px]">
              {MORE_NAV.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-[14px] h-[44px] px-[12px] rounded-[12px] transition-colors ${
                      active ? 'bg-[#333333] text-white' : 'text-[#c9c9c9]'
                    }`}>
                    <Icon size={19} />
                    <span className="text-[14px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mx-[16px] border-t border-white/[0.08] my-[10px]" />

            {/* Projects */}
            <div className="flex items-center justify-between px-[20px] pb-[8px]">
              <p className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">Проєкти</p>
              {can(orgRole, 'create:project') && (
                <button
                  onClick={() => { setMoreOpen(false); router.push('/?new=1'); }}
                  className="text-[#666666] p-[4px] -mr-[4px]" title="Новий проєкт">
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-[2px] px-[8px]">
              {(projects || [])
                .filter(p => p.status !== 'archived')
                .map(p => {
                  const active = pathname.startsWith(`/${p.id}`);
                  return (
                    <Link key={p.id} href={`/${p.id}`}
                      className={`flex items-center gap-[14px] h-[40px] px-[12px] rounded-[10px] transition-colors ${
                        active ? 'bg-[#333333] text-white' : 'text-muted'
                      }`}>
                      <Folder size={16} className="shrink-0" />
                      <span className="text-[13px] font-medium truncate">{p.name}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {showOrgSwitcher && <OrgSwitcherScreen onClose={() => setShowOrgSwitcher(false)} />}
    </>
  );
}
