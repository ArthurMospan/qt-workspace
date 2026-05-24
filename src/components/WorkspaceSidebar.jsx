'use client';
// src/components/WorkspaceSidebar.jsx
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/lib/context/AppContext';
import UserAvatar from './UserAvatar';

const NAV = [
  {
    href: '/workspace',
    label: 'Огляд',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
];

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function WorkspaceSidebar() {
  const pathname = usePathname();
  const { currentUser, projects, signOut } = useAppContext();

  const isActive = (href) =>
    href === '/workspace' ? pathname === '/workspace' : pathname.startsWith(href);

  return (
    <aside className="w-[220px] shrink-0 h-full flex flex-col bg-[#141414] border-r border-white/[0.06]">
      {/* Logo + Brand */}
      <div className="px-[20px] pt-[22px] pb-[18px] border-b border-white/[0.05]">
        <div className="flex items-center gap-[10px]">
          <div className="w-[32px] h-[32px] rounded-[9px] bg-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div>
            <p className="text-white text-[13px] font-bold leading-none">Workspace</p>
            <p className="text-white/30 text-[10px] mt-[2px]">QuickTeam</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-[10px] pt-[12px] flex flex-col gap-[2px]">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-[10px] px-[12px] py-[9px] rounded-[10px] text-[13px] font-medium transition-all ${
              isActive(item.href)
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Projects list */}
        <div className="mt-[16px] mb-[6px] px-[12px]">
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.1em]">Проєкти</p>
        </div>
        {projects?.map(project => {
          const href = `/workspace/${project.id}`;
          return (
            <Link
              key={project.id}
              href={href}
              className={`flex items-center gap-[10px] px-[12px] py-[8px] rounded-[10px] text-[12px] font-medium transition-all group ${
                pathname.startsWith(href)
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]'
              }`}
            >
              <span className="w-[6px] h-[6px] rounded-full bg-white/20 group-hover:bg-white/40 shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Portal link + User */}
      <div className="mt-auto border-t border-white/[0.05]">
        {/* Back to portal */}
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[10px] px-[20px] py-[14px] text-white/30 hover:text-white/60 text-[12px] font-medium transition-colors border-b border-white/[0.05]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Клієнтський портал
        </a>

        {/* User info */}
        <div className="flex items-center gap-[10px] px-[16px] py-[14px]">
          <UserAvatar user={currentUser} className="w-[30px] h-[30px] shrink-0" showOnline />
          <div className="flex-1 min-w-0">
            <p className="text-white text-[12px] font-semibold truncate">{currentUser?.name}</p>
            <p className="text-white/30 text-[10px] truncate">{currentUser?.email}</p>
          </div>
          <button
            onClick={signOut}
            title="Вийти"
            className="text-white/20 hover:text-white/60 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
