'use client';
// src/components/WorkspaceSidebar.jsx — Dark sidebar like qt/ header
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import {
  LayoutGrid, CheckSquare, Settings, LogOut, ChevronRight,
  ExternalLink, Plus, Folder,
} from 'lucide-react';
import UserAvatar from './UserAvatar';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function WorkspaceSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, signOut, projects } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { href: '/workspace', icon: LayoutGrid, label: 'Огляд', exact: true },
    { href: '/workspace/my', icon: CheckSquare, label: 'Мої задачі' },
    { href: '/workspace/settings', icon: Settings, label: 'Налаштування' },
  ];

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href) && href !== '/workspace';

  const projectActive = (id) => pathname.startsWith(`/workspace/${id}`);

  return (
    <aside
      style={{ width: collapsed ? 64 : 240 }}
      className="h-full bg-[#1f1f1f] flex flex-col transition-all duration-200 shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.08] shrink-0 h-[60px]">
        {!collapsed && (
          <Image src="/logo.svg" alt="QuickTeam" width={120} height={29} className="object-contain" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/30 hover:text-white/70 transition-colors ml-auto"
        >
          <ChevronRight
            size={16}
            className="transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-[2px]">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact) || (exact && pathname === '/workspace');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-all ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Projects section */}
        {!collapsed && (
          <div className="mt-4">
            <p className="px-3 text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">
              Проєкти
            </p>
            <div className="flex flex-col gap-[2px]">
              {projects?.map(p => (
                <Link
                  key={p.id}
                  href={`/workspace/${p.id}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-[9px] text-[13px] transition-all ${
                    projectActive(p.id)
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'
                  }`}
                >
                  <Folder size={14} className="shrink-0" />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Collapsed: project dots */}
        {collapsed && (
          <div className="mt-4 flex flex-col gap-[2px] items-center">
            {projects?.slice(0, 8).map(p => (
              <Link
                key={p.id}
                href={`/workspace/${p.id}`}
                title={p.name}
                className={`w-8 h-8 rounded-[9px] flex items-center justify-center transition-all ${
                  projectActive(p.id) ? 'bg-white/10' : 'hover:bg-white/[0.05]'
                }`}
              >
                <Folder size={14} className={projectActive(p.id) ? 'text-white' : 'text-white/40'} />
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom: portal link + user */}
      <div className="px-2 pb-4 border-t border-white/[0.08] pt-3 flex flex-col gap-2 shrink-0">
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Клієнтський портал' : undefined}
          className="flex items-center gap-3 px-3 py-2 rounded-[9px] text-[12px] text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
        >
          <ExternalLink size={14} className="shrink-0" />
          {!collapsed && <span>Клієнтський портал</span>}
        </a>

        <button
          onClick={async () => { await signOut(); router.replace('/login'); }}
          title={collapsed ? 'Вийти' : undefined}
          className="flex items-center gap-3 px-3 py-2 rounded-[9px] text-[12px] text-white/30 hover:text-red-400/70 hover:bg-white/[0.05] transition-all"
        >
          <LogOut size={14} className="shrink-0" />
          {!collapsed && <span>Вийти</span>}
        </button>

        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
          <UserAvatar user={currentUser} size={28} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white/80 text-[12px] font-medium truncate">{currentUser?.name}</p>
              <p className="text-white/30 text-[10px] truncate">{currentUser?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
