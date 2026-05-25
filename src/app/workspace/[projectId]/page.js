'use client';
// src/app/workspace/[projectId]/page.js
// Project page: Board | Backlog | Аналітика | Матеріали — all client-side tabs
import { use, useState, useCallback } from 'react';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard    from '@/components/workspace/AgileBoard';
import BacklogTab    from '@/components/workspace/BacklogTab';
import AnalyticsTab  from '@/components/workspace/AnalyticsTab';
import MaterialsTab  from '@/components/workspace/MaterialsTab';
import { LayoutGrid, List, BarChart2, Image } from 'lucide-react';

const TABS = [
  { id: 'board',     label: 'Дошка',     icon: LayoutGrid },
  { id: 'backlog',   label: 'Backlog',   icon: List },
  { id: 'analytics', label: 'Аналітика', icon: BarChart2 },
  { id: 'materials', label: 'Матеріали', icon: Image },
];

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser } = useAppContext();
  const { issues, loading, createIssue, moveIssue } = useIssues(projectId);
  const showToast  = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const [activeTab, setActiveTab] = useState('board');

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
  }, [createIssue, showToast]); // eslint-disable-line

  const handleMoveIssue = useCallback(async (issueId, newColumnId, newIndex) => {
    try {
      await moveIssue(issueId, newColumnId, newIndex, actor);
    } catch (err) {
      showToast(err.message || 'Помилка', 'error');
    }
  }, [moveIssue, showToast]); // eslint-disable-line

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">

      {/* ── Project tab bar ──────────────────────────────── */}
      <div className="bg-white border-b border-[#e9e9e9] flex items-center gap-0 px-5 shrink-0">
        <h1 className="text-[13px] font-bold text-[#1f1f1f] pr-5 mr-1 border-r border-[#e9e9e9] py-[11px] truncate max-w-[160px]">
          {project?.name || '…'}
        </h1>

        {TABS.map(tab => {
          const Icon   = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-[6px] px-5 py-[11px] text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap ${
                active
                  ? 'border-[#1f1f1f] text-[#1f1f1f]'
                  : 'border-transparent text-[#9a9a9a] hover:text-[#4a4a4a]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      {activeTab === 'board' && (
        loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden p-4">
            <AgileBoard
              issues={issues}
              members={members}
              projectId={projectId}
              activeTimerIssueId={activeTimer?.issueId}
              onAddIssue={handleAddIssue}
              onMoveIssue={handleMoveIssue}
            />
          </div>
        )
      )}

      {activeTab === 'backlog' && (
        <BacklogTab
          issues={issues}
          loading={loading}
          projectId={projectId}
          members={members}
          onAddIssue={handleAddIssue}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          issues={issues}
          members={members}
          project={project}
          projectId={projectId}
        />
      )}

      {activeTab === 'materials' && (
        <MaterialsTab projectId={projectId} />
      )}
    </div>
  );
}
