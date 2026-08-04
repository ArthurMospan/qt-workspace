'use client';
// src/components/WorkspaceSidebar.jsx
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import OrgSwitcherScreen from '@/components/OrgSwitcherScreen';
import { Counter, Skeleton } from '@/components/ui';
import {
  Folder, Users, BarChart2,
  CheckSquare, Settings, LayoutGrid, ChevronsUpDown,
  Plus, ChevronLeft, ChevronRight, PieChart, PanelLeftClose, PanelLeftOpen,
  Zap, Clock, Square as StopIcon, Sparkles,
} from 'lucide-react';
import { CalendarIcon, ChatIcon, TaskIcon } from '@/lib/design/icons';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useUnreadChatCount } from '@/lib/hooks/useUnreadChatCount';
import { useProjectUnreadIndicators } from '@/lib/hooks/useProjectUnreadIndicators';
import Tooltip from '@/components/ui/Navigation/Tooltip';
import { computeSidebarTheme, SIDEBAR_PRESETS } from '@/lib/utils/sidebarTheme';
import { useCachedOrgBranding, useSidebarThemeBoot } from '@/lib/hooks/useCachedOrgBranding';
import { timerTargetHref } from '@/lib/utils/timerNavigation.mjs';

import { can } from '@/lib/utils/can';

