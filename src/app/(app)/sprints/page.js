'use client';
// src/app/workspace/sprints/page.js — Global Sprints & Planning styled like Project page
import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import CreateTaskModal from '@/components/CreateTaskModal';
import IssueModal from '@/components/workspace/IssueModal';
import { BulkActionBar, ContextMenu, Counter, DatePicker, FormGroup, PageHeader, useConfirm, Dialog, Input, Textarea, StatusPill } from '@/components/ui';
import { can } from '@/lib/utils/can';
import { createIssueViaApi } from '@/lib/services/issues';
import { useLocalization } from '@/lib/hooks/useLocalization';
import {
  Plus, Play, Check, Trash2, Edit2, Calendar,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  AlertCircle, CheckSquare, Filter, MoreHorizontal
} from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Surface from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { fromDateInput, toLocalDateInput } from '@/lib/utils/date';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePublishLocalSearchResults } from '@/lib/hooks/usePublishLocalSearchResults';
import { taskTypeSelectOption } from '@/lib/design/taskTypeIcons';
import { NO_PRIORITY_ID, prioritySelectOptions } from '@/lib/utils/priorities.mjs';
import {
  createUkrainianDndAnnouncements,
  UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS,
} from '@/lib/utils/dndAnnouncements.mjs';
import { plural } from '@/lib/utils/plural.mjs';
import { useBulkIssueActions } from '@/lib/hooks/useBulkIssueActions';
import { resolveCategoryStatusId } from '@/lib/utils/statusCategories.mjs';
import { useIssueSelection } from '@/lib/hooks/useIssueSelection';

function SprintEditModal({ sprint, onClose, onSave }) {
  const [name, setName] = useState(sprint.name || '');
  const [goal, setGoal] = useState(sprint.goal || '');
  const [startDate, setStartDate] = useState(() => toLocalDateInput(sprint.startDate));
  const [endDate, setEndDate] = useState(() => toLocalDateInput(sprint.endDate));

  const [nameError, setNameError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Вкажіть назву спринта');
      return;
    }
    onSave({
      name,
      goal,
      startDate: fromDateInput(startDate),
      endDate: fromDateInput(endDate, { endOfDay: true })
    });
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Редагувати спринт"
      size="sm"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">Скасувати</Button>
          <Button style="primary" size="md" type="submit" form="sprint-edit-form">Зберегти</Button>
        </>
      }
    >
        <form id="sprint-edit-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Назва спринта" required error={nameError}>
            <Input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (nameError) setNameError(''); }}
              error={Boolean(nameError)}
            />
          </FormGroup>
          <FormGroup label="Ціль спринта">
            <Textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2} />
          </FormGroup>
          <div className="flex gap-4">
            <FormGroup label="Дата початку" className="flex-1">
              <DatePicker value={startDate} onChange={setStartDate} aria-label="Дата початку" />
            </FormGroup>
            <FormGroup label="Дата завершення" className="flex-1">
              <DatePicker value={endDate} onChange={setEndDate} aria-label="Дата завершення" />
            </FormGroup>
          </div>
        </form>
    </Dialog>
  );
}

function SprintCreateModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [nameError, setNameError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Вкажіть назву спринта');
      return;
    }
    onSave({
      name,
      goal,
      startDate: fromDateInput(startDate),
      endDate: fromDateInput(endDate, { endOfDay: true })
    });
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Створити спринт"
      size="sm"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">Скасувати</Button>
          <Button style="primary" size="md" type="submit" form="sprint-create-form">Створити</Button>
        </>
      }
    >
        <form id="sprint-create-form" noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Назва спринта" required error={nameError}>
            <Input
              type="text"
              placeholder="Наприклад: Спринт 1"
              value={name}
              onChange={e => { setName(e.target.value); if (nameError) setNameError(''); }}
              error={Boolean(nameError)}
            />
          </FormGroup>
          <FormGroup label="Ціль спринта">
            <Textarea value={goal} placeholder="Опишіть ціль цього спринта..." onChange={e => setGoal(e.target.value)} rows={2} />
          </FormGroup>
          <div className="flex gap-4">
            <FormGroup label="Дата початку" className="flex-1">
              <DatePicker value={startDate} onChange={setStartDate} aria-label="Дата початку" />
            </FormGroup>
            <FormGroup label="Дата завершення" className="flex-1">
              <DatePicker value={endDate} onChange={setEndDate} aria-label="Дата завершення" />
            </FormGroup>
          </div>
        </form>
    </Dialog>
  );
}

