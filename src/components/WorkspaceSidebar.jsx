'use client';
// src/components/WorkspaceSidebar.jsx
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import {
  LayoutGrid, CheckSquare, Settings, Folder,
  PanelLeftClose, PanelLeftOpen, ChevronDown, LogOut,
  BarChart2, List, Users,
} from 'lucide-react';
import UserAvatar from './UserAvatar';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function WorkspaceSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { currentUser, signOut, projects } = useAppContext();

  const [collapsed,    setCollapsed]    = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href);

  const topNav = [
    { href: '/workspace',          icon: LayoutGrid,  label: 'Огляд',       exact: true },
    { href: '/workspace/my',       icon: CheckSquare, label: 'Мої задачі' },
    { href: '/workspace/team',     icon: Users,       label: 'Команда' },
    { href: '/workspace/settings', icon: Settings,    label: 'Налаштування' },
  ];

  // Active project for sub-nav
  const activeProjectId = (() => {
    const m = pathname.match(/^\/workspace\/([^/]+)/);
    return m && !['my', 'settings', 'search'].includes(m[1]) ? m[1] : null;
  })();

  return (
    <aside
      style={{ width: collapsed ? 52 : 220 }}
      className="h-full bg-[#1a1a1a] flex flex-col transition-[width] duration-200 shrink-0 overflow-hidden border-r border-white/[0.05]"
    >
      {/* ── Logo + toggle ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-[52px] border-b border-white/[0.07] shrink-0">
        {!collapsed && (
          <Image src="/logo.svg" alt="QuickTeam" width={100} height={22} className="object-contain ml-1" />
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`text-white/25 hover:text-white/60 transition-colors shrink-0 ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── Top navigation ────────────────────────────────────────── */}
      <nav className="px-2 py-3 flex flex-col gap-[2px] shrink-0">
        {topNav.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined}
              className={`flex items-center gap-[9px] px-[9px] py-[7px] rounded-[8px] text-[12px] font-medium transition-all ${
                active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
              }`}>
              <Icon size={14} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Projects ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!collapsed && (
          <p className="px-[9px] text-[9px] font-bold text-white/20 uppercase tracking-widest mb-[5px]">
            Проєкти
          </p>
        )}
        <div className="flex flex-col gap-[2px]">
          {(projects || [])
            .filter(p => p.status !== 'archived')
            .map(p => {
              const active = pathname.startsWith(`/workspace/${p.id}`);
              return (
                <div key={p.id}>
                  <Link href={`/workspace/${p.id}`} title={collapsed ? p.name : undefined}
                    className={`flex items-center gap-[9px] px-[9px] py-[6px] rounded-[8px] text-[11px] transition-all ${
                      active ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
                    }`}>
                    <Folder size={13} className="shrink-0" />
                    {!collapsed && <span className="truncate">{p.name}</span>}
                  </Link>

                  {/* Sub-nav for active project */}
                  {!collapsed && active && activeProjectId === p.id && (
                    <div className="ml-[22px] flex flex-col gap-[1px] mt-[1px]">
                      <Link href={`/workspace/${p.id}/backlog`}
                        className={`flex items-center gap-[7px] px-[7px] py-[5px] rounded-[6px] text-[10px] transition-all ${
                          pathname.includes('/backlog') ? 'text-white/90 bg-white/[0.07]' : 'text-white/30 hover:text-white/60'
                        }`}>
                        <List size={10} /> Backlog
                      </Link>
                      <Link href={`/workspace/${p.id}/reports`}
                        className={`flex items-center gap-[7px] px-[7px] py-[5px] rounded-[6px] text-[10px] transition-all ${
                          pathname.includes('/reports') ? 'text-white/90 bg-white/[0.07]' : 'text-white/30 hover:text-white/60'
                        }`}>
                        <BarChart2 size={10} /> Reports
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* ── User menu (bottom) ───────────────────────────────────── */}
      <div className="px-2 pb-3 pt-2 border-t border-white/[0.07] shrink-0" ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(o => !o)}
          className={`flex items-center gap-[8px] w-full px-[9px] py-[7px] rounded-[8px] hover:bg-white/[0.06] transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <UserAvatar user={currentUser} size={24} className="shrink-0" />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-white/70 text-[11px] font-semibold truncate leading-tight">
                  {currentUser?.name || currentUser?.email}
                </p>
              </div>
              <ChevronDown size={12} className={`text-white/25 shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {/* Dropdown */}
        {userMenuOpen && (
          <div className={`bg-[#2a2a2a] border border-white/10 rounded-[10px] shadow-xl overflow-hidden mb-1 ${
            collapsed ? 'absolute left-[56px] bottom-3 w-[160px]' : 'mt-1'
          }`}>
            <div className="px-3 py-2 border-b border-white/[0.07]">
              <p className="text-white/60 text-[11px] font-semibold truncate">{currentUser?.name}</p>
              <p className="text-white/25 text-[9px] truncate">{currentUser?.email}</p>
            </div>
            <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-[8px] text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-all">
              ↗ Клієнтський портал
            </a>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-[8px] text-[11px] text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all w-full">
              <LogOut size={11} /> Вийти
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