export default function WorkspaceSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { projects, activeOrg, activeOrgId, orgRole, currentUser, orgLoading } = useAppContext();
  // Особиста преференція цього браузера/пристрою — НЕ дані організації, тому
  // ніяк не синхронізується і не видно іншим учасникам команди.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('qt_sidebar_collapsed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('qt_sidebar_collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const unreadChats = useUnreadChatCount();
  const userId = currentUser?.id || currentUser?.uid;
  const { unreadProjectIds, markProjectRead } = useProjectUnreadIndicators(userId, activeOrgId);
  const notifications = useWorkspaceStore(s => s.notifications);
  const unreadChatNotifications = notifications.filter(item =>
    !item.read && item.type === 'chat_message' && item.organizationId === activeOrgId).length;
  const displayedUnreadChats = unreadChatNotifications || unreadChats;
  const showUnreadChatBadge = !pathname.startsWith('/chat') && displayedUnreadChats > 0;
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

  // Кеш теми + зняття boot-стилю з layout.js, щойно тема справжня.
  useSidebarThemeBoot(theme, Boolean(activeOrg));

  // Поки не приїхали живі дані (чи live-preview з налаштувань) — лого й назва
  // організації невідомі. Замість того щоб на мить показати "Company name" /
  // биту картинку, показуємо скелетон; логотип рендериться лише коли готово.
  const brandingReady = Boolean(sidebarPreview) || Boolean(activeOrg);

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
    const targetHref = timerTargetHref(result, { minutes: result?.minutes });
    if (targetHref) router.push(targetHref);
  };

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href);

  const topNav = [
    { href: '/',            icon: Folder,        label: 'Проєкти',     exact: true },
    { href: '/my',         icon: TaskIcon,      label: 'Мої завдання' },
    { href: '/sprints',    icon: Zap,           label: 'Спринти' },
    { href: '/calendar',   icon: CalendarIcon,  label: 'Календар' },
    { href: '/chat',       icon: ChatIcon,      label: 'Чат' },
    { href: '/team',       icon: Users,         label: 'Команда' },
    { href: '/analytics',  icon: PieChart,      label: 'Аналітика',   exact: false },
    // «Дзвінок → задачі» свідомо НЕ в сайдбарі: це не окремий екран, а вкладка
    // всередині створення задачі (CreateTaskModal → AudioTaskPanel).
    { href: '/settings',   icon: Settings,      label: 'Налаштування' },
  ];

  return (
    <aside
      data-app-sb
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
                {!brandingReady ? (
                  /* ── Skeleton: доки не приїхали дані організації, краще
                     нічого не показувати, ніж "Company name" / бите лого ── */
                  <>
                    {/* `--sb-hover` is rgba(255,255,255,0.04) on a dark sidebar
                        — four percent of white, which is a hover tint and not
                        a shape. Drawn with it, the skeleton was invisible often
                        enough that the corner just looked empty. The kit's
                        `sidebar` tone mixes from the sidebar's own text colour,
                        so it stays legible on the dark, light and custom
                        themes alike. */}
                    <Skeleton preset="logo" tone="sidebar" className="shrink-0" />
                    {/* Той самий розклад висот (16px + 20px), що й у реального
                        контенту нижче — щоб перехід скелетон → справжні дані
                        не смикав layout ні на піксель. */}
                    <div className="flex flex-1 flex-col mt-[-2px] min-w-0 ml-[12px]">
                      <div className="h-[16px] flex items-center">
                        <Skeleton preset="caption" width="wide" tone="sidebar" />
                      </div>
                      <div className="h-[20px] flex items-center">
                        <Skeleton preset="caption" width="half" tone="sidebar" style={{ animationDelay: '120ms' }} />
                      </div>
                    </div>
                  </>
                ) : isBranded ? (
                  /* ── Branded logo: hover flips to reveal QuickTeam (CSS),
                       click goes home ── */
                  <Link
                    href="/"
                    className="group/logo relative block w-[32px] h-[32px] shrink-0 [perspective:1000px]"
                    title="На головну — наведіть, щоб побачити QuickTeam"
                    aria-label="На головну"
                  >
                    <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover/logo:[transform:rotateY(180deg)]">
                      {/* Front: org logo */}
                      <span className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={orgLogoToUse}
                          alt={activeOrg?.name || 'Logo'}
                          className="w-[32px] h-[32px] rounded-[8px] object-cover"
                        />
                      </span>
                      {/* Back: QuickTeam mark */}
                      <span className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <Image src={theme.isDark ? '/logo-min.svg' : '/logo-min-dark.svg'} alt="QT" width={32} height={32} loading="eager" className="object-contain" />
                      </span>
                    </div>
                  </Link>
                ) : (
                  <Link href="/" className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                    <Image src={theme.isDark ? '/logo-min.svg' : '/logo-min-dark.svg'} alt="QT" width={32} height={32} loading="eager" className="object-contain" />
                  </Link>
                )}
                {brandingReady && (
                  <div className="flex flex-col mt-[-2px] min-w-0 ml-[12px]">
                    {/* line-height фіксований (16px / 20px) незалежно від
                        isBranded — інакше рядки міняються розміром шрифту
                        місцями, а висота блоку "стрибає" на 1-2px. */}
                    <Link href="/" className="hover:opacity-80 transition-opacity">
                       <h1
                         data-ui-type="branding-title"
                         className="tracking-tight truncate transition-all h-[16px]"
                         style={{ color: isBranded ? (theme.mutedHeader || theme.muted) : theme.text, fontSize: isBranded ? 12 : 16, lineHeight: '16px', fontWeight: isBranded ? 500 : 700 }}
                       >QuickTeam</h1>
                    </Link>
                    <div
                      onClick={() => setShowOrgSwitcher(true)}
                      role="button"
                      tabIndex={0}
                      aria-label="Змінити організацію"
                      onKeyDown={event => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        setShowOrgSwitcher(true);
                      }}
                      className="flex items-center gap-[4px] cursor-pointer transition-colors w-fit h-[20px]"
                      style={{ color: isBranded ? theme.text : theme.muted }}
                    >
                      <span
                        className="truncate max-w-[120px] transition-all"
                        style={{ fontSize: isBranded ? 16 : 12, lineHeight: '20px', fontWeight: isBranded ? 700 : 500 }}
                      >{activeOrg?.name || 'Company name'}</span>
                      {otherOrgUnreadCount > 0 && (
                        <span data-ui-pill="branding-counter" className="min-w-[16px] h-[16px] px-1 rounded-full bg-ink text-white text-[9px] font-bold flex items-center justify-center">
                          {otherOrgUnreadCount > 99 ? '99+' : otherOrgUnreadCount}
                        </span>
                      )}
                      <ChevronsUpDown size={12} className="shrink-0" style={{ color: theme.muted }} />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setCollapsed(true)}
                data-ui-control="branding-action"
                className="mt-1 transition-colors shrink-0 ml-[8px]"
                style={{ color: 'var(--sb-muted)' }}
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
                  aria-label="Розгорнути бічну панель"
                  data-ui-control="branding-action"
                  className="transition-colors"
                  style={{ color: 'var(--sb-muted)' }}
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
                backgroundColor: active ? 'var(--sb-active)' : 'transparent',
                color: active ? 'var(--sb-text)' : 'var(--sb-muted)',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sb-muted)'; } }}
            >
              <Tooltip content={collapsed ? label : null} position="right" className="w-full h-full flex items-center">
                <div className={`flex items-center w-full h-full ${collapsed ? 'justify-center' : 'pl-[12px] gap-[16px] pr-[12px]'}`}>
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="text-[13px] font-medium">{label}</span>}
                  {!collapsed && label === 'Чат' && showUnreadChatBadge && (
                    <Counter value={displayedUnreadChats} size="sm" status="muted" className="ml-auto" dark={theme.isDark} />
                  )}
                </div>
              </Tooltip>
            </Link>
          );
        })}
      </nav>

      <div className="mx-[12px] mt-[16px] mb-[16px]" style={{ borderTop: '1px solid var(--sb-border)' }} />

      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!collapsed && (
          <div className="flex items-center justify-between px-[16px] mb-[16px]">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sb-muted-header)' }}>ПРОЄКТИ</p>
            {can(orgRole, 'create:project') && (
              <button
                onClick={() => router.push('/?new=1')}
                data-ui-control="branding-action"
                className="transition-colors" title="Новий проєкт"
                style={{ color: 'var(--sb-muted-header)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--sb-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--sb-muted-header)'; }}
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
                    backgroundColor: active ? 'var(--sb-active)' : 'transparent',
                    color: active ? 'var(--sb-text)' : 'var(--sb-muted-project)',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-text)'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sb-muted-project)'; } }}
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
        <div className={`shrink-0 ${collapsed ? 'p-[12px]' : 'p-[16px]'}`} style={{ borderTop: '1px solid var(--sb-border)', backgroundColor: theme.bg }}>
          <div
            onClick={() => {
              const targetHref = timerTargetHref(activeTimer);
              if (targetHref) router.push(targetHref);
            }}
            // The capsule carries the stop button, so it is not a `<button>`.
            role="button"
            tabIndex={0}
            aria-label="Відкрити задачу з активним таймером"
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              const targetHref = timerTargetHref(activeTimer);
              if (targetHref) router.push(targetHref);
            }}
            className={`transition-colors rounded-[12px] flex items-center cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)] ${collapsed ? 'justify-center flex-col gap-1 py-2' : 'justify-between pl-[12px] pr-[4px] py-[4px]'}`}
            style={{ backgroundColor: 'var(--sb-active)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--sb-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--sb-active)'; }}
          >
            {!collapsed && (
              <div className="flex items-center gap-[8px]">
                <Clock size={14} className="text-[#3b82f6] animate-pulse" />
                <span className="text-[13px] font-mono font-medium" style={{ color: 'var(--sb-text)' }}>{formatElapsed(timerElapsed)}</span>
              </div>
            )}
            {collapsed && (
              <span className="text-[10px] font-mono font-medium" style={{ color: 'var(--sb-text)' }}>{formatElapsed(timerElapsed)}</span>
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
