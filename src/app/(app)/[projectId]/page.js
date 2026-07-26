'use client';
// src/app/workspace/[projectId]/page.js
// Project page: Board | Backlog | Аналітика
// Portal tab — shown only when project.visibility === 'shared' (synced to QT)
import { use, useState, useCallback, useEffect, useMemo } from 'react';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useSprints }    from '@/lib/hooks/useSprints';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard    from '@/components/workspace/AgileBoard';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import AnalyticsTab  from '@/components/workspace/AnalyticsTab';
import { EmptyState, PageHeader, Surface, Tabs } from '@/components/ui';
import ProjectTeamTab from '@/components/workspace/ProjectTeamTab';
import CreateTaskModal from '@/components/CreateTaskModal';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import { LayoutGrid, BarChart2, Plus, Users, UserPlus, MessageSquare, Settings2, List, ClipboardList, Plug, Kanban } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Link from 'next/link';
import { can } from '@/lib/utils/can';
import { useQtPlusEnabled } from '@/lib/hooks/useQtPlusEnabled';
import QtPlusProjectTab from '@/components/workspace/QtPlusProjectTab';

const TABS = (projectId) => [
  { id: 'board',      label: 'Дошка',     icon: LayoutGrid },
  { id: 'team',       label: 'Команда',   icon: Users },
  { id: 'analytics',  label: 'Аналітика', icon: BarChart2  },
];
const QTPLUS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_QTPLUS_URL);

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser, orgRole } = useAppContext();
  const { issues, issueLinks, loading: issuesLoading, createIssue, updateIssue, moveIssue } = useIssues(projectId);
  const { sprints, loading: sprintsLoading, startSprint, completeSprint } = useSprints(projectId);
  const loading = issuesLoading || sprintsLoading;
  const showToast   = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const projectSearch = useWorkspaceStore(s => s.projectSearch);

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);
  const { members: organizationMembers, inviteMember } = useOrganization();

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
  const [teamRoleFilter, setTeamRoleFilter] = useState('all');
  const [teamWorkloadFilter, setTeamWorkloadFilter] = useState('all');
  const [teamManageOpen, setTeamManageOpen] = useState(false);
  const [teamSelection, setTeamSelection] = useState([]);
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [boardView, setBoardView] = useState(() => {
    if (typeof window === 'undefined') return 'kanban';
    const stored = localStorage.getItem(`qt_project_view_${projectId}`);
    return stored === 'list' ? 'list' : 'kanban';
  });

  const canManageQtPlus = can(orgRole, 'edit:project_settings');
  const { enabled: qtEnabled } = useQtPlusEnabled(canManageQtPlus ? project?.organizationId : null);
  const qtplusLinked = Boolean(project?.qtplusLink?.projectId);
  const showQtPlusTab = QTPLUS_CONFIGURED && ((canManageQtPlus && qtEnabled) || qtplusLinked);
  const openTeamManager = () => {
    setTeamSelection(Array.isArray(project?.team) ? project.team : []);
    setTeamMemberSearch('');
    setTeamManageOpen(true);
  };

  const tabs = useMemo(() => {
    const base = TABS(projectId);
    return showQtPlusTab ? [...base, { id: 'qtplus', label: 'QuickTeam+', icon: Plug }] : base;
  }, [projectId, showQtPlusTab]);

  // If the qtplus tab was active and just became hidden (e.g. unlinked), fall back.
  useEffect(() => {
    if (activeTab === 'qtplus' && !showQtPlusTab) {
      queueMicrotask(() => setActiveTab('board'));
    }
  }, [activeTab, showQtPlusTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`qt_board_sprint_${projectId}`, boardSprintFilter);
      localStorage.setItem(`qt_board_swimlane_${projectId}`, boardSwimlane);
      localStorage.setItem(`qt_board_assignee_${projectId}`, boardAssigneeFilter);
      localStorage.setItem(`qt_board_priority_${projectId}`, boardPriorityFilter);
      localStorage.setItem(`qt_board_type_${projectId}`, boardTypeFilter);
      localStorage.setItem(`qt_project_view_${projectId}`, boardView);
    }
  }, [boardSprintFilter, boardSwimlane, boardAssigneeFilter, boardPriorityFilter, boardTypeFilter, boardView, projectId]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const activeSprints = sprints.filter(s => s.status === 'active');
  const boardIssues = issues.filter(i => {
    const normalizedSearch = projectSearch.trim().toLowerCase();
    if (normalizedSearch && ![i.issueKey, i.title, i.description]
      .some(value => String(value || '').toLowerCase().includes(normalizedSearch))) return false;
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
      throw err;
    }
  }, [createIssue, showToast]); // eslint-disable-line

  const handleMoveIssue = useCallback(async (issueId, newColumnId, newIndex, updateFields = null) => {
    // Both writes are kicked off synchronously so each paints its optimistic
    // result before the first await. Awaiting them in sequence also chained two
    // full round-trips onto a swimlane drop, which is what made the card sit
    // there for about a second before settling.
    const move = moveIssue(issueId, newColumnId, newIndex, actor);
    const fields = updateFields
      ? updateIssue(issueId, updateFields, actor)
      : Promise.resolve();

    const results = await Promise.allSettled([move, fields]);
    const failed = results.find(r => r.status === 'rejected');
    if (failed) {
      showToast(`Помилка переміщення. Відновлено попередній стан: ${failed.reason?.message || failed.reason}`, 'error');
    }
  }, [moveIssue, updateIssue, showToast]); // eslint-disable-line

  const isBoard = activeTab === 'board' && boardView === 'kanban';

  return (
    <div className={`flex-1 h-full bg-transparent ${isBoard ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden custom-scrollbar'}`}>
      <div className={`workspace-page-layout ${isBoard ? 'h-full pb-[24px]' : 'min-h-full pb-[120px]'}`}>

      {/* ── PageHeader ── */}
      <PageHeader
        variant="main"
        title={
          <div className="flex items-center gap-2">
            {project?.name}
            {isArchived && <span className="text-[10px] uppercase tracking-wider font-bold bg-[#f3f4f6] text-muted px-2 py-1 rounded-md">В архіві</span>}
          </div>
        }
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            {isShared && (
              <Link
                href={`/${projectId}/portal`}
                className={`relative flex items-center justify-center gap-[6px] w-[36px] h-[36px] p-0 sm:w-auto sm:h-auto sm:px-[14px] sm:py-[7px] rounded-[10px] text-[12px] font-semibold transition-all whitespace-nowrap bg-canvas text-muted hover:text-ink hover:bg-ink/8`}
                title="QuickTeam+"
              >
                <MessageSquare size={13} />
                <span className="hidden sm:inline">QuickTeam+</span>
                {project?.hasUnreadPortal && (
                  <span className="absolute -top-[3px] -right-[3px] w-[10px] h-[10px] rounded-full bg-[#ef4444] border-2 border-white" />
                )}
              </Link>
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
            <>
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
              <div className="ml-auto flex items-center gap-2">
                {!isArchived && boardView === 'kanban' && can(orgRole, 'edit:board_columns') && (
                  <Button
                    onClick={() => setShowConfigModal(true)}
                    icon={Settings2}
                    size="icon-lg"
                    style="secondary"
                    title="Налаштування дошки"
                  />
                )}
                <Tabs
                  tabs={[
                    { id: 'kanban', icon: Kanban },
                    { id: 'list', icon: List },
                  ]}
                  activeTab={boardView}
                  onTabChange={setBoardView}
                />
              </div>
            </>
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
          ) : activeTab === 'team' ? (
            <>
              <FilterBar>
                <Select
                  value={teamRoleFilter}
                  onChange={setTeamRoleFilter}
                  variant="ghost"
                  options={[
                    { value: 'all', label: 'Усі ролі' },
                    { value: 'owner', label: 'Власники' },
                    { value: 'admin', label: 'Адміністратори' },
                    { value: 'member', label: 'Учасники' },
                  ]}
                />
                <Select
                  value={teamWorkloadFilter}
                  onChange={setTeamWorkloadFilter}
                  variant="ghost"
                  options={[
                    { value: 'all', label: 'Усе навантаження' },
                    { value: 'assigned', label: 'Є активні завдання' },
                    { value: 'available', label: 'Без активних завдань' },
                  ]}
                />
              </FilterBar>
              {can(orgRole, 'manage:team') && (
                <Button
                  icon={UserPlus}
                  style="secondary"
                  size="md"
                  onClick={openTeamManager}
                  className="ml-auto"
                >
                  Керувати
                </Button>
              )}
            </>
          ) : null
        }
      />

      {/* ── Tab content ── */}
      {activeTab === 'board' && (
        // Only spin while there is genuinely nothing to show. Swapping a
        // populated board for the spinner unmounts it, and it comes back
        // through a blank frame — so any brief `loading` blip read as the
        // board reloading itself.
        loading && boardIssues.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : boardView === 'kanban' ? (
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
        ) : (
          <Surface variant="panel" padding="md" className="w-full">
            {boardIssues.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Завдань не знайдено"
                description="Змініть фільтри або створіть нове завдання."
                className="min-h-[328px] rounded-[12px] bg-white"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {boardIssues.map(issue => (
                  <TaskRow
                    key={issue.id}
                    issue={issue}
                    issues={issues}
                    issueLinks={issueLinks}
                    members={members}
                    sprints={sprints}
                    projectId={projectId}
                    projectName={project?.name}
                    isTimerActive={activeTimer?.issueId === issue.id}
                  />
                ))}
              </div>
            )}
          </Surface>
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
        projectContext={project ? { id: project.id, name: project.name } : null}
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
          allMembers={organizationMembers}
          issues={issues}
          projectId={projectId}
          project={project}
          canManage={can(orgRole, 'manage:team')}
          inviteMember={inviteMember}
          roleFilter={teamRoleFilter}
          workloadFilter={teamWorkloadFilter}
          manageOpen={teamManageOpen}
          onManageOpenChange={setTeamManageOpen}
          onOpenManager={openTeamManager}
          selected={teamSelection}
          onSelectedChange={setTeamSelection}
          memberSearch={teamMemberSearch}
          onMemberSearchChange={setTeamMemberSearch}
        />
      )}

      {activeTab === 'qtplus' && showQtPlusTab && (
        <QtPlusProjectTab
          project={project}
          orgRole={orgRole}
          currentUser={currentUser}
          allProjects={projects}
        />
      )}
      </div>
    </div>
  );
}
