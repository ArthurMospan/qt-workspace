'use client';
// src/app/workspace/[projectId]/page.js — Board page with project tabs
import { use, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard        from '@/components/workspace/AgileBoard';
import { LayoutGrid, List, BarChart2, MessageSquare } from 'lucide-react';

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser } = useAppContext();
  const { issues, loading, createIssue, moveIssue } = useIssues(projectId);
  const showToast = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const actor = {
    userId:   currentUser?.id   || currentUser?.uid,
    userName: currentUser?.name || '',
  };

  const handleAddIssue = useCallback(async (columnId, title) => {
    try {
      await createIssue({ title, columnId }, actor);
      showToast('Задачу додано ✓');
    } catch (err) {
      showToast('Помилка: ' + err.message, 'error');
    }
  }, [createIssue, actor, showToast]);

  const handleMoveIssue = useCallback(async (issueId, newColumnId, newIndex) => {
    try {
      await moveIssue(issueId, newColumnId, newIndex, actor);
    } catch (err) {
      showToast(err.message || 'Помилка переміщення', 'error');
    }
  }, [moveIssue, actor, showToast]);

  const tabs = [
    { href: `/workspace/${projectId}`,         label: 'Дошка',   icon: LayoutGrid,    exact: true },
    { href: `/workspace/${projectId}/backlog`,  label: 'Backlog', icon: List },
    { href: `/workspace/${projectId}/reports`,  label: 'Reports', icon: BarChart2 },
    { href: `/workspace/${projectId}/portal`,   label: 'Портал',  icon: MessageSquare },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Project tab bar */}
      <div className="bg-white border-b border-[#e9e9e9] px-5 flex items-center gap-1 shrink-0">
        <h1 className="text-[13px] font-bold text-[#1f1f1f] pr-4 mr-2 border-r border-[#e9e9e9]">
          {project?.name || '…'}
        </h1>
        {tabs.map(tab => {
          const Icon = tab.icon;
          // Simple active check based on pathname matching
          const isActive = tab.exact
            ? typeof window !== 'undefined' && window.location.pathname === tab.href
            : typeof window !== 'undefined' && window.location.pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex items-center gap-[6px] px-4 py-[11px] text-[12px] font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-[#1f1f1f] text-[#1f1f1f]'
                  : 'border-transparent text-[#9a9a9a] hover:text-[#1f1f1f]'
              }`}>
              <Icon size={13} />{tab.label}
            </Link>
          );
        })}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <AgileBoard
            issues={issues}
            members={members}
            projectId={projectId}
            activeTimerIssueId={activeTimer?.issueId}
            onAddIssue={handleAddIssue}
            onMoveIssue={handleMoveIssue}
          />
        )}
      </div>
    </div>
  );
}