function SprintCompleteModal({ sprint, sprints, incompleteIssues, onClose, onConfirm }) {
  const [moveToSprintId, setMoveToSprintId] = useState('backlog');

  const upcomingSprints = sprints.filter(s => s.status === 'planned');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(moveToSprintId === 'backlog' ? null : moveToSprintId);
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title={`Завершити спринт: ${sprint.name}`}
      size="sm"
      presentation="dialog"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">Скасувати</Button>
          <Button style="primary" size="md" type="submit" form="sprint-complete-form">Завершити спринт</Button>
        </>
      }
    >
        <p className="text-[13px] text-muted mb-4">
          У цьому спринті залишилося <strong className="text-ink">{incompleteIssues.length} {plural(incompleteIssues.length, ['завдання', 'завдання', 'завдань'])}</strong>. Куди їх перенести?
        </p>
        <form id="sprint-complete-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Перенести завдання в">
            <Select
              value={moveToSprintId}
              onChange={setMoveToSprintId}
              options={[
                { value: 'backlog', label: 'Беклог' },
                ...upcomingSprints.map(s => ({ value: s.id, label: s.name })),
              ]}
              className="w-full"
            />
          </FormGroup>
        </form>
    </Dialog>
  );
}

export default function GlobalSprintsPage() {
  const router = useRouter();
  const { currentUser, projects, activeOrgId, orgRole } = useAppContext();
  const { members } = useOrganization();
  const { labels, statuses, priorities, types, closedStatusIds, categoryColumns } = useWorkflowConfig();
  const statusOrder = statuses.map(s => s.id);
  const priorityOrder = Object.fromEntries(priorities.map((priority, index) => [priority.id, index]));
  priorityOrder[NO_PRIORITY_ID] = priorities.length;
  const isClosedCol = (id) => closedStatusIds.includes(id);
  const { formatDate } = useLocalization();
  const showToast = useWorkspaceStore(s => s.showToast);
  const sprintSearch = useWorkspaceStore(s => s.sprintSearch);
  const confirmDialog = useConfirm();

  // No breadcrumbs for main pages
  useEffect(() => {
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, []);

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCreateSprintModal, setShowCreateSprintModal] = useState(false);
  const [showCompleteSprintModal, setShowCompleteSprintModal] = useState(null); // sprint object
  const [editingSprint, setEditingSprint] = useState(null);
  const [activeIssue, setActiveIssue] = useState(null);
  const [sectionExpansion, setSectionExpansion] = useState({});
  const [projectFilters, setProjectFilters] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey]  = useState('order');
  const [sortDir, setSortDir]  = useState('asc');
  const [backlogCollapsed, setBacklogCollapsed] = useState(false);

  const isManager = can(orgRole, 'manage:sprints');
  const projectIds = (projects || []).map(p => p.id);
  const {
    issues: snapshotIssues,
    issueLinks,
    loading: issuesLoading,
  } = useWorkspaceAnalytics(projectIds, { includeTimeLogs: false });
  // Sprint reassignment is painted locally first; without it the dropped card
  // animates back into its old sprint and only then hops to the new one.
  const [dndIssues, applyPatch, revertPatch] = useOptimisticPatch(snapshotIssues);
  const resolveBulkStatusId = useCallback((issue, value) => {
    if (value?.mode !== 'category') return value?.id || null;
    const project = (projects || []).find(item => item.id === issue.projectId);
    return resolveCategoryStatusId(value.id, statuses, {
      currentStatusId: issue.columnId || issue.status,
      hiddenStatusIds: project?.hiddenColumns || [],
    });
  }, [projects, statuses]);
  const { issues, applyBulkAction } = useBulkIssueActions({
    issues: dndIssues,
    organizationId: activeOrgId,
    showToast,
    resolveStatusId: resolveBulkStatusId,
  });
  const {
    sprints,
    loading: sprintsLoading,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
  } = useSprints();

  const loading = issuesLoading || sprintsLoading;
  const dndAnnouncements = createUkrainianDndAnnouncements({
    itemLabel: draggableId => {
      const issue = issues.find(candidate => candidate.id === draggableId);
      return issue?.issueKey || issue?.title || 'Завдання';
    },
    listLabel: droppableId => (
      droppableId === 'backlog'
        ? 'Без спринта'
        : sprints.find(sprint => sprint.id === droppableId)?.name || 'Спринт'
    ),
  });

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (selectionActive) return;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const issueId = draggableId;
    const targetSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId;

    // Move the card first, write second. Firestore was also imported lazily
    // right here, so the first drop of a session paid a chunk fetch on top of
    // the round-trip before anything on screen moved.
    applyPatch({ [issueId]: { sprintId: targetSprintId } });

    try {
      await updateDoc(doc(db, 'issues', issueId), {
        sprintId: targetSprintId,
        updatedAt: serverTimestamp()
      });
      showToast('Спринт оновлено ✓');
    } catch (err) {
      revertPatch([issueId]);
      console.error(err);
      showToast('Не вдалося перемістити завдання — відновлено попередній стан', 'error');
    }
  };

  const handleCreateSprint = async (sprintData) => {
    try {
      await createSprint(sprintData);
      setShowCreateSprintModal(false);
      showToast('Спринт створено ✓');
    } catch (e) {
      console.error(e);
      showToast('Помилка створення спринта');
    }
  };

  const handleStartSprint = async (sprintId) => {
    try {
      await startSprint(sprintId);
      showToast('Спринт розпочато ✓');
    } catch (error) {
      showToast(error.message || 'Помилка запуску спринта', 'error');
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filter & Sort issues
  const filteredIssues = issues.filter(i => {
    const normalizedSearch = sprintSearch.trim().toLowerCase();
    if (normalizedSearch) {
      const projectName = projects.find(project => project.id === i.projectId)?.name || '';
      const sprintName = sprints.find(sprint => sprint.id === i.sprintId)?.name || '';
      const matches = [i.issueKey, i.title, i.description, projectName, sprintName]
        .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!matches) return false;
    }
    if (projectFilters.length > 0 && !projectFilters.includes(i.projectId)) return false;
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        if (i.assigneeIds && i.assigneeIds.length > 0) return false;
      } else {
        if (!i.assigneeIds || !i.assigneeIds.includes(assigneeFilter)) return false;
      }
    }
    if (priorityFilter !== 'all' && (i.priority || NO_PRIORITY_ID) !== priorityFilter) return false;
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    return true;
  });
  usePublishLocalSearchResults(sprintSearch, filteredIssues.length);

  const getSortedIssues = (issueList) => {
    return [...issueList].sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === 'priority') { 
        av = priorityOrder[a.priority || NO_PRIORITY_ID] ?? priorities.length + 1;
        bv = priorityOrder[b.priority || NO_PRIORITY_ID] ?? priorities.length + 1;
      }
      if (sortKey === 'columnId') {
        av = statusOrder.indexOf(a.columnId);
        bv = statusOrder.indexOf(b.columnId);
      }
      const res = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? res : -res;
    });
  };

  const selectionOrder = getSortedIssues(filteredIssues).map(issue => issue.id);
  const selectionScopeKey = [
    activeOrgId,
    sprintSearch,
    projectFilters.join(','),
    assigneeFilter,
    priorityFilter,
    typeFilter,
    sortKey,
    sortDir,
  ].join('|');
  const {
    active: selectionActive,
    activeSelectedIds: activeSelectedIssueIds,
    selectedIssues,
    toggle: toggleIssueSelection,
    toggleScope: toggleIssueScope,
    clear: clearSelection,
  } = useIssueSelection({
    issues: filteredIssues,
    order: selectionOrder,
    scopeKey: selectionScopeKey || 'sprints',
  });
  const toggleSectionSelection = sectionIssues => toggleIssueScope(
    sectionIssues.map(issue => issue.id),
  );
  const handleBulkUpdate = (action, value) => applyBulkAction(
    action,
    action === 'status' ? { mode: 'category', id: value } : value,
    selectedIssues,
  );

  const activeSprintList = (sprints || []).filter(s => s.status === 'active');
  const plannedSprintList = (sprints || []).filter(s => s.status === 'planned');
  const completedSprintList = (sprints || []).filter(s => s.status === 'completed');

  const sprintMap = (sprints || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const backlogIssues = filteredIssues.filter(i => !i.sprintId || !sprintMap[i.sprintId]);

  const formatSprintDates = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const toggleSection = (id) => {
    setSectionExpansion(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  const isSectionExpanded = (sprintId, def = true) => {
    if (sectionExpansion[sprintId] !== undefined) {
      return sectionExpansion[sprintId];
    }
    return def;
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />;
  };

  const renderIssueTable = (issueList, droppableId, isBacklogCol = false) => {
    const sorted = getSortedIssues(issueList);
    return (
      <Droppable droppableId={droppableId} isDropDisabled={selectionActive}>
        {(provided, snapshot) => (
          <div 
            className={`flex min-h-[60px] flex-col pb-4 pt-1 ${isBacklogCol ? 'px-[8px]' : 'px-4'}`}
            ref={provided.innerRef} 
            {...provided.droppableProps}
          >
            {sorted.map((issue, index) => {
              const pName = projects.find(p => p.id === issue.projectId)?.name || '';
              if (isBacklogCol) {
                return (
                  <IssueCard
                    key={issue.id}
                    className="mb-[8px]"
                    issue={issue}
                    issues={issueList}
                    sprints={sprints}
                    members={members}
                    labels={labels}
                    index={index}
                    projectId={issue.projectId}
                    projectName={pName}
                    showProjectName
                    issueLinks={issueLinks}
                    selected={activeSelectedIssueIds.has(issue.id)}
                    selectionActive={selectionActive}
                    onSelect={toggleIssueSelection}
                  />
                );
              }
              return (
                <Draggable key={issue.id} draggableId={issue.id} index={index} isDragDisabled={selectionActive}>
                  {(draggableProvided, draggableSnapshot) => (
                    <div
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      {...draggableProvided.dragHandleProps}
                      className="mb-[8px]"
                      style={{
                        ...draggableProvided.draggableProps.style,
                        opacity: draggableSnapshot.isDragging ? 0.8 : 1,
                      }}
                    >
                      <TaskRow
                        issue={issue}
                        members={members}
                        labels={labels}
                        sprints={sprints}
                        projectId={issue.projectId}
                        projectName={pName}
                        showProjectName
                        onClick={() => setActiveIssue(issue)}
                        selected={activeSelectedIssueIds.has(issue.id)}
                        selectionActive={selectionActive}
                        onSelect={toggleIssueSelection}
                      />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {issueList.length === 0 && (
              <div className="py-8 text-center text-[12px] text-faint">
                {isBacklogCol
                  ? 'Завдань без спринта не знайдено'
                  : 'У цьому спринті ще немає задач — перетягніть їх зі списку нижче'}
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-transparent">
      <div className="workspace-page-layout h-full pb-[24px]">
      
      <PageHeader
        title="Спринти"
        actions={
          <>
            {isManager && (
              <Button
                style="primary"
                size="lg"
                icon={Plus}
                onClick={() => setShowCreateSprintModal(true)}
                collapseAt="sm"
                title="Створити спринт"
              >
                Створити спринт
              </Button>
            )}
          </>
        }
        filters={
          <FilterBar>
            <MultiSelect
              value={projectFilters}
                onChange={setProjectFilters}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Всі проєкти"
                searchPlaceholder="Пошук проєкту..."
                filterRole="project"
                variant="ghost"
              />
              <Select
                filterRole="member"
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={[
                  { value: 'all', label: 'Всі виконавці' },
                  { value: 'unassigned', label: 'Без виконавця' },
                  ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email, user: m }))
                ]}
                variant="ghost"
              />
              <Select
                filterRole="priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  { value: 'all', label: 'Всі пріоритети' },
                  ...prioritySelectOptions(priorities),
                ]}
                variant="ghost"
              />
              <Select
                filterRole="type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'Всі типи' },
                  ...types.map(taskTypeSelectOption),
                ]}
                variant="ghost"
              />
            </FilterBar>
        }
      />

      {/* ── Content area ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-transparent">
          <div className="w-[28px] h-[28px] border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
        </div>
      ) : (
        /* PLANNING TAB */
        <div className="flex-1 flex flex-col min-h-[600px]">
          
          <DragDropContext
            dragHandleUsageInstructions={UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS}
            onDragStart={dndAnnouncements.onDragStart}
            onDragUpdate={dndAnnouncements.onDragUpdate}
            onDragEnd={(result, provided) => {
              dndAnnouncements.onDragEnd(result, provided);
              onDragEnd(result);
            }}
          >
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 items-stretch">

              {/* Left Column: Sprints (65%) */}
              <div className="flex-1 flex flex-col gap-4 overflow-visible lg:overflow-y-auto custom-scrollbar lg:pr-2 min-h-0">
                {sprints.map(sprint => {
                  const sprintIssues = filteredIssues.filter(i => i.sprintId === sprint.id);
                  const isExpanded = isSectionExpanded(sprint.id, sprint.status !== 'completed');

                  return (
                    <div key={sprint.id} data-ui-surface="local" className="bg-canvas rounded-[16px] border border-transparent shadow-none overflow-hidden shrink-0">
                      <div className="px-5 py-4 flex items-center justify-between">
                        {/* The bare 16px chevron was the only reliable target and
                            the row shrank to its content, so the empty space beside
                            the title did nothing. Now the whole strip toggles and
                            the chevron is the same control the board and the task
                            list use to fold a section: ghost, `icon-xs`, a 20px
                            box. It was `icon` — a 32px box — which made the one
                            accordion in the product that collapses a group of
                            tasks look like a different kind of control from the
                            two others that do exactly that. */}
                        <div
                          className="-my-2 -ml-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[10px] py-2 pl-2 pr-3 transition-colors hover:bg-[#ebebeb]"
                          onClick={() => toggleSection(sprint.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onKeyDown={event => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            toggleSection(sprint.id);
                          }}
                        >
                          <Button
                            style="ghost"
                            size="icon-xs"
                            icon={isExpanded ? ChevronDown : ChevronRight}
                            className="shrink-0 hover:!bg-white"
                            aria-expanded={isExpanded}
                            title={isExpanded ? 'Згорнути спринт' : 'Розгорнути спринт'}
                            aria-label={`${isExpanded ? 'Згорнути' : 'Розгорнути'} спринт ${sprint.name}`}
                          />
                          <h3 className="ui-type-card-title text-ink truncate">{sprint.name}</h3>
                          {sprint.status === 'active' && <StatusPill label="Активний" color="#10b981" />}
                          {sprint.status === 'planned' && <StatusPill label="Запланований" color="#9a9a9a" />}
                          {/* QUI-135. `#cbd5e1` on its own 9% tint scored ~1.5:1 —
                              the label was there but unreadable. A finished sprint
                              is closed, so it takes the ink tone: definitive, and
                              distinct from active green and planned grey. */}
                          {sprint.status === 'completed' && <StatusPill label="Завершено" color="#1f1f1f" />}
                          <span className="text-[11px] text-muted shrink-0">
                            {sprintIssues.length} {plural(sprintIssues.length, ['завдання', 'завдання', 'завдань'])}
                          </span>
                          {sprint.startDate && (
                            <span className="text-[11px] text-muted hidden sm:inline ml-2">
                              {formatSprintDates(sprint.startDate, sprint.endDate)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <ContextMenu
                            trigger={(
                              <Button
                                style="ghost"
                                size="icon-xs"
                                icon={MoreHorizontal}
                                className="hover:!bg-white"
                                aria-label={`Дії зі списком ${sprint.name}`}
                                title="Дії зі списком"
                              />
                            )}
                            items={[{
                              label: sprintIssues.length > 0 && sprintIssues.every(issue => activeSelectedIssueIds.has(issue.id))
                                ? 'Зняти вибір у списку'
                                : 'Вибрати всі у списку',
                              icon: CheckSquare,
                              onClick: () => toggleSectionSelection(sprintIssues),
                            }]}
                          />
                          {isManager && (<>
                            {sprint.status === 'planned' && (
                              <Button
                                style="primary"
                                size="sm"
                                icon={Play}
                                onClick={() => handleStartSprint(sprint.id)}
                              >
                                Почати спринт
                              </Button>
                            )}
                            {sprint.status === 'active' && (
                              <Button
                                style="primary"
                                size="sm"
                                icon={Check}
                                onClick={() => setShowCompleteSprintModal(sprint)}
                              >
                                Завершити
                              </Button>
                            )}
                            <Button
                              style="secondary"
                              size="icon"
                              icon={Edit2}
                              onClick={() => setEditingSprint(sprint)}
                            >
                              Редагувати
                            </Button>
                            {sprint.status !== 'active' && (
                              <Button
                                style="secondary"
                                size="icon"
                                color="red"
                                icon={Trash2}
                                onClick={async () => {
                                  if (await confirmDialog({ title: 'Видалити спринт?', confirmText: 'Видалити', danger: true })) deleteSprint(sprint.id);
                                }}
                              >
                                Видалити
                              </Button>
                            )}
                          </>)}
                        </div>
                      </div>

                      {isExpanded && sprint.goal && (
                        <p className="px-5 pb-2 text-[12px] text-muted italic">Ціль: {sprint.goal}</p>
                      )}

                      {isExpanded && (
                        renderIssueTable(sprintIssues, sprint.id)
                      )}
                    </div>
                  );
                })}
                {sprints.length === 0 && (
                  <div data-ui-surface="local" className="py-12 text-center text-[13px] text-faint bg-canvas rounded-[16px]">
                    {isManager
                      ? 'Немає запланованих або активних спринтів. Створіть новий спринт, щоб розпочати планування.'
                      : 'Немає запланованих або активних спринтів. Попросіть адміністратора створити спринт для планування роботи.'}
                  </div>
                )}
              </div>

              {/* Right column mirrors the global board column contract. */}
              {backlogCollapsed ? (
                <div
                  data-ui-surface="local"
                  className="flex w-[48px] shrink-0 cursor-pointer flex-col items-center justify-start rounded-[16px] bg-canvas pb-2 pt-4 transition-colors hover:bg-[#f0f0f2]"
                  onClick={() => setBacklogCollapsed(false)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={false}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setBacklogCollapsed(false);
                  }}
                >
                  <Button
                    style="ghost"
                    size="icon-xs"
                    icon={ChevronRight}
                    className="mb-4 hover:!bg-white"
                    title="Розгорнути колонку завдань"
                  />
                  <span className="mb-4 h-[8px] w-[8px] shrink-0 rounded-full bg-muted" />
                  <h3
                    className="ui-type-column-title whitespace-nowrap text-ink"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    Без спринта
                  </h3>
                  <Counter value={backlogIssues.length} size="sm" appearance="subtle" className="mt-4" />
                </div>
              ) : (
                <Surface
                  preset="panel"
                  padding="none"
                  composition="scroll-pane"
                  className="flex w-[82vw] max-w-[320px] shrink-0 flex-col overflow-hidden md:w-[280px] md:max-w-none"
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-line bg-canvas px-4 pb-3 pt-4">
                    <div className="flex items-center gap-[6px]">
                      <Button
                        onClick={() => setBacklogCollapsed(true)}
                        style="ghost"
                        size="icon-xs"
                        icon={ChevronLeft}
                        className="-ml-2 hover:!bg-white"
                        title="Згорнути колонку завдань"
                      />
                      <span className="h-[8px] w-[8px] rounded-full bg-muted" />
                      <h3 className="ui-type-column-title text-ink">Без спринта</h3>
                      <Counter value={backlogIssues.length} size="sm" appearance="subtle" className="ml-1" />
                    </div>
                    <div className="flex items-center gap-1">
                      <ContextMenu
                        trigger={(
                          <Button
                            style="ghost"
                            size="icon-xs"
                            icon={MoreHorizontal}
                            className="hover:!bg-white"
                            aria-label="Дії зі списком без спринта"
                            title="Дії зі списком"
                          />
                        )}
                        items={[{
                          label: backlogIssues.length > 0 && backlogIssues.every(issue => activeSelectedIssueIds.has(issue.id))
                            ? 'Зняти вибір у списку'
                            : 'Вибрати всі у списку',
                          icon: CheckSquare,
                          onClick: () => toggleSectionSelection(backlogIssues),
                        }]}
                      />
                      <Button
                        onClick={() => setShowCreateTaskModal(true)}
                        style="ghost"
                        size="icon-xs"
                        icon={Plus}
                        className="hover:!bg-white"
                        title="Додати завдання без спринту"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto hide-scrollbar">
                    {renderIssueTable(backlogIssues, 'backlog', true)}
                  </div>
                </Surface>
              )}

            </div>
          </DragDropContext>
        </div>
      )}

      <BulkActionBar
        count={activeSelectedIssueIds.size}
        statusOptions={categoryColumns.map(category => ({
          value: category.id,
          label: category.label,
          dotColor: category.color,
        }))}
        memberOptions={members.map(member => ({
          value: member.id || member.uid,
          label: member.name || member.email || 'Учасник',
          user: member,
        }))}
        priorityOptions={prioritySelectOptions(priorities)}
        labelOptions={labels.map(label => ({ value: label.id, label: label.label, dotColor: label.color }))}
        typeOptions={types.filter(type => type.id !== 'epic').map(taskTypeSelectOption)}
        sprintOptions={sprints.filter(sprint => sprint.status !== 'completed').map(sprint => ({
          value: sprint.id,
          label: sprint.name,
        }))}
        canArchive={can(orgRole, 'delete:issue')}
        onApply={handleBulkUpdate}
        onClear={clearSelection}
      />

      {/* Edit Sprint Modal */}
      {editingSprint && (
        <SprintEditModal
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onSave={async (updates) => {
            try {
              await updateSprint(editingSprint.id, updates);
              setEditingSprint(null);
              showToast('Спринт оновлено ✓');
            } catch (err) {
              console.error(err);
              showToast('Помилка оновлення спринта');
            }
          }}
        />
      )}

      {/* Create Sprint Modal */}
      {showCreateSprintModal && (
        <SprintCreateModal
          onClose={() => setShowCreateSprintModal(false)}
          onSave={handleCreateSprint}
        />
      )}

      {/* Complete Sprint Modal */}
      {showCompleteSprintModal && (
        <SprintCompleteModal
          sprint={showCompleteSprintModal}
          sprints={sprints}
          incompleteIssues={issues.filter(i => i.sprintId === showCompleteSprintModal.id && !isClosedCol(i.status) && !isClosedCol(i.columnId))}
          onClose={() => setShowCompleteSprintModal(null)}
          onConfirm={async (moveToSprintId) => {
            try {
              await completeSprint(showCompleteSprintModal.id, moveToSprintId);
              setShowCompleteSprintModal(null);
              showToast('Спринт успішно завершено ✓');
            } catch (err) {
              console.error(err);
              showToast('Помилка завершення спринта');
            }
          }}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSubmit={async (formData) => {
          if (!formData.projectId) {
            throw new Error('Будь ласка, оберіть проєкт');
          }
          const created = await createIssueViaApi({
            organizationId: activeOrgId,
            projectId: formData.projectId,
            data: {
              title: formData.title,
              description: formData.description || '',
              status: formData.status || 'backlog',
              priority: formData.priority || 'medium',
              type: formData.type || 'task',
              assigneeIds: formData.assignees || [],
              labelIds: formData.labelIds || [],
              dueDate: formData.dueDate || null,
              estimateMinutes: formData.estimateMinutes || 0,
              sprintId: formData.sprintId || null,
              reporterId: currentUser?.uid || currentUser?.id,
            },
          });

          showToast('Задачу створено ✓');
          return { ...created, projectId: formData.projectId };
        }}
        projects={projects}
        teamMembers={members}
        sprints={sprints}
      />

      {/* Issue Detail Modal */}
      {activeIssue && (
        <IssueModal 
          issue={activeIssue} 
          onClose={() => setActiveIssue(null)} 
        />
      )}
      </div>
    </div>
  );
}
