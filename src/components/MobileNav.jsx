'use client';
// src/components/MobileNav.jsx — mobile bottom tab bar + «Ще» sheet
// Renders only below md (the wrapper in workspace/layout.js is md:hidden).
// Primary destinations live in the bar; everything else from the desktop
// sidebar (спринти, команда, налаштування, список проєктів, таймер) —
// у висувній шторці «Ще».
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { Button, Counter, IconAction } from '@/components/ui';
import {
  Folder, PieChart, Menu, X,
  Zap, Users, Settings, Clock, Square as StopIcon, ChevronsUpDown, CircleHelp, TicketCheck,
} from 'lucide-react';
import { CalendarIcon, ChatIcon, TaskIcon } from '@/lib/design/icons';
import OrgSwitcherScreen from '@/components/OrgSwitcherScreen';
import { useWorkspaceHelp } from '@/components/WorkspaceHelpMenu';
import WorkspacePlanLimitRail from '@/components/WorkspacePlanLimitRail';
import { computeSidebarTheme, computeTranslucentSidebarTheme, SIDEBAR_PRESETS } from '@/lib/utils/sidebarTheme';
import { useCachedOrgBranding, useSidebarThemeBoot } from '@/lib/hooks/useCachedOrgBranding';
import { timerTargetHref } from '@/lib/utils/timerNavigation.mjs';
import { useModalFocus } from '@/lib/hooks/useModalFocus';
import { useQTicketIntegration } from '@/lib/hooks/useQTicketIntegration';

// The bar is glass: the organization's colour at this much opacity over a blur
// of whatever is scrolling underneath. It is a request rather than a setting —
// `computeTranslucentSidebarTheme` hands back the opacity the brand colour can
// actually afford while its labels still clear AA, and that is the number the
// bar is painted with.
const NAV_OPACITY = 0.88;

const TABS = [
  { href: '/',           icon: Folder,        label: 'Проєкти', exact: true },
  { href: '/my',        icon: TaskIcon,      label: 'Мої' },
  { href: '/chat',      icon: ChatIcon,      label: 'Чат' },
  { href: '/analytics', icon: PieChart,      label: 'Аналітика' },
];

const MORE_NAV = [
  { href: '/calendar', icon: CalendarIcon, label: 'Календар' },
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
        // The strip carries the stop button, so it is not a `<button>` itself.
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onNavigate(activeTimer);
        }}
        // The bar paints itself from the sidebar's own tokens, so a brand
        // colour reaches the sheet too. `#333333` was a dark grey chosen when
        // the only rail was the dark one, and on a light brand it was a black
        // slab with white text sitting in a white sheet.
        className="bg-[var(--sb-active)] rounded-[12px] flex items-center justify-between pl-[12px] pr-[6px] py-[6px] cursor-pointer">
        <div className="flex items-center gap-[8px]">
          <Clock size={14} className="animate-pulse text-[var(--sb-text)]" />
          <span className="text-[var(--sb-text)] text-[13px] font-mono font-medium">{formatElapsed(timerElapsed)}</span>
        </div>
        <IconAction
          label="Зупинити та зберегти"
          icon={StopIcon}
          size="compact"
          appearance="danger"
          shape="compact"
          onClick={onStop}
        />
      </div>
    </div>
  );
}

/**
 * @param {boolean} props.keyboardOpen The on-screen keyboard is covering part of
 *   the viewport, so there is neither room for a tab bar nor a reason for one —
 *   the reader is typing, not navigating. Measured by the workspace layout,
 *   which watches for it on every route, including the two that render no bar.
 * @param {boolean} props.composerFocused The caret is in a chat composer. The
 *   same conclusion, reached from the cause rather than from the consequence:
 *   it is true from the tap rather than from the moment the keys finish sliding
 *   in, it stays true when the keyboard is dismissed under a still-focused
 *   field, and it is true where no keyboard covers anything at all.
 */
