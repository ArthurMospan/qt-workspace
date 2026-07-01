'use client';
// src/components/WorkspaceSidebar.jsx
import { useState } from 'react';
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
  Zap, Clock, Square as StopIcon
} from 'lucide-react';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import Tooltip from '@/components/ui/Navigation/Tooltip';

import { can } from '@/lib/utils/can';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function WorkspaceSidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { projects, activeOrg, allOrgs, orgRole } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);

  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const timerElapsed = useWorkspaceStore(s => s.timerElapsed);
  const formatElapsed = useWorkspaceStore(s => s.formatElapsed);
  const stopTimer = useWorkspaceStore(s => s.stopTimer);

  const handleStopGlobalTimer = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = stopTimer();
    if (result && result.minutes > 0 && result.projectId) {
      router.push(`/workspace/${result.projectId}/issue/${result.issueId}?logTime=${result.minutes}`);
    } else if (result && result.projectId) {
      router.push(`/workspace/${result.projectId}/issue/${result.issueId}`);
    }
  };

  const isActive = (href, exact) =>
    exact ? pathname === href : pathname.startsWith(href);

  const topNav = [
    { href: '/workspace',            icon: Folder,        label: 'Проєкти',     exact: true },
    { href: '/workspace/my',         icon: CheckCircle2,  label: 'Мої завдання' },
    { href: '/workspace/sprints',    icon: Zap,           label: 'Спринти' },
    { href: '/workspace/chat',       icon: MessageSquare, label: 'Чат' },
    { href: '/workspace/team',       icon: Users,         label: 'Команда' },
    { href: '/workspace/analytics',  icon: PieChart,      label: 'Аналітика',   exact: false },
    { href: '/workspace/settings',   icon: Settings,      label: 'Налаштування' },
  ];

  return (
    <aside
      style={{ width: collapsed ? 68 : 260 }}
      className="h-full bg-[#1f1f1f] flex flex-col transition-[width] duration-200 shrink-0 overflow-hidden hide-scrollbar relative group"
    >
      {/* Top Logo & Org Switcher */}
      <div className={`flex flex-col pt-[24px] pb-[16px] shrink-0 ${collapsed ? 'px-0 items-center' : 'px-[20px]'}`}>
        <div className={`flex items-start ${collapsed ? 'justify-center w-full' : 'justify-between w-full'}`}>
          {!collapsed ? (
            <>
              <div className="flex items-start min-w-0 flex-1">
                <Link href="/workspace" className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                  <Image src="/logo-min.svg" alt="QT" width={32} height={32} className="object-contain" />
                </Link>
                <div className="flex flex-col mt-[-2px] min-w-0 ml-[12px]">
                  <Link href="/workspace" className="hover:opacity-80 transition-opacity">
                     <h1 className="text-white text-[18px] font-bold tracking-tight leading-tight truncate">QuickTeam</h1>
                  </Link>
                  <div 
                    onClick={() => setShowOrgSwitcher(true)}
                    className="flex items-center gap-[4px] text-[#9a9a9a] mt-[2px] cursor-pointer hover:text-white transition-colors w-fit"
                  >
                    <span className="text-[12px] font-medium truncate max-w-[120px]">{activeOrg?.name || 'Company name'}</span>
                    <ChevronsUpDown size={12} className="shrink-0" />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="mt-1 text-[#9a9a9a] hover:text-white transition-colors shrink-0 ml-[8px]"
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
                  className="text-[#9a9a9a] hover:text-white transition-colors"
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
              className={`flex items-center mx-[8px] h-[40px] rounded-[12px] transition-all ${
                active ? 'bg-[#333333] text-white' : 'text-[#9a9a9a] hover:text-white hover:bg-white/[0.04]'
              }`}>
              <Tooltip content={collapsed ? label : null} position="right" className="w-full h-full flex items-center">
                <div className={`flex items-center w-full h-full ${collapsed ? 'justify-center' : 'pl-[12px] gap-[16px] pr-[12px]'}`}>
                  <Icon size={20} className="shrink-0" />
                  {!collapsed && <span className="text-[14px] font-medium">{label}</span>}
                  {!collapsed && label === 'Чат' && (
                    <Counter value={3} size="sm" status="info" className="ml-auto" dark />
                  )}
                </div>
              </Tooltip>
            </Link>
          );
        })}
      </nav>

      <div className="mx-[12px] border-t border-white/[0.06] mt-[16px] mb-[16px]" />

      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!collapsed && (
          <div className="flex items-center justify-between px-[16px] mb-[16px]">
            <p className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">ПРОЄКТИ</p>
            {can(orgRole, 'create:project') && (
              <button
                onClick={() => router.push('/workspace?new=1')}
                className="text-[#666666] hover:text-white transition-colors" title="Новий проєкт">
                <Plus size={16} />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-[4px]">
          {(projects || [])
            .filter(p => p.status !== 'archived')
            .map(p => {
              const active = pathname.startsWith(`/workspace/${p.id}`);
              return (
                <Link key={p.id} href={`/workspace/${p.id}`} title={collapsed ? undefined : p.name}
                  className={`flex items-center mx-[8px] h-[32px] rounded-[8px] transition-all ${
                    active ? 'bg-[#333333] text-white' : 'text-[#777777] hover:text-white hover:bg-white/[0.04]'
                  }`}>
                  <Tooltip content={collapsed ? p.name : null} position="right" className="w-full h-full flex items-center">
                    <div className={`flex items-center w-full h-full ${collapsed ? 'justify-center' : 'pl-[12px] gap-[16px] pr-[12px]'}`}>
                      <Folder size={16} className="shrink-0" />
                      {!collapsed && <span className="text-[13px] font-medium truncate">{p.name}</span>}
                      {!collapsed && (p.status === 'active' || p.id === projects[0]?.id) && (
                        <Counter variant="dot" size="sm" status="info" className="ml-auto" dark />
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
        <div className={`shrink-0 border-t border-white/[0.06] bg-[#1f1f1f] ${collapsed ? 'p-[12px]' : 'p-[16px]'}`}>
          <div 
            onClick={() => {
              if (activeTimer.projectId) {
                router.push(`/workspace/${activeTimer.projectId}/issue/${activeTimer.issueId}`);
              }
            }}
            className={`bg-[#333333] hover:bg-[#404040] transition-colors rounded-[12px] flex items-center cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)] ${collapsed ? 'justify-center flex-col gap-1 py-2' : 'justify-between pl-[12px] pr-[4px] py-[4px]'}`}
          >
            {!collapsed && (
              <div className="flex items-center gap-[8px]">
                <Clock size={14} className="text-[#3b82f6] animate-pulse" />
                <span className="text-white text-[13px] font-mono font-medium">{formatElapsed(timerElapsed)}</span>
              </div>
            )}
            {collapsed && (
              <span className="text-white text-[10px] font-mono font-medium">{formatElapsed(timerElapsed)}</span>
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
