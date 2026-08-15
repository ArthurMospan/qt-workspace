'use client';
// src/app/workspace/[projectId]/page.js
// Project page: Board | Backlog | Аналітика
// Portal tab — shown only when project.visibility === 'shared' (synced to QT)
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext }  from '@/lib/context/AppContext';
import { useIssues }     from '@/lib/hooks/useIssues';
import { useSprints }    from '@/lib/hooks/useSprints';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import AgileBoard    from '@/components/workspace/AgileBoard';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import AnalyticsTab  from '@/components/workspace/AnalyticsTab';
import { PageHeader, Pill, TaskListView, Tabs } from '@/components/ui';
import CreateTaskModal from '@/components/CreateTaskModal';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import { LayoutGrid, BarChart2, Plus, Settings2, List, Plug, Kanban } from 'lucide-react';
import { ChatIcon } from '@/lib/design/icons';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Link from 'next/link';
import { can } from '@/lib/utils/can';
import { useQtPlusEnabled } from '@/lib/hooks/useQtPlusEnabled';
import QtPlusProjectTab from '@/components/workspace/QtPlusProjectTab';
import { archiveProject, deleteProject, restoreProject } from '@/lib/services/projects';
import { userFacingErrorMessage } from '@/lib/utils/errors';
import { usePublishLocalSearchResults } from '@/lib/hooks/usePublishLocalSearchResults';
import { taskTypeSelectOption } from '@/lib/design/taskTypeIcons';
import { NO_PRIORITY_ID, prioritySelectOptions } from '@/lib/utils/priorities.mjs';
import { useBulkIssueActions } from '@/lib/hooks/useBulkIssueActions';

const PROJECT_TABS = [
  { id: 'board',      label: 'Дошка',     icon: LayoutGrid },
  { id: 'analytics',  label: 'Аналітика', icon: BarChart2  },
];
const QTPLUS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_QTPLUS_URL);

