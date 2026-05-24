'use client';
// src/components/WorkspaceSidebar.jsx — Redesigned: compact, no portal link, proper icons
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import { LayoutGrid, CheckSquare, Settings, LogOut, Folder, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function WorkspaceSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, signOut, projects } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { href: '/workspace',          icon: LayoutGrid,  label: 'Огляд',       exact: true },
    { href: '/workspace/my',       icon: CheckSquare, label: 'Мої задачі' },
    { href: '/workspace/settings', icon: Settings,    label: 'Налаштування' },
  ];

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      style={{ width: collapsed ? 56 : 232 }}
      className="h-full bg-[#1f1f1f] flex flex-col transition-[width] duration-200 shrink-0 overflow-hidden"
    >
      {/* Logo + toggle */}
      <div className="flex items-center justify-between px-3 h-[56px] border-b border-white/[0.07] shrink-0">
        {!collapsed && (
          <Image src="/logo.svg" alt="QuickTeam" width={110} height={26} className="object-contain ml-1" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-white/30 hover:text-white/70 transition-colors shrink-0 ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed
            ? <PanelLeftOpen size={17} />
            : <PanelLeftClose size={17} />
          }
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-[2px]">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined}
              className={`flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all ${
                active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Projects */}
        {!collapsed && projects?.length > 0 && (
          <div className="mt-5">
            <p className="px-[10px] text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-[6px]">
              Проєкти
            </p>
            <div className="flex flex-col gap-[2px]">
              {projects.map(p => {
                const active = pathname.startsWith(`/workspace/${p.id}`);
                return (
                  <Link key={p.id} href={`/workspace/${p.id}`}
                    className={`flex items-center gap-[10px] px-[10px] py-[7px] rounded-[8px] text-[12px] transition-all ${
                      active ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Folder size={13} className="shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed: project icons */}
        {collapsed && projects?.slice(0, 8).map(p => {
          const active = pathname.startsWith(`/workspace/${p.id}`);
          return (
            <Link key={p.id} href={`/workspace/${p.id}`} title={p.name}
              className={`flex items-center justify-center py-[8px] rounded-[8px] transition-all ${
                active ? 'bg-white/10' : 'hover:bg-white/[0.05]'
              }`}
            >
              <Folder size={13} className={active ? 'text-white' : 'text-white/35'} />
            </Link>
          );
        })}
      </nav>

      {/* User footer — compact */}
      <div className="px-2 pb-3 pt-2 border-t border-white/[0.07] shrink-0">
        <button
          onClick={async () => { await signOut(); router.replace('/login'); }}
          title="Вийти"
          className={`flex items-center gap-[10px] px-[10px] py-[7px] rounded-[8px] text-[12px] text-white/35 hover:text-red-400 hover:bg-white/[0.05] transition-all w-full mb-[4px] ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={13} className="shrink-0" />
          {!collapsed && <span>Вийти</span>}
        </button>

        {/* Compact user row */}
        <div className={`flex items-center gap-[8px] px-[10px] py-[6px] ${collapsed ? 'justify-center' : ''}`}>
          <UserAvatar user={currentUser} size={24} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white/70 text-[11px] font-semibold truncate leading-tight">{currentUser?.name}</p>
              <p className="text-white/25 text-[9px] truncate leading-tight">{currentUser?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
