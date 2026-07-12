'use client';
// src/app/workspace/[projectId]/page.js
// Project page: Board | Backlog | Аналітика
// Portal tab — shown only when project.visibility === 'shared' (synced to QT)
import { use, useState, useCallback, useEffect } from 'react';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useSprints }    from '@/lib/hooks/useSprints';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard    from '@/components/workspace/AgileBoard';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import AnalyticsTab  from '@/components/workspace/AnalyticsTab';
import { PageHeader } from '@/components/ui';
import ProjectTeamTab from '@/components/workspace/ProjectTeamTab';
import CreateTaskModal from '@/components/CreateTaskModal';
import { LayoutGrid, BarChart2, Plus, Users, MessageSquare, Settings2, Filter, Layers } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Link from 'next/link';
import { can } from '@/lib/utils/can';

const TABS = (projectId) => [
  { id: 'board',      label: 'Дошка',     icon: LayoutGrid },
  { id: 'team',       label: 'Команда',   icon: Users },
  { id: 'analytics',  label: 'Аналітика', icon: BarChart2  },
];

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser, orgRole } = useAppContext();
  const { issues, issueLinks, loading: issuesLoading, createIssue, updateIssue, moveIssue } = useIssues(projectId);
  const { sprints, loading: sprintsLoading, startSprint, completeSprint } = useSprints(projectId);
  const loading = issuesLoading || sprintsLoading;
  const showToast   = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  // Portal tab visible only when project is shared (synced to QT)
  const isShared = project?.visibility === 'shared';
  const isArchived = project?.status === 'archived';

  const [activeTab, setActiveTab] = useState('board');
  const [boardSprintFilter, setBoardSprintFilter] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`qt_board_sprint_${projectId}`) || 'all';
    return 'all';
  });
  const [boardSwimlane, setBoardSwimlane] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`qt_board_swimlane_${projectId}`) || 'none';
    return 'none';
  });
  const [boardAssigneeFilter, setBoardAssigneeFilter] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`qt_board_assignee_${projectId}`) || 'all';
    return 'all';
  });
  const [boardPriorityFilter, setBoardPriorityFilter] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`qt_board_priority_${projectId}`) || 'all';
    return 'all';
  });
  const [boardTypeFilter, setBoardTypeFilter] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`qt_board_type_${projectId}`) || 'all';
    return 'all';
  });
  const [analyticsPriorityFilter, setAnalyticsPriorityFilter] = useState('all');
  const [analyticsTypeFilter, setAnalyticsTypeFilter] = useState('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`qt_board_sprint_${projectId}`, boardSprintFilter);
      localStorage.setItem(`qt_board_swimlane_${projectId}`, boardSwimlane);
      localStorage.setItem(`qt_board_assignee_${projectId}`, boardAssigneeFilter);
      localStorage.setItem(`qt_board_priority_${projectId}`, boardPriorityFilter);
      localStorage.setItem(`qt_board_type_${projectId}`, boardTypeFilter);
    }
  }, [boardSprintFilter, boardSwimlane, boardAssigneeFilter, boardPriorityFilter, boardTypeFilter, projectId]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const activeSprints = sprints.filter(s => s.status === 'active');
  const boardIssues = issues.filter(i => {
    // Sprint
    if (boardSprintFilter !== 'all') {
      if (boardSprintFilter === 'active') {
        if (activeSprints.length > 0 && !activeSprints.some(s => s.id === i.sprintId)) return false;
      } else {
        if (i.sprintId !== boardSprintFilter) return false;
      }
    }
    // Assignee
    if (boardAssigneeFilter !== 'all') {
      if (!i.assigneeIds || !i.assigneeIds.includes(boardAssigneeFilter)) return false;
    }
    // Priority
    if (boardPriorityFilter !== 'all' && i.priority !== boardPriorityFilter) return false;
    // Type
    if (boardTypeFilter !== 'all' && i.type !== boardTypeFilter) return false;

    return true;
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
        labelIds: formData.labelIds || [],
        dueDate: formData.dueDate,
        parentEpicId: formData.parentEpicId || null,
        estimateMinutes: formData.estimateMinutes || 0,
        sprintId: formData.sprintId || null,
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
      showToast(`Помилка переміщення. Відновлено попередній стан: ${err.message}`, 'error');
    }
  }, [moveIssue, updateIssue, showToast]); // eslint-disable-line

  const isBoard = activeTab === 'board';

  return (
    <div className={`flex-1 h-full bg-transparent ${isBoard ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden custom-scrollbar'}`}>
      <div className={`w-full flex flex-col gap-2 page-gutter pt-[56px] ${isBoard ? 'h-full pb-[24px]' : 'min-h-full pb-[120px]'}`}>

      {/* ── PageHeader ── */}
      <PageHeader
        variant="main"
        title={
          <div className="flex items-center gap-2">
            {project?.name}
            {isArchived && <span className="text-[10px] uppercase tracking-wider font-bold bg-[#f3f4f6] text-muted px-2 py-1 rounded-md">В архіві</span>}
          </div>
        }
        tabs={TABS(projectId)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            {isShared && (
              <Link
                href={`/workspace/${projectId}/portal`}
                className={`relative flex items-center justify-center gap-[6px] w-[36px] h-[36px] p-0 sm:w-auto sm:h-auto sm:px-[14px] sm:py-[7px] rounded-[10px] text-[12px] font-semibold transition-all whitespace-nowrap bg-canvas text-muted hover:text-[#6366f1] hover:bg-[#6366f1]/8`}
                title="QuickTeam+"
              >
                <MessageSquare size={13} />
                <span className="hidden sm:inline">QuickTeam+</span>
                {project?.hasUnreadPortal && (
                  <span className="absolute -top-[3px] -right-[3px] w-[10px] h-[10px] rounded-full bg-[#ef4444] border-2 border-white" />
                )}
              </Link>
            )}
            {!isArchived && can(orgRole, 'edit:board_columns') && (
              <Button
                onClick={() => setShowConfigModal(true)}
                icon={Settings2}
                size="icon-lg"
                style="secondary"
                title="Налаштування дошки"
              />
            )}
            {!isArchived && (
              <Button
                onClick={() => setShowCreateTaskModal(true)}
                style="primary"
                size="lg"
                icon={Plus}
                collapseAt="sm"
                title="Створити завдання"
              >
                Створити завдання
              </Button>
            )}
          </>
        }
        filters={
          activeTab === 'board' ? (
            <FilterBar>
              <Select
                value={boardSprintFilter}
                  onChange={setBoardSprintFilter}
                  options={[
                    { value: 'all', label: 'Всі спринти' },
                    { value: 'active', label: 'Активний спринт' },
                    ...sprints.map(s => ({ value: s.id, label: s.name }))
                  ]}
                  variant="ghost"
                />
                <Select
                  value={boardSwimlane}
                  onChange={setBoardSwimlane}
                  options={[
                    { value: 'none', label: 'Без групування' },
                    { value: 'assignee', label: 'За виконавцем' },
                    { value: 'epic', label: 'За епіком' },
                    { value: 'priority', label: 'За пріоритетом' }
                  ]}
                  variant="ghost"
                  icon={LayoutGrid}
                />
                <Select
                  value={boardAssigneeFilter}
                  onChange={setBoardAssigneeFilter}
                  options={[
                    { value: 'all', label: 'Всі виконавці' },
                    ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email }))
                  ]}
                  variant="ghost"
                  icon={Users}
                />
                <Select
                  value={boardPriorityFilter}
                  onChange={setBoardPriorityFilter}
                  options={[
                    { value: 'all', label: 'Всі пріоритети' },
                    { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                    { value: 'high', label: 'High', dotColor: '#f97316' },
                    { value: 'medium', label: 'Medium', dotColor: '#eab308' },
                    { value: 'low', label: 'Low', dotColor: '#9a9a9a' },
                  ]}
                  variant="ghost"
                />
                <Select
                  value={boardTypeFilter}
                  onChange={setBoardTypeFilter}
                  options={[
                    { value: 'all', label: 'Всі типи' },
                    { value: 'epic', label: 'Epic' },
                    { value: 'feature', label: 'Feature' },
                    { value: 'task', label: 'Task' },
                    { value: 'bug', label: 'Bug' },
                  ]}
                  variant="ghost"
                />
              </FilterBar>
          ) : activeTab === 'analytics' ? (
            <FilterBar>
              <Select
                variant="ghost"
                value={analyticsPriorityFilter}
                onChange={setAnalyticsPriorityFilter}
                options={[
                  { value: 'all', label: 'Всі пріоритети' },
                  { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                  { value: 'high', label: 'High', dotColor: '#f97316' },
                  { value: 'medium', label: 'Medium', dotColor: '#eab308' },
                  { value: 'low', label: 'Low', dotColor: '#9a9a9a' }
                ]}
              />
              <Select
                variant="ghost"
                value={analyticsTypeFilter}
                onChange={setAnalyticsTypeFilter}
                options={[
                  { value: 'all', label: 'Всі типи' },
                  { value: 'epic', label: 'Epic' },
                  { value: 'feature', label: 'Feature' },
                  { value: 'task', label: 'Task' },
                  { value: 'bug', label: 'Bug' }
                ]}
              />
            </FilterBar>
          ) : null
        }
      />

      {/* ── Tab content ── */}
      {activeTab === 'board' && (
        loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-[500px] flex flex-col">

              <AgileBoard
                issues={boardIssues}
                members={members}
                projectId={projectId}
                project={project}
                activeTimerIssueId={activeTimer?.issueId}
                swimlane={boardSwimlane}
                onAddIssue={handleAddIssue}
                onMoveIssue={handleMoveIssue}
                issueLinks={issueLinks}
                isArchived={isArchived}
              />
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
        epics={issues.filter(i => i.type === 'epic')}
        sprints={sprints}
      />
      {activeTab === 'analytics' && (
        <AnalyticsTab
          issues={issues}
          members={members}
          project={project}
          projectId={projectId}
          priorityFilter={analyticsPriorityFilter}
          typeFilter={analyticsTypeFilter}
        />
      )}

      {activeTab === 'team' && (
        <ProjectTeamTab
          members={members}
          issues={issues}
          projectId={projectId}
        />
      )}
      </div>
    </div>
  );
}
