'use client';
// src/components/WorkspaceSidebar.jsx
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import OrgSwitcherScreen from '@/components/OrgSwitcherScreen';
import { Counter } from '@/components/ui';
import {
  Folder, Users, MessageSquare, BarChart2,
  CheckSquare, Settings, LayoutGrid, ChevronsUpDown,
  Plus, ChevronLeft, ChevronRight, CheckCircle2, PieChart, PanelLeftClose, PanelLeftOpen,
  Zap, Clock, Square as StopIcon, Sparkles
} from 'lucide-react';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useUnreadChatCount } from '@/lib/hooks/useUnreadChatCount';
import { useProjectUnreadIndicators } from '@/lib/hooks/useProjectUnreadIndicators';
import Tooltip from '@/components/ui/Navigation/Tooltip';
import { computeSidebarTheme, SIDEBAR_PRESETS } from '@/lib/utils/sidebarTheme';
import { useCachedOrgBranding } from '@/lib/hooks/useCachedOrgBranding';

import { can } from '@/lib/utils/can';

export default function WorkspaceSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { projects, activeOrg, activeOrgId, orgRole, currentUser, orgLoading } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const unreadChats = useUnreadChatCount();
  const userId = currentUser?.id || currentUser?.uid;
  const { unreadProjectIds, markProjectRead } = useProjectUnreadIndicators(userId, activeOrgId);
  const notifications = useWorkspaceStore(s => s.notifications);
  const otherOrgUnreadCount = notifications.filter(item => !item.read && item.organizationId && item.organizationId !== activeOrgId).length;

  // ── Sidebar theme & Preview ──
  const sidebarPreview = useWorkspaceStore(s => s.sidebarPreview);

  // ── Custom branding ──
  // orgBrand віддає кешований брендинг, поки документ організації ще
  // завантажується — без мигання стандартної теми при перезавантаженні.
  const orgBrand = useCachedOrgBranding(activeOrgId, activeOrg);
  const isBranded = sidebarPreview
    ? Boolean(sidebarPreview.customBranding && sidebarPreview.logo)
    : Boolean(orgBrand?.customBranding && orgBrand?.logo);

  const orgLogoToUse = sidebarPreview?.logo || orgBrand?.logo;
  const [flipped, setFlipped] = useState(false);
  const flipTimeoutRef = useRef(null);

  const handleLogoFlip = useCallback((e) => {
    if (!isBranded || flipped) return;
    e.preventDefault();
    setFlipped(true);
    flipTimeoutRef.current = setTimeout(() => setFlipped(false), 1000);
  }, [isBranded, flipped]);

  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, []);


  const theme = useMemo(() => {
    // Priority: live preview from settings > org data (or its cache) > default dark
    const source = sidebarPreview || (isBranded ? {
      theme: orgBrand?.sidebarTheme || 'dark',
      color: orgBrand?.sidebarColor || SIDEBAR_PRESETS.dark,
    } : null);

    if (!source) return computeSidebarTheme(SIDEBAR_PRESETS.dark);

    const bgColor = source.theme === 'light' ? SIDEBAR_PRESETS.light
      : source.theme === 'custom' ? (source.color || SIDEBAR_PRESETS.dark)
      : SIDEBAR_PRESETS.dark;

    return computeSidebarTheme(bgColor);
  }, [isBranded, orgBrand?.sidebarTheme, orgBrand?.sidebarColor, sidebarPreview]);

  useEffect(() => {
    const match = pathname.match(/^\/([^/]+)/);
    const projectId = match?.[1];
    if (projectId && projects?.some(project => project.id === projectId)) {
      markProjectRead(projectId).catch(error => console.error('[WorkspaceSidebar] mark project read', error));
    }
  }, [pathname, projects, markProjectRead]);

  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const timerElapsed = useWorkspaceStore(s => s.timerElapsed);
  const formatElapsed = useWorkspaceStore(s => s.formatElapsed);
  const stopTimer = useWorkspaceStore(s => s.stopTimer);

  const handleStopGlobalTimer = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = stopTimer();
    if (result && result.minutes > 0 && result.projectId) {
      router.push(`/${result.projectId}/issue/${result.issueId}?logTime=${result.minutes}`);
    } else if (result && result.projectId) {
      router.push(`/${result.projectId}/issue/${result.issueId}`);
    }
  };

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href);

  const topNav = [
    { href: '/',            icon: Folder,        label: 'Проєкти',     exact: true },
    { href: '/my',         icon: CheckCircle2,  label: 'Мої завдання' },
    { href: '/sprints',    icon: Zap,           label: 'Спринти' },
    { href: '/chat',       icon: MessageSquare, label: 'Чат' },
    { href: '/team',       icon: Users,         label: 'Команда' },
    { href: '/analytics',  icon: PieChart,      label: 'Аналітика',   exact: false },
    // «Дзвінок → задачі» (/ai-call) свідомо НЕ в сайдбарі: це допоміжна
    // функція створення задач, вхід — кнопка в CreateTaskModal.
    { href: '/settings',   icon: Settings,      label: 'Налаштування' },
  ];

  return (
    <aside
      style={{
        width: collapsed ? 68 : 260,
        backgroundColor: theme.bg,
        '--sb-text': theme.text,
        '--sb-muted': theme.muted,
        '--sb-hover': theme.hover,
        '--sb-active': theme.active,
        '--sb-border': theme.border,
        '--sb-muted-project': theme.mutedProject || theme.muted,
        '--sb-muted-header': theme.mutedHeader || theme.muted,
      }}
      className="h-full flex flex-col transition-[width] duration-200 shrink-0 overflow-hidden hide-scrollbar relative group"
    >
      {/* Top Logo & Org Switcher */}
      <div className={`flex flex-col pt-[24px] pb-[16px] shrink-0 ${collapsed ? 'px-0 items-center' : 'px-[20px]'}`}>
        <div className={`flex items-start ${collapsed ? 'justify-center w-full' : 'justify-between w-full'}`}>
          {!collapsed ? (
            <>
              <div className="flex items-start min-w-0 flex-1">
                {isBranded ? (
                  /* ── Branded logo with coin-flip ── */
                  <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
                    <div
                      className="logo-flip-container cursor-pointer"
                      onClick={handleLogoFlip}
                      title="Натисни, щоб побачити QuickTeam"
                    >
                      <div className={`logo-flip-inner ${flipped ? 'flipped' : ''}`}>
                        {/* Front: org logo */}
                        <div className="logo-flip-front">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={orgLogoToUse}
                            alt={activeOrg?.name || 'Logo'}
                            className="w-[32px] h-[32px] rounded-[8px] object-cover"
                          />
                        </div>
                        {/* Back: original QT logo */}
                        <div className="logo-flip-back">
                          <Image src="/logo-min.svg" alt="QT" width={32} height={32} loading="eager" className="object-contain" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link href="/" className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                    <Image src="/logo-min.svg" alt="QT" width={32} height={32} loading="eager" className="object-contain" />
                  </Link>
                )}
                <div className="flex flex-col mt-[-2px] min-w-0 ml-[12px]">
                  <Link href="/" className="hover:opacity-80 transition-opacity">
                     <h1
                       className="tracking-tight leading-tight truncate transition-all"
                       style={{ color: isBranded ? (theme.mutedHeader || theme.muted) : theme.text, fontSize: isBranded ? 12 : 16, fontWeight: isBranded ? 500 : 700 }}
                     >QuickTeam</h1>
                  </Link>
                  <div 
                    onClick={() => setShowOrgSwitcher(true)}
                    className="flex items-center gap-[4px] cursor-pointer transition-colors w-fit"
                    style={{ color: isBranded ? theme.text : theme.muted }}
                  >
                    <span
                      className="truncate max-w-[120px] transition-all"
                      style={{ fontSize: isBranded ? 16 : 12, fontWeight: isBranded ? 700 : 500 }}
                    >{activeOrg?.name || 'Company name'}</span>
                    {otherOrgUnreadCount > 0 && (
                      <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[#6366f1] text-white text-[9px] font-bold flex items-center justify-center">
                        {otherOrgUnreadCount > 99 ? '99+' : otherOrgUnreadCount}
                      </span>
                    )}
                    <ChevronsUpDown size={12} className="shrink-0" style={{ color: theme.muted }} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="mt-1 transition-colors shrink-0 ml-[8px]"
                style={{ color: theme.muted }}
                title="Сховати панель"
              >
                <PanelLeftClose size={20} />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center w-full h-[36px]">
              <Tooltip content="Розгорнути панель" position="right" className="flex items-center justify-center w-full h-full">
                <button
                  onClick={() => setCollapsed(false)}
                  className="transition-colors"
                  style={{ color: theme.muted }}
                >
                  <PanelLeftOpen size={20} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation (y=88 in Figma) */}
      <nav className="pt-[8px] flex flex-col gap-[4px] shrink-0">
        {topNav.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} title={collapsed ? undefined : label}
              className="flex items-center mx-[8px] h-[40px] rounded-[12px] transition-all"
              style={{
                backgroundColor: active ? theme.active : 'transparent',
                color: active ? theme.text : theme.muted,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = theme.hover; e.currentTarget.style.color = theme.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = theme.muted; } }}
            >
              <Tooltip content={collapsed ? label : null} position="right" className="w-full h-full flex items-center">
                <div className={`flex items-center w-full h-full ${collapsed ? 'justify-center' : 'pl-[12px] gap-[16px] pr-[12px]'}`}>
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="text-[13px] font-medium">{label}</span>}
                  {!collapsed && label === 'Чат' && unreadChats > 0 && (
                    <Counter value={unreadChats} size="sm" status="info" className="ml-auto" dark={theme.isDark} />
                  )}
                </div>
              </Tooltip>
            </Link>
          );
        })}
      </nav>

      <div className="mx-[12px] mt-[16px] mb-[16px]" style={{ borderTop: `1px solid ${theme.border}` }} />

      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!collapsed && (
          <div className="flex items-center justify-between px-[16px] mb-[16px]">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.mutedHeader || theme.muted }}>ПРОЄКТИ</p>
            {can(orgRole, 'create:project') && (
              <button
                onClick={() => router.push('/?new=1')}
                className="transition-colors" title="Новий проєкт"
                style={{ color: theme.mutedHeader || theme.muted }}
                onMouseEnter={e => { e.currentTarget.style.color = theme.text; }}
                onMouseLeave={e => { e.currentTarget.style.color = theme.mutedHeader || theme.muted; }}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-[4px]">
          {(projects || [])
            .filter(p => p.status !== 'archived')
            .map(p => {
              const active = pathname.startsWith(`/${p.id}`);
              return (
                <Link key={p.id} href={`/${p.id}`} title={collapsed ? undefined : p.name}
                  className="flex items-center mx-[8px] h-[32px] rounded-[8px] transition-all"
                  style={{
                    backgroundColor: active ? theme.active : 'transparent',
                    color: active ? theme.text : (theme.mutedProject || theme.muted),
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = theme.hover; e.currentTarget.style.color = theme.text; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = (theme.mutedProject || theme.muted); } }}
                >
                  <Tooltip content={collapsed ? p.name : null} position="right" className="w-full h-full flex items-center">
                    <div className={`flex items-center w-full h-full ${collapsed ? 'justify-center' : 'pl-[12px] gap-[16px] pr-[12px]'}`}>
                      <Folder size={15} className="shrink-0" />
                      {!collapsed && <span className="text-[12px] font-medium truncate">{p.name}</span>}
                      {!collapsed && !active && unreadProjectIds.has(p.id) && (
                        <Counter variant="dot" size="sm" status="info" className="ml-auto" dark={theme.isDark} />
                      )}
                    </div>
                  </Tooltip>
                </Link>
              );
            })}
        </div>
      </div>

      {/* Global Timer Capsule */}
      {activeTimer && (
        <div className={`shrink-0 ${collapsed ? 'p-[12px]' : 'p-[16px]'}`} style={{ borderTop: `1px solid ${theme.border}`, backgroundColor: theme.bg }}>
          <div 
            onClick={() => {
              if (activeTimer.projectId) {
                router.push(`/${activeTimer.projectId}/issue/${activeTimer.issueId}`);
              }
            }}
            className={`transition-colors rounded-[12px] flex items-center cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)] ${collapsed ? 'justify-center flex-col gap-1 py-2' : 'justify-between pl-[12px] pr-[4px] py-[4px]'}`}
            style={{ backgroundColor: theme.active }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.hover; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = theme.active; }}
          >
            {!collapsed && (
              <div className="flex items-center gap-[8px]">
                <Clock size={14} className="text-[#3b82f6] animate-pulse" />
                <span className="text-[13px] font-mono font-medium" style={{ color: theme.text }}>{formatElapsed(timerElapsed)}</span>
              </div>
            )}
            {collapsed && (
              <span className="text-[10px] font-mono font-medium" style={{ color: theme.text }}>{formatElapsed(timerElapsed)}</span>
            )}
            <button
              onClick={handleStopGlobalTimer}
              title="Зупинити та зберегти"
              className={`flex items-center justify-center rounded-[8px] bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors shrink-0 ${collapsed ? 'w-[24px] h-[24px] mt-1' : 'w-[28px] h-[28px]'}`}
            >
              <StopIcon size={12} className="fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* Org switcher modal */}
      {showOrgSwitcher && (
        <OrgSwitcherScreen onClose={() => setShowOrgSwitcher(false)} />
      )}
    </aside>
  );
}
