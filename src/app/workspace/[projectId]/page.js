'use client';
// src/app/workspace/[projectId]/page.js — Board page (YouTrack-style navigation)
import { use, useCallback } from 'react';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard        from '@/components/workspace/AgileBoard';
import PortalPanel       from '@/components/workspace/PortalPanel';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { useState }      from 'react';
import Link              from 'next/link';
import { ArrowLeft, BarChart2, List, MessageSquare, Plus } from 'lucide-react';

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser } = useAppContext();
  const { issues, loading, createIssue, moveIssue } = useIssues(projectId);
  const { showToast, activeTimer } = useWorkspaceStore();
  const [portalOpen, setPortalOpen] = useState(false);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  // Portal materials
  const { stages }  = useStagesForProject(projectId);
  const materials   = stages.flatMap(s => s.materials || []);

  const handleAddIssue = useCallback(async (columnId, title) => {
    try {
      await createIssue({ title, columnId }, currentUser?.id || currentUser?.uid);
      showToast('Задачу додано ✓');
    } catch (err) {
      showToast('Помилка: ' + err.message, 'error');
    }
  }, [createIssue, currentUser, showToast]);

  const handleMoveIssue = useCallback(async (issueId, newColumnId, newIndex) => {
    try {
      await moveIssue(issueId, newColumnId, newIndex, currentUser?.id, currentUser?.name);
    } catch (err) {
      showToast(err.message || 'Помилка переміщення', 'error');
    }
  }, [moveIssue, currentUser, showToast]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-[#e9e9e9] shrink-0">
        <Link href="/workspace" className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div className="h-[14px] w-[1px] bg-[#e9e9e9]" />
        <h1 className="text-[14px] font-bold text-[#1f1f1f]">{project?.name || '...'}</h1>
        <span className="text-[11px] text-[#9a9a9a]">{issues.length} задач</span>

        <div className="ml-auto flex items-center gap-2">
          <Link href={`/workspace/${projectId}/backlog`}
            className="flex items-center gap-[6px] px-3 py-[6px] text-[11px] font-semibold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-all">
            <List size={13} /> Backlog
          </Link>
          <Link href={`/workspace/${projectId}/reports`}
            className="flex items-center gap-[6px] px-3 py-[6px] text-[11px] font-semibold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-all">
            <BarChart2 size={13} /> Reports
          </Link>
          <button onClick={() => setPortalOpen(o => !o)}
            className={`flex items-center gap-[6px] px-3 py-[6px] text-[11px] font-semibold rounded-[8px] transition-all ${
              portalOpen ? 'bg-[#6366f1] text-white' : 'text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7]'
            }`}>
            <MessageSquare size={13} /> Портал
          </button>
        </div>
      </div>

      {/* Board + Portal panel */}
      <div className="flex flex-1 overflow-hidden">
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

        {portalOpen && (
          <PortalPanel
            projectId={projectId}
            materials={materials}
            onClose={() => setPortalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