export default function ProjectBoardClient({ projectId, resourceOrganizationId }) {
  const {
    projects,
    projectsLoading,
    currentUser,
    activeOrgId,
    orgRole,
    switchOrg,
  } = useAppContext();
  const resourceContextReady = !resourceOrganizationId || activeOrgId === resourceOrganizationId;
  const scopedProjectId = resourceContextReady ? projectId : null;
  const {
    issues: sourceIssues,
    issueLinks,
    loading: issuesLoading,
    createIssue,
    updateIssue,
    moveIssue,
  } = useIssues(scopedProjectId);
  const {
    sprints,
    loading: sprintsLoading,
    startSprint,
    completeSprint,
  } = useSprints(projectId);
  const loading = issuesLoading || sprintsLoading;
  const router      = useRouter();
  const showToast   = useWorkspaceStore(s => s.showToast);
  const activeTimer = useWorkspaceStore(s => s.activeTimer);
  const projectSearch = useWorkspaceStore(s => s.projectSearch);
  const resolveBulkStatusId = useCallback((issue, value) => (
    value?.mode === 'status' ? value.id : null
  ), []);
  const { issues, applyBulkAction } = useBulkIssueActions({
    issues: sourceIssues,
    organizationId: activeOrgId,
    showToast,
    resolveStatusId: resolveBulkStatusId,
  });

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);
  const { members: organizationMembers } = useOrganization();
  const { labels, priorities, types } = useWorkflowConfig();

  // Portal tab visible only when project is shared (synced to QT)
  const isShared = project?.visibility === 'shared';
  const isArchived = project?.status === 'archived';

  const [activeTab, setActiveTab] = useState('board');
  const [boardSprintFilter, setBoardSprintFilter] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`qt_board_sprint_${projectId}`) || 'all';
    return 'all';
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
  const [boardView, setBoardView] = useState(() => {
    if (typeof window === 'undefined') return 'kanban';
    const stored = localStorage.getItem(`qt_project_view_${projectId}`);
    return stored === 'list' ? 'list' : 'kanban';
  });

  const canManageQtPlus = can(orgRole, 'edit:project_settings');
  const { enabled: qtEnabled } = useQtPlusEnabled(canManageQtPlus ? project?.organizationId : null);
  const qtplusLinked = Boolean(project?.qtplusLink?.projectId);
  const showQtPlusTab = QTPLUS_CONFIGURED && ((canManageQtPlus && qtEnabled) || qtplusLinked);
  const tabs = useMemo(() => {
    return showQtPlusTab
      ? [...PROJECT_TABS, { id: 'qtplus', label: 'QuickTeam+', icon: Plug }]
      : PROJECT_TABS;
  }, [showQtPlusTab]);

  useEffect(() => {
    if (resourceOrganizationId && resourceOrganizationId !== activeOrgId) {
      switchOrg(resourceOrganizationId);
    }
  }, [activeOrgId, resourceOrganizationId, switchOrg]);

  // If the qtplus tab was active and just became hidden (e.g. unlinked), fall back.
  useEffect(() => {
    if (activeTab === 'qtplus' && !showQtPlusTab) {
      queueMicrotask(() => setActiveTab('board'));
    }
  }, [activeTab, showQtPlusTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`qt_board_sprint_${projectId}`, boardSprintFilter);
      localStorage.setItem(`qt_board_assignee_${projectId}`, boardAssigneeFilter);
      localStorage.setItem(`qt_board_priority_${projectId}`, boardPriorityFilter);
      localStorage.setItem(`qt_board_type_${projectId}`, boardTypeFilter);
      localStorage.setItem(`qt_project_view_${projectId}`, boardView);
    }
  }, [boardSprintFilter, boardAssigneeFilter, boardPriorityFilter, boardTypeFilter, boardView, projectId]);
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
    if (boardPriorityFilter !== 'all' && (i.priority || NO_PRIORITY_ID) !== boardPriorityFilter) return false;
    // Type
    if (boardTypeFilter !== 'all' && i.type !== boardTypeFilter) return false;

    return true;
  });
  const selectionScopeKey = [
    projectId,
    projectSearch,
    boardSprintFilter,
    boardAssigneeFilter,
    boardPriorityFilter,
    boardTypeFilter,
  ].join('|');
  usePublishLocalSearchResults(projectSearch, boardIssues.length);

  const actor = {
    userId:   currentUser?.id   || currentUser?.uid,
    userName: currentUser?.name || '',
  };

  const handleAddIssue = useCallback(async (columnId, title) => {
    try {
      const data = { title, columnId };

      await createIssue(data, actor);
      showToast('Задачу додано ✓');
    } catch (err) {
      showToast('Помилка: ' + err.message, 'error');
    }
  }, [createIssue, showToast]); // eslint-disable-line

  // Archiving or deleting the project you are standing in has to leave it —
  // the projects list does not, because it stays on the list either way.
  const handleArchiveProject = useCallback(async (id) => {
    try {
      await archiveProject(id);
      showToast('Проєкт архівовано', 'success');
      router.push('/');
      return true;
    } catch (error) {
      showToast(userFacingErrorMessage(error, 'Не вдалося архівувати проєкт'), 'error');
      return false;
    }
  }, [router, showToast]);

  const handleRestoreProject = useCallback(async (id) => {
    try {
      await restoreProject(id);
      showToast('Проєкт розархівовано');
      return true;
    } catch (error) {
      showToast(userFacingErrorMessage(error, 'Не вдалося розархівувати проєкт'), 'error');
      return false;
    }
  }, [showToast]);

  const handleDeleteProject = useCallback(async (id) => {
    await deleteProject(id);
    showToast('Проєкт видалено');
    router.push('/');
  }, [router, showToast]);

  const handleCreateFullIssue = useCallback(async (formData) => {
    const created = await createIssue({
      title: formData.title,
      description: formData.description || '',
      columnId: formData.status || 'backlog',
      priority: formData.priority || 'medium',
      type: formData.type || 'task',
      assigneeIds: formData.assignees || [],
      labelIds: formData.labelIds || [],
      dueDate: formData.dueDate,
      estimateMinutes: formData.estimateMinutes || 0,
      sprintId: formData.sprintId || null,
    }, actor);
    showToast('Задачу створено ✓');
    return { ...created, projectId };
  }, [createIssue, showToast]); // eslint-disable-line

  const handleMoveIssue = useCallback(async (issueId, newColumnId, position, updateFields = null) => {
    // Both writes are kicked off synchronously so each paints its optimistic
    // result before the first await. Awaiting them in sequence also chained two
    // full round-trips onto a swimlane drop, which is what made the card sit
    // there for about a second before settling.
    const move = moveIssue(issueId, newColumnId, position, actor);
    const fields = updateFields
      ? updateIssue(issueId, updateFields, actor)
      : Promise.resolve();

    const results = await Promise.allSettled([move, fields]);
    const failed = results.find(r => r.status === 'rejected');
    if (failed) {
      showToast(`Помилка переміщення. Відновлено попередній стан: ${failed.reason?.message || failed.reason}`, 'error');
    }
  }, [moveIssue, updateIssue, showToast]); // eslint-disable-line

  const handleBulkUpdate = useCallback(async (action, value, selectedIssues) => {
    await applyBulkAction(action, value, selectedIssues);
  }, [applyBulkAction]);

  const isBoard = activeTab === 'board' && boardView === 'kanban';
  const isQtPlusWorkspace = activeTab === 'qtplus' && showQtPlusTab;

  if (!resourceContextReady || projectsLoading) {
    return (
      <div role="status" aria-busy="true" className="flex min-h-[320px] flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
        <span className="sr-only">Завантаження проєкту…</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center p-6">
        <div data-ui-surface="local" className="w-full max-w-[420px] rounded-[20px] border border-line bg-white p-6 text-center shadow-sm">
          <h1 className="ui-type-section-title mb-2 text-ink">Проєкт не знайдено</h1>
          <p className="mb-5 text-[13px] text-muted">
            Проєкт видалено або у вас більше немає до нього доступу.
          </p>
          <Button onClick={() => router.replace('/')} size="lg" composition="workspace-guard">
            На головну
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 h-full bg-transparent ${
      isBoard
        ? 'overflow-hidden'
        : isQtPlusWorkspace
          ? 'overflow-y-auto overflow-x-hidden custom-scrollbar lg:overflow-hidden'
          : 'overflow-y-auto overflow-x-hidden custom-scrollbar'
    }`}>
      <div className={`workspace-page-layout ${
        isBoard
          ? 'h-full pb-0'
          : isQtPlusWorkspace
            ? 'min-h-full pb-[120px] lg:h-full lg:min-h-0 lg:pb-0'
            : 'min-h-full pb-[120px]'
      }`}>

      {/* ── PageHeader ── */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            {project?.name}
            {isArchived && <Pill tone="neutral" size="lg" shape="badge" uppercase>В архіві</Pill>}
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
                <ChatIcon size={13} />
                <span className="hidden sm:inline">QuickTeam+</span>
                {project?.hasUnreadPortal && (
                  <span className="absolute -top-[3px] -right-[3px] w-[10px] h-[10px] rounded-full bg-[#ef4444] border-2 border-white" />
                )}
              </Link>
            )}
            {!isArchived && can(orgRole, 'edit:project_settings') && (
              <Button
                onClick={() => setShowConfigModal(true)}
                icon={Settings2}
                size="icon-lg"
                style="secondary"
                title="Налаштування проєкту"
                aria-label="Налаштування проєкту"
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
            <>
              <FilterBar>
                <Select
                  filterRole="sprint"
                  ariaLabel="Фільтр за спринтом"
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
                  filterRole="member"
                  ariaLabel="Фільтр за виконавцем"
                  value={boardAssigneeFilter}
                  onChange={setBoardAssigneeFilter}
                  options={[
                    { value: 'all', label: 'Всі виконавці' },
                    ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email, user: m }))
                  ]}
                  variant="ghost"
                />
                <Select
                  filterRole="priority"
                  ariaLabel="Фільтр за пріоритетом"
                  value={boardPriorityFilter}
                  onChange={setBoardPriorityFilter}
                  options={[
                    { value: 'all', label: 'Всі пріоритети' },
                    ...prioritySelectOptions(priorities),
                  ]}
                  variant="ghost"
                />
                <Select
                  filterRole="type"
                  ariaLabel="Фільтр за типом завдання"
                  value={boardTypeFilter}
                  onChange={setBoardTypeFilter}
                  options={[
                    { value: 'all', label: 'Всі типи' },
                    ...types.map(taskTypeSelectOption),
                  ]}
                  variant="ghost"
                />
              </FilterBar>
              <div className="ml-auto flex items-center gap-2">
                <Tabs
                  tabs={[
                    { id: 'kanban', icon: Kanban, title: 'Дошка', ariaLabel: 'Дошка' },
                    { id: 'list', icon: List, title: 'Список', ariaLabel: 'Список' },
                  ]}
                  activeTab={boardView}
                  onTabChange={setBoardView}
                />
              </div>
            </>
          ) : activeTab === 'analytics' ? (
            <FilterBar>
              <Select
                filterRole="priority"
                variant="ghost"
                value={analyticsPriorityFilter}
                onChange={setAnalyticsPriorityFilter}
                options={[
                  { value: 'all', label: 'Всі пріоритети' },
                  ...prioritySelectOptions(priorities),
                ]}
              />
              <Select
                filterRole="type"
                variant="ghost"
                value={analyticsTypeFilter}
                onChange={setAnalyticsTypeFilter}
                options={[
                  { value: 'all', label: 'Всі типи' },
                  ...types.map(taskTypeSelectOption),
                ]}
              />
            </FilterBar>
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
          <div role="status" aria-busy="true" className="flex min-h-[320px] flex-1 items-center justify-center">
            <LoadingSpinner size="md" />
            <span className="sr-only">Завантаження…</span>
          </div>
        ) : boardView === 'kanban' ? (
          <div className="flex-1 min-h-[500px] flex flex-col">
            <AgileBoard
              issues={boardIssues}
              allIssues={issues}
              members={members}
              projectId={projectId}
              project={project}
              activeTimerIssueId={activeTimer?.issueId}
              onAddIssue={handleAddIssue}
              onMoveIssue={handleMoveIssue}
              onBulkUpdate={handleBulkUpdate}
              issueLinks={issueLinks}
              sprints={sprints}
              isArchived={isArchived}
              canArchive={can(orgRole, 'delete:issue')}
              selectionScopeKey={selectionScopeKey}
            />
          </div>
        ) : (
          <TaskListView
            issues={boardIssues}
            allIssues={issues}
            issueLinks={issueLinks}
            members={members}
            labels={labels}
            sprints={sprints}
            projectId={projectId}
            projectName={project?.name}
            hiddenGroupIds={project?.hiddenColumns || []}
            activeTimerIssueId={activeTimer?.issueId}
            onBulkUpdate={handleBulkUpdate}
            canArchive={can(orgRole, 'delete:issue')}
            selectionScopeKey={selectionScopeKey}
          />
        )
      )}


      {showConfigModal && project && (
        // The kebab on the projects list opened this same dialog with archive,
        // delete and invites; opening it from inside the project left all three
        // out, so the same "Налаштування проєкту" showed two different things
        // depending on where you clicked. One dialog, one set of capabilities.
        <BoardConfigModal
          project={project}
          issues={issues}
          organizationMembers={organizationMembers}
          canManageTeam={can(orgRole, 'manage:team')}
          canInvite={can(orgRole, 'manage:team')}
          onArchive={handleArchiveProject}
          onUnarchive={handleRestoreProject}
          onDelete={handleDeleteProject}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSubmit={handleCreateFullIssue}
        stages={project?.stages || []}
        teamMembers={members}
        projectContext={project ? {
          id: project.id,
          name: project.name,
          hiddenColumns: project.hiddenColumns || [],
        } : null}
        sprints={sprints}
      />
      {activeTab === 'analytics' && (
        <AnalyticsTab
          issues={issues}
          members={members}
          project={project}
          projectId={projectId}
          issueLinks={issueLinks}
          priorityFilter={analyticsPriorityFilter}
          typeFilter={analyticsTypeFilter}
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
