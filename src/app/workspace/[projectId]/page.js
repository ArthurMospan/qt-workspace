'use client';
// src/app/workspace/[projectId]/page.js
// Project page: Board | Backlog | Аналітика
// Portal tab — shown only when project.visibility === 'shared' (synced to QT)
import { use, useState, useCallback } from 'react';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useSprints }    from '@/lib/hooks/useSprints';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard    from '@/components/workspace/AgileBoard';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import AnalyticsTab  from '@/components/workspace/AnalyticsTab';
import ProjectTabBar from '@/components/workspace/ProjectTabBar';
import ProjectTeamTab from '@/components/workspace/ProjectTeamTab';
import CreateTaskModal from '@/components/CreateTaskModal';
import { LayoutGrid, BarChart2, Plus, Users } from 'lucide-react';
import { can } from '@/lib/utils/can';

const TABS = [
  { id: 'board',      label: 'Дошка',     icon: LayoutGrid },
  { id: 'team',       label: 'Команда',   icon: Users },
  { id: 'analytics',  label: 'Аналітика', icon: BarChart2  },
];

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser, orgRole } = useAppContext();
  const { issues, loading: issuesLoading, createIssue, updateIssue, moveIssue } = useIssues(projectId);
  const { sprints, loading: sprintsLoading, startSprint, completeSprint } = useSprints(projectId);
  const loading = issuesLoading || sprintsLoading;
  const showToast   = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  // Portal tab visible only when project is shared (synced to QT)
  const isShared = project?.visibility === 'shared';

  const [activeTab, setActiveTab] = useState('board');
  const [boardSprintFilter, setBoardSprintFilter] = useState('active');
  const [boardSwimlane, setBoardSwimlane] = useState('none');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const activeSprints = sprints.filter(s => s.status === 'active');
  const boardIssues = issues.filter(i => {
    if (boardSprintFilter === 'all') return true;
    if (boardSprintFilter === 'active') {
      if (activeSprints.length === 0) return true; // if no active sprint, show all
      return activeSprints.some(s => s.id === i.sprintId);
    }
    return i.sprintId === boardSprintFilter;
  });

  const actor = {
    userId:   currentUser?.id   || currentUser?.uid,
    userName: currentUser?.name || '',
  };

  const handleAddIssue = useCallback(async (columnId, title, laneId = null) => {
    try {
      const data = { title, columnId };

      // Apply lane context if swimlanes are active
      if (laneId) {
        if (laneId.startsWith('assignee-')) {
          const uid = laneId.replace('assignee-', '');
          if (uid !== 'unassigned') {
            data.assigneeIds = [uid];
          }
        } else if (laneId.startsWith('epic-')) {
          const epicId = laneId.replace('epic-', '');
          if (epicId !== 'none') {
            data.parentEpicId = epicId;
          }
        } else if (laneId.startsWith('priority-')) {
          const priority = laneId.replace('priority-', '');
          data.priority = priority;
        }
      }

      await createIssue(data, actor);
      showToast('Задачу додано ✓');
    } catch (err) {
      showToast('Помилка: ' + err.message, 'error');
    }
  }, [createIssue, showToast]); // eslint-disable-line

  const handleCreateFullIssue = useCallback(async (formData) => {
    try {
      await createIssue({
        title: formData.title,
        description: formData.description || '',
        columnId: formData.status || 'todo',
        priority: formData.priority || 'medium',
        type: formData.type || 'task',
        assigneeIds: formData.assignees || [],
        dueDate: formData.dueDate || null,
        labelIds: formData.labelIds || []
      }, actor);
      showToast('Задачу створено ✓');
    } catch (err) {
      showToast('Помилка: ' + err.message, 'error');
    }
  }, [createIssue, showToast]); // eslint-disable-line

  const handleMoveIssue = useCallback(async (issueId, newColumnId, newIndex, updateFields = null) => {
    try {
      if (updateFields) {
        await updateIssue(issueId, updateFields, actor);
      }
      await moveIssue(issueId, newColumnId, newIndex, actor);
    } catch (err) {
      showToast(err.message || 'Помилка', 'error');
    }
  }, [moveIssue, updateIssue, showToast]); // eslint-disable-line

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">

      {/* ── Project tab bar ── */}
      <ProjectTabBar
        projectId={projectId}
        projectName={project?.name}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showPortal={isShared}
        showPortalIndicator={project?.hasUnreadPortal || false}
        onCreateTask={() => setShowCreateTaskModal(true)}
        onConfig={can(orgRole, 'edit:board_columns') ? () => setShowConfigModal(true) : undefined}
      />

      {/* ── Tab content ── */}
      {activeTab === 'board' && (
        loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden px-[20px] pt-[16px] pb-[20px] flex flex-col bg-white">


            <div className="flex-1 min-h-0 overflow-hidden">
              <AgileBoard
                issues={boardIssues}
                members={members}
                projectId={projectId}
                project={project}
                activeTimerIssueId={activeTimer?.issueId}
                swimlane={boardSwimlane}
                onAddIssue={handleAddIssue}
                onMoveIssue={handleMoveIssue}
              />
            </div>
          </div>
        )
      )}

      {showConfigModal && project && (
        <BoardConfigModal project={project} onClose={() => setShowConfigModal(false)} />
      )}

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSubmit={handleCreateFullIssue}
        stages={project?.stages || []}
        teamMembers={members}
      />

      {activeTab === 'analytics' && (
        <AnalyticsTab
          issues={issues}
          members={members}
          project={project}
          projectId={projectId}
        />
      )}

      {activeTab === 'team' && (
        <ProjectTeamTab members={members} />
      )}
    </div>
  );
}
