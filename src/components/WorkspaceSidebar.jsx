'use client';
// src/components/WorkspaceSidebar.jsx — Clean sidebar, no user menu, no sub-nav
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import {
  LayoutGrid, CheckSquare, Settings, Folder,
  PanelLeftClose, PanelLeftOpen, Users, Plus,
} from 'lucide-react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function WorkspaceSidebar() {
  const pathname  = usePathname();
  const { projects } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href);

  const topNav = [
    { href: '/workspace',          icon: LayoutGrid,  label: 'Огляд',       exact: true },
    { href: '/workspace/my',       icon: CheckSquare, label: 'Мої задачі' },
    { href: '/workspace/team',     icon: Users,       label: 'Команда' },
    { href: '/workspace/settings', icon: Settings,    label: 'Налаштування' },
  ];

  return (
    <aside
      style={{ width: collapsed ? 52 : 216 }}
      className="h-full bg-[#1a1a1a] flex flex-col transition-[width] duration-200 shrink-0 overflow-hidden border-r border-white/[0.05]"
    >
      {/* Logo + toggle */}
      <div className="flex items-center justify-between px-3 h-[48px] border-b border-white/[0.07] shrink-0">
        {!collapsed && (
          <Image src="/logo.svg" alt="QuickTeam" width={96} height={20} className="object-contain ml-1" />
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`text-white/25 hover:text-white/60 transition-colors shrink-0 ${collapsed ? 'mx-auto' : ''}`}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Top nav */}
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

      {/* Divider */}
      <div className="mx-3 border-t border-white/[0.06]" />

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {!collapsed && (
          <div className="flex items-center justify-between px-[9px] mb-[6px]">
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Проєкти</p>
            <a href={PORTAL_URL} target="_blank" rel="noopener"
              className="text-white/20 hover:text-white/60 transition-colors" title="Новий проєкт в порталі">
              <Plus size={12} />
            </a>
          </div>
        )}
        <div className="flex flex-col gap-[2px]">
          {(projects || [])
            .filter(p => p.status !== 'archived')
            .map(p => {
              const active = pathname.startsWith(`/workspace/${p.id}`);
              return (
                <Link key={p.id} href={`/workspace/${p.id}`} title={collapsed ? p.name : undefined}
                  className={`flex items-center gap-[9px] px-[9px] py-[7px] rounded-[8px] text-[11px] transition-all ${
                    active ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
                  }`}>
                  <Folder size={13} className="shrink-0" />
                  {!collapsed && <span className="truncate">{p.name}</span>}
                </Link>
              );
            })}
        </div>
      </div>
    </aside>
  );
}
