'use client';
// src/app/workspace/my/page.js — My Tasks: Global Kanban Board & Sprints
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import AgileBoard from '@/components/workspace/AgileBoard';
import CreateTaskModal from '@/components/CreateTaskModal';
import { PageHeader, StatusVisibilityPicker, TaskListView } from '@/components/ui';
import { Plus, Settings2, List, Kanban } from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Layout/Card';
import Surface from '@/components/ui/Surface';
import FilterBar from '@/components/ui/FilterBar';
import Dialog from '@/components/ui/Dialog';
import { createIssueViaApi } from '@/lib/services/issues';



function filterTasks(tasks, filters, sprintMap) {
  const { projects, priority, type, sprint } = filters;

  return tasks.filter(t => {
    if (projects && projects.length > 0 && !projects.includes(t.projectId)) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (type !== 'all' && t.type !== type) return false;
    if (sprint !== 'all') {
      if (sprint === 'none') {
        if (t.sprintId) return false;
      } else if (sprint === 'active') {
        const s = sprintMap[t.sprintId];
        if (!s || s.status !== 'active') return false;
      } else {
        if (t.sprintId !== sprint) return false;
      }
    }
    return true;
  });
}

export default function MyTasksPage() {
  const { currentUser, projects, activeOrgId } = useAppContext();
  const { members } = useOrganization();
  const { labels, statuses, types, priorities } = useWorkflowConfig();
  const uid = currentUser?.uid || currentUser?.id;
  const { tasks, allIssues, issueLinks, loading, updateTask } = useAllMyTasks(uid);
  const { sprints, loading: sprintsLoading } = useSprints();
  const showToast = useWorkspaceStore(s => s.showToast);
  const myTaskSearch = useWorkspaceStore(s => s.myTaskSearch);
  
  const [viewMode, setViewMode] = useState('kanban'); // kanban | list
  const [filters, setFilters] = useState({
    projects: [],
    priority: 'all',
    type: 'all',
    sprint: 'all'
  });
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('qt_my_tasks_hidden')) || []; } catch(e){}
    }
    return [];
  });

  const updateHiddenColumns = (next) => {
    setHiddenColumns(next);
    localStorage.setItem('qt_my_tasks_hidden', JSON.stringify(next));
  };

  const handleMoveIssue = async (issueId, columnId, order) => {
    try {
      await updateTask(issueId, { columnId, status: columnId, order });
      showToast('Статус оновлено ✓');
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Помилка оновлення статусу', 'error');
    }
  };

  // Group sprints by status
  const sprintMap = (sprints || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const normalizedSearch = myTaskSearch.trim().toLowerCase();
  const filtered = filterTasks(tasks, filters, sprintMap).filter(t => {
    const p = projects.find(proj => proj.id === t.projectId);
    if (!p || p.status === 'archived') return false;
    if (!normalizedSearch) return true;
    return [t.issueKey, t.title, t.description, p.name]
      .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
  });

  return (
    <div className={`flex-1 h-full bg-transparent ${viewMode === 'kanban' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden hide-scrollbar'}`}>
      <div className={`workspace-page-layout ${viewMode === 'kanban' ? 'h-full pb-0' : 'min-h-full pb-[120px]'}`}>
        <PageHeader
          variant="main"
          title="Мої завдання"
          actions={
            <div className="flex gap-2">
              <Button
                onClick={() => { setCreateTaskStatus(null); setShowCreateTaskModal(true); }}
                icon={Plus}
                size="lg"
                style="primary"
                color="dark"
                collapseAt="sm"
                title="Створити завдання"
              >
                Створити завдання
              </Button>
            </div>
          }
          filters={
            <div className="flex items-center justify-between w-full">
              <FilterBar>
                <MultiSelect
                  variant="ghost"
                  value={filters.projects}
                onChange={(val) => setFilters(f => ({ ...f, projects: val }))}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Всі проєкти"
                searchPlaceholder="Пошук проєкту..."
                filterRole="project"
              />
              <Select
                filterRole="priority"
                variant="ghost"
                value={filters.priority}
                onChange={(val) => setFilters(f => ({ ...f, priority: val }))}
                options={[
                  { value: 'all', label: 'Всі пріоритети' },
                  ...priorities.map(priority => ({
                    value: priority.id,
                    label: priority.label,
                    dotColor: priority.color,
                  })),
                ]}
              />
              <Select
                filterRole="type"
                variant="ghost"
                value={filters.type}
                onChange={(val) => setFilters(f => ({ ...f, type: val }))}
                options={[
                  { value: 'all', label: 'Всі типи' },
                  ...types
                    .map(type => ({ value: type.id, label: type.label, dotColor: type.color })),
                ]}
              />
              <Select
                filterRole="sprint"
                variant="ghost"
                value={filters.sprint}
                onChange={(val) => setFilters(f => ({ ...f, sprint: val }))}
                options={[
                  { value: 'all', label: 'Всі спринти' },
                  { value: 'active', label: 'Тільки активні' },
                  { value: 'none', label: 'Без спринта (Беклог)' },
                  ...(sprints || []).map(s => ({ value: s.id, label: s.name }))
                ]}
              />
            </FilterBar>
            
            <div className="flex items-center gap-2 ml-auto">
              <Button
                onClick={() => setShowSettingsModal(true)}
                icon={Settings2}
                size="icon-lg"
                style="secondary"
                title="Налаштування видимості статусів"
              />
              <Tabs
                tabs={[
                  { id: 'kanban', icon: Kanban },
                  { id: 'list', icon: List },
                ]}
                activeTab={viewMode}
                onTabChange={setViewMode}
              />
            </div>
          </div>
          }
        />

        {/* Main Content Area */}
        <div className={viewMode === 'kanban' ? 'flex min-h-0 flex-1 flex-col' : ''}>
        {loading || sprintsLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="md" />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex min-h-[500px] flex-1 flex-col">
            <AgileBoard
              issues={filtered}
              allIssues={allIssues}
              members={members}
              projects={projects}
              projectId="my"
              sprints={sprints}
              showProjectName
              hiddenColumns={hiddenColumns}
              showHiddenLane
              onRequestAddIssue={columnId => {
                setCreateTaskStatus(columnId);
                setShowCreateTaskModal(true);
              }}
              onMoveIssue={handleMoveIssue}
              issueLinks={issueLinks}
            />
          </div>
        ) : (
          <TaskListView
            issues={filtered}
            allIssues={allIssues}
            issueLinks={issueLinks}
            members={members}
            labels={labels}
            sprints={sprints}
            projects={projects}
            showProjectName
            hiddenStatusIds={hiddenColumns}
          />
        )}
        </div>
      </div>

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => { setShowCreateTaskModal(false); setCreateTaskStatus(null); }}
        initialStatus={createTaskStatus}
        onSubmit={async (formData) => {
          if (!formData.projectId) {
            throw new Error('Будь ласка, оберіть проєкт');
          }
          await createIssueViaApi({
            organizationId: activeOrgId,
            projectId: formData.projectId,
            data: {
              title: formData.title,
              description: formData.description || '',
              status: formData.status || 'todo',
              priority: formData.priority || 'medium',
              type: formData.type || 'task',
              assigneeIds: formData.assignees || [],
              labelIds: formData.labelIds || [],
              dueDate: formData.dueDate || null,
              sprintId: formData.sprintId || null,
              reporterId: uid,
            },
          });

          showToast('Задачу створено ✓');
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
        sprints={sprints}
      />

      {showSettingsModal && (
        <Dialog
          isOpen
          onClose={() => setShowSettingsModal(false)}
          title="Налаштування видимості статусів"
          titleContext="dialog"
          size="workspace"
          presentation="sheet"
          bodyPadding="spacious"
          footer={(
            <Button
              style="primary"
              size="md"
              onClick={() => setShowSettingsModal(false)}
            >
              Готово
            </Button>
          )}
        >
          <div>
            <h3 className="ui-type-card-title mb-2 text-ink">Видимість статусів</h3>
            <p className="mb-4 text-[13px] text-muted">
              На дошці та у режимі «Списком» завдання прихованих статусів
              збираються в окрему секцію «Приховані».
            </p>
            <StatusVisibilityPicker
              statuses={statuses}
              hiddenStatusIds={hiddenColumns}
              onChange={updateHiddenColumns}
              backlogStatusId={null}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