export default function MobileNav({ keyboardOpen = false, composerFocused = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeOrg, activeOrgId } = useAppContext();
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const moreDialogRef = useModalFocus({ isOpen: moreOpen, onClose: () => setMoreOpen(false) });
  // Довідка, підтримка, новини та правові документи — той самий список, що
  // висить на кебабі бічної рейки. Його діалоги живуть поза шторкою: шторка
  // закривається від дотику, а діалог має лишитися на екрані.
  const { items: helpItems, overlays: helpOverlays } = useWorkspaceHelp();

  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const stopTimer = useWorkspaceStore(s => s.stopTimer);
  const showToast = useWorkspaceStore(s => s.showToast);
  const {
    enabledForCurrentUser: qTicketEnabled,
    loading: qTicketLoading,
    open: openQTicket,
  } = useQTicketIntegration();
  const unreadByOrganization = useWorkspaceStore(s => s.notificationUnreadByOrg);
  // Published by WorkspaceNotificationBridge, which holds the only subscription
  // to the chat channels and read cursors.
  const displayedUnreadChats = useWorkspaceStore(s => s.unreadChatCount);
  const otherOrgUnreadCount = Object.entries(unreadByOrganization).reduce(
    (total, [organizationId, count]) => organizationId === activeOrgId ? total : total + count,
    0,
  );

  // Close the sheet on navigation
  const sidebarPreview = useWorkspaceStore(s => s.sidebarPreview);
  // Кеш брендингу — без мигання стандартної теми, поки org завантажується.
  const orgBrand = useCachedOrgBranding(activeOrgId, activeOrg);
  const isBranded = sidebarPreview
    ? Boolean(sidebarPreview.customBranding && sidebarPreview.logo)
    : Boolean(orgBrand?.customBranding && orgBrand?.logo);

  const theme = useMemo(() => {
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

  // The sheet is opaque and wears `theme`; the bar is glass and wears this.
  // Same organization colour, tokens derived from what it looks like through
  // the page rather than from what it is.
  const barTheme = useMemo(
    () => computeTranslucentSidebarTheme(theme.bg, { opacity: NAV_OPACITY }),
    [theme.bg],
  );

  // Кеш теми + зняття boot-стилю з layout.js, щойно тема справжня.
  useSidebarThemeBoot(theme, Boolean(activeOrg), activeOrgId);

  useEffect(() => { queueMicrotask(() => setMoreOpen(false)); }, [pathname]);


  const isActive = (href, exact) => (exact ? pathname === href : pathname.startsWith(href));
  // «Ще» is highlighted when the current page lives in the sheet
  const moreActive = MORE_NAV.some(i => isActive(i.href));

  // Two reasons, one bar. Both mean the screen belongs to what is being typed.
  const navHidden = keyboardOpen || composerFocused;

  const handleStopTimer = async e => {
    e.stopPropagation();
    // The minutes ride in the store, not in the URL — see `stopTimer`.
    try {
      const result = await stopTimer();
      if (result?.queued) showToast('Зупинку таймера збережено до відновлення мережі', 'warning');
      setMoreOpen(false);
      const targetHref = timerTargetHref(result);
      if (targetHref) router.push(targetHref);
    } catch (error) {
      showToast(error.message || 'Не вдалося зупинити таймер', 'error');
    }
  };

  const handleTimerNavigate = (timer) => {
    setMoreOpen(false);
    const targetHref = timerTargetHref(timer);
    if (targetHref) router.push(targetHref);
  };

  const handleOpenQTicket = async () => {
    try {
      await openQTicket('/overview');
    } catch (error) {
      showToast(error.message || 'Не вдалося відкрити qTicket', 'error');
    }
  };

  return (
    <>
      {/* The last of the page, dissolving. The bar is glass and the content
          runs underneath it, so what needed handling was the edge: a row cut
          flat at the bottom of the screen, and the 10px beside the pill where
          nothing covered it at all. Behind the bar, never in front of it, and
          never in the way of a thumb. */}
      <div
        aria-hidden="true"
        className={`qt-nav-veil transition-opacity duration-200 ${navHidden ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* ── Bottom tab bar ─────────────────────────────────────────────
          A floating capsule rather than a strip welded to the bottom edge:
          inset from all three sides, so the corner radius is real and the bar
          never has to share an edge with the browser's own chrome. The
          geometry, the glass and the two shadows live in globals.css
          (--qt-nav-*, .qt-nav-bar); what this file supplies is the colour and
          how much of it the page is allowed to show through. */}
      <nav
        data-app-sb
        data-nav-tone={barTheme.isDark ? 'dark' : 'light'}
        aria-label="Основна навігація"
        aria-hidden={navHidden}
        // `pointer-events-none` takes the bar out of a thumb's way and
        // `aria-hidden` out of a screen reader's, but neither takes its five
        // links out of the tab order — and a hidden-but-tabbable control inside
        // an aria-hidden container is exactly what a hardware or split keyboard,
        // the case `composerFocused` newly hides the bar for, would walk into.
        inert={navHidden || undefined}
        className={`qt-nav-bar fixed z-40 flex items-stretch overflow-hidden transition-[transform,opacity] duration-200 ${
          navHidden ? 'pointer-events-none translate-y-[140%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
        style={{
          left: 'var(--qt-nav-gap)',
          right: 'var(--qt-nav-gap)',
          bottom: 'var(--qt-nav-inset)',
          height: 'var(--qt-nav-height)',
          '--qt-nav-opacity': `${barTheme.opacity * 100}%`,
          '--sb-bg': barTheme.bg,
          '--sb-text': barTheme.text,
          '--sb-muted': barTheme.muted,
          '--sb-hover': barTheme.hover,
          '--sb-active': barTheme.active,
          '--sb-border': barTheme.border,
        }}
      >
        {TABS.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors active:bg-[var(--sb-active)] ${
                active ? 'text-[var(--sb-text)]' : 'text-[var(--sb-muted)] hover:text-[var(--sb-hover)]'
              }`}>
              <Icon size={20} />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
              {label === 'Чат' && displayedUnreadChats > 0 && (
                <span className="absolute top-[7px] left-[calc(50%+4px)]">
                  <Counter value={displayedUnreadChats} size="sm" status="muted" dark />
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          // The help list is closed every time the sheet is opened: it is the
          // answer to a question somebody asked once, not a section that stays
          // expanded behind them.
          onClick={() => { setHelpOpen(false); setMoreOpen(o => !o); }}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`relative flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors active:bg-[var(--sb-active)] ${
            moreOpen || moreActive ? 'text-[var(--sb-text)]' : 'text-[var(--sb-muted)] hover:text-[var(--sb-hover)]'
          }`}>
          <Menu size={20} />
          <span className="text-[10px] font-semibold leading-none">Ще</span>
          {activeTimer && (
            <span className="absolute top-[8px] left-[calc(50%+6px)] w-[8px] h-[8px] bg-danger-solid rounded-full animate-pulse" />
          )}
          {otherOrgUnreadCount > 0 && !activeTimer && (
            <span className="absolute top-[6px] left-[calc(50%+4px)]">
              <Counter variant="dot" size="sm" appearance="sidebar" />
            </span>
          )}
        </button>
      </nav>

      {/* ── «Ще» bottom sheet ──────────────────────────────────────── */}
      {moreOpen && (
        <div data-ui-overlay="navigation-sheet" className="fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            ref={moreDialogRef}
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            // A sheet is a dialog: it covers the page, it traps the reader's
            // attention, and it says so. Without the role it was an anonymous
            // box, and the layer behind it an anonymous click target.
            role="dialog"
            aria-modal="true"
            aria-label="Більше розділів"
            // Inset and rounded on every corner, like the bar it replaces —
            // a full-bleed sheet under a floating pill read as two different
            // apps. dvh, not vh, so the cap is the space that actually exists
            // once the browser's toolbars are counted.
            className="qt-sheet-in absolute bg-[var(--sb-bg)] rounded-[24px] max-h-[78dvh] overflow-y-auto overscroll-contain"
            style={{
              left: 'var(--qt-nav-gap)',
              right: 'var(--qt-nav-gap)',
              bottom: 'var(--qt-nav-inset)',
              paddingBottom: '12px',
              '--sb-bg': theme.bg,
              '--sb-text': theme.text,
              '--sb-muted': theme.muted,
              '--sb-hover': theme.hover,
              '--sb-active': theme.active,
              '--sb-border': theme.border,
            }}
          >
            {/* Handle + org row */}
            <div className="sticky top-0 bg-[var(--sb-bg)] pt-[10px] pb-[4px]">
              <div className="w-[36px] h-[4px] bg-[var(--sb-text)] opacity-20 rounded-full mx-auto mb-[12px]" />
              <div className="flex items-center justify-between px-[20px] pb-[8px]">
                <button
                  onClick={() => setShowOrgSwitcher(true)}
                  className="flex items-center gap-[6px] text-[var(--sb-text)] min-w-0">
                  <span className="min-w-0 truncate text-[15px] font-bold">{activeOrg?.name || 'QuickTeam'}</span>
                  {/* Той самий розклад, що й у рейці: крапка при стрілках, бо
                      відповідає за неї перемикач, а не назва поруч. Назва
                      скорочується, тож ні крапка, ні стрілки не наповзають на
                      «Закрити» праворуч. */}
                  <span className="flex shrink-0 items-center gap-[6px]">
                    <ChevronsUpDown size={14} className="shrink-0 text-[var(--sb-muted)]" />
                    {otherOrgUnreadCount > 0 && (
                      <Counter variant="dot" size="sm" appearance="sidebar" />
                    )}
                  </span>
                </button>
                <IconAction label="Закрити" icon={X} size="sm" appearance="quiet" onClick={() => setMoreOpen(false)} className="-mr-[6px]" />
              </div>
            </div>

            {/* Active timer capsule (subscribes to the 1s tick internally) */}
            <SheetTimerCapsule onNavigate={handleTimerNavigate} onStop={handleStopTimer} />

            {/* The rail's ceiling notice, in the drawer that stands in for the
                rail on a phone. The sheet already carries every `--sb-*` the
                row mixes its colours from, so it is the same component with
                nothing said twice. */}
            <WorkspacePlanLimitRail />

            {/* Secondary nav */}
            <div className="flex flex-col gap-[2px] px-[8px]">
              {qTicketEnabled && (
                <button
                  type="button"
                  data-ui-control="navigation-sheet-row"
                  onClick={handleOpenQTicket}
                  disabled={qTicketLoading}
                  className="flex h-[44px] items-center gap-[14px] rounded-[12px] px-[12px] text-left text-[var(--sb-muted)] transition-colors hover:text-[var(--sb-hover)] active:bg-[var(--sb-active)] disabled:opacity-50"
                >
                  <TicketCheck size={19} />
                  <span className="text-[14px] font-medium">{qTicketLoading ? 'Відкриваємо…' : 'qTicket'}</span>
                </button>
              )}
              {MORE_NAV.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-[14px] h-[44px] px-[12px] rounded-[12px] transition-colors ${
                      active ? 'bg-[var(--sb-active)] text-[var(--sb-text)]' : 'text-[var(--sb-muted)] hover:text-[var(--sb-hover)]'
                    }`}>
                    <Icon size={19} />
                    <span className="text-[14px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mx-[16px] border-t border-white/[0.08] my-[10px]" />

            {/* Projects. No «ПРОЄКТИ» heading and no «+» over the list: the
                rail dropped both in QUI-33 — the list of folders *is* the
                projects, and a new one is made from «Проєкти» — and the sheet
                kept its copy, so the two menus said different things about
                the same list. */}
            <div className="flex flex-col gap-[2px] px-[8px]">
              {(projects || [])
                .filter(p => p.status !== 'archived')
                .map(p => {
                  const active = pathname.startsWith(`/${p.id}`);
                  return (
                    <Link key={p.id} href={`/${p.id}`}
                      className={`flex items-center gap-[14px] h-[40px] px-[12px] rounded-[10px] transition-colors ${
                        active ? 'bg-[var(--sb-active)] text-[var(--sb-text)]' : 'text-[var(--sb-muted)]'
                      }`}>
                      <Folder size={16} className="shrink-0" />
                      <span className="text-[13px] font-medium truncate">{p.name}</span>
                    </Link>
                  );
                })}
            </div>

            {/* Довідка. На десктопі вона висить на кебабі внизу рейки; на
                телефоні рейки немає, тож підтримка, довідка, новини й правові
                документи не мали жодного входу взагалі. */}
            <div className="mx-[16px] border-t border-white/[0.08] my-[10px]" />
            {helpOpen && (
              <div className="flex flex-col gap-[2px] px-[8px] pb-[6px]">
                {helpItems.filter(item => !item.isDivider).map(({ label, icon: Icon, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    // The sheet's own row, wearing the sidebar theme variables the
                    // two lists above it wear. Those are `Link`s because they go
                    // somewhere; these open a dialog in place, which is the one
                    // difference — so the element differs and nothing else does.
                    data-ui-control="navigation-sheet-row"
                    onClick={() => { setMoreOpen(false); onClick(); }}
                    className="flex items-center gap-[14px] h-[40px] px-[12px] rounded-[10px] text-left text-[var(--sb-muted)] transition-colors hover:text-[var(--sb-hover)] active:bg-[var(--sb-active)]"
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="text-[13px] font-medium truncate">{label}</span>
                  </button>
                ))}
              </div>
            )}
            {/* The same quiet circle the rail carries, in the same place: last,
                small, and closed until it is asked. Seven legal-and-support
                rows printed under «Проєкти» made the sheet's longest section
                the one nobody opened it for. */}
            <div className="flex items-center px-[13px]">
              <Button
                style="ghost"
                size="icon"
                icon={CircleHelp}
                composition="sidebar-help-action"
                onClick={() => setHelpOpen(open => !open)}
                aria-expanded={helpOpen}
                aria-label="Допомога та інформація"
                title="Допомога та інформація"
              />
            </div>
          </div>
        </div>
      )}

      {helpOverlays}

      {showOrgSwitcher && <OrgSwitcherScreen onClose={() => setShowOrgSwitcher(false)} />}
    </>
  );
}
