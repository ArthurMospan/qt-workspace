'use client';

import { useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { TaskIcon } from '@/lib/design/icons';
import Button from '@/components/ui/Button';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { entryStatusId } from '@/lib/utils/statusCategories.mjs';
import Counter from '@/components/ui/DataDisplay/Counter';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import Surface from '@/components/ui/Surface';
import TaskRow from './TaskRow';
import ContextMenu from '@/components/ui/ContextMenu';
import BulkActionBar from './BulkActionBar';
import { prioritySelectOptions } from '@/lib/utils/priorities.mjs';
import { taskTypeSelectOption } from '@/lib/design/taskTypeIcons';
import { useIssueSelection } from '@/lib/hooks/useIssueSelection';

/**
 * The list view of a board: tasks grouped by status — or, on a list that spans
 * projects, by the five shared status categories — with hidden groups folded into
 * one «Приховані» group at the end.
 *
 * @param {object[]} props.issues The tasks to show.
 * @param {object[]} props.allIssues Every task in scope, for resolving parents and links.
 * @param {object[]} props.members Workspace members, for avatars.
 * @param {object[]} props.labels Label definitions, for the chips.
 * @param {object[]} props.sprints Sprint definitions, for the sprint column.
 * @param {object[]} props.projects Projects, needed when the list spans more than one.
 * @param {object[]} props.issueLinks Relations between tasks.
 * @param {'status'|'category'} props.groupBy What a section is: one status, or one status category.
 * @param {string[]} props.hiddenGroupIds Groups folded into «Приховані» — status ids, or category ids under `groupBy="category"`.
 * @param {string} props.projectId Current project.
 * @param {string} props.projectName Its name, for the per-row project chip.
 * @param {boolean} props.showProjectName Whether each row names its project — true only on cross-project lists.
 * @param {string} props.activeTimerIssueId The task whose timer is running, if any.
 * @param {(action: string, value: unknown, issues: object[]) => Promise<unknown>} props.onBulkUpdate Applies one bulk action to the selected rows.
 * @param {boolean} props.canArchive Whether the current role may archive selected tasks.
 * @param {string} props.selectionScopeKey Clears selection when a route or filter scope changes.
 * @param {string} props.emptyTitle Headline of the empty state.
 * @param {string} props.emptyDescription Sentence under it.
 */
export default function TaskListView({
  issues = [],
  allIssues = issues,
  issueLinks = [],
  members = [],
  labels = [],
  sprints = [],
  projects = [],
  projectId,
  projectName,
  showProjectName = false,
  groupBy = 'status',
  hiddenGroupIds = [],
  activeTimerIssueId,
  onBulkUpdate,
  canArchive = false,
  selectionScopeKey = '',
  emptyTitle = 'Завдань не знайдено',
  emptyDescription = 'Змініть фільтри або створіть нове завдання.',
}) {
  const { statuses, categoryColumns, statusCategoryById, priorities, types } = useWorkflowConfig();
  const [collapsedSections, setCollapsedSections] = useState([]);
  const toggleSection = sectionId => setCollapsedSections(current => (
    current.includes(sectionId)
      ? current.filter(id => id !== sectionId)
      : [...current, sectionId]
  ));
  const byCategory = groupBy === 'category';
  const entryStatus = entryStatusId(statuses);
  const statusIdForIssue = issue => issue.columnId || issue.status || entryStatus;
  // A section is a status, or — across projects, where one project's statuses
  // are not the other's — the category every task of every project has.
  const groups = byCategory ? categoryColumns : statuses;
  const groupIdForIssue = issue => (byCategory
    ? statusCategoryById.get(statusIdForIssue(issue)) || ''
    : statusIdForIssue(issue));
  // A section that gathers several statuses cannot name the status of its rows,
  // so the rows name it themselves — the same rule the board's cards follow.
  const multiStatusGroupIds = new Set();
  if (byCategory) {
    const counts = new Map();
    for (const category of statusCategoryById.values()) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    for (const [category, count] of counts) {
      if (count > 1) multiStatusGroupIds.add(category);
    }
  }
  const visibleSections = groups
    .filter(group => !hiddenGroupIds.includes(group.id))
    .map(group => ({
      ...group,
      showStatusName: multiStatusGroupIds.has(group.id),
      issues: issues.filter(issue => groupIdForIssue(issue) === group.id),
    }));
  const hiddenIssues = issues.filter(issue => hiddenGroupIds.includes(groupIdForIssue(issue)));
  const sections = [
    ...visibleSections,
    ...(hiddenIssues.length > 0 ? [{
      id: '__hidden__',
      label: 'Приховані',
      color: 'var(--color-muted)',
      // This one always mixes statuses, whatever the grouping is.
      showStatusName: byCategory,
      issues: hiddenIssues,
    }] : []),
  ].filter(section => section.issues.length > 0);
  const selectionOrder = sections.flatMap(section => section.issues.map(issue => issue.id));
  const {
    active: selectionActive,
    activeSelectedIds: activeSelectedIssueIds,
    selectedIssues,
    toggle: toggleIssueSelection,
    toggleScope: toggleIssueScope,
    clear: clearSelection,
  } = useIssueSelection({
    issues,
    order: selectionOrder,
    scopeKey: selectionScopeKey || `${projectId || 'cross-project'}:${groupBy}`,
  });
  const toggleSectionSelection = sectionIssues => toggleIssueScope(
    sectionIssues.map(issue => issue.id),
  );
  const applyBulkAction = (action, value) => onBulkUpdate?.(
    action,
    action === 'status' ? { mode: byCategory ? 'category' : 'status', id: value } : value,
    selectedIssues,
  );

  if (issues.length === 0) {
    return (
      <Surface preset="panel" padding="md" className="w-full">
        <EmptyState
          icon={TaskIcon}
          title={emptyTitle}
          description={emptyDescription}
          context="page"
          surface="card"
        />
      </Surface>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {sections.map(section => {
        const isCollapsed = collapsedSections.includes(section.id);
        return (
          <Surface key={section.id} preset="panel" padding="lg" className="w-full">
            {/* No rule under the heading — the panel edge already separates the
                sections, and the collapse control mirrors the board column. */}
            <div
              className={`flex cursor-pointer select-none items-center gap-2 ${isCollapsed ? '' : 'mb-4'}`}
              onClick={() => toggleSection(section.id)}
              // A collapse control, so it says so and answers the keys a button
              // answers. Not a `<button>`: the section heading lives inside it,
              // and a heading is not something to bury in a control's label.
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleSection(section.id);
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: section.color }} />
              <h3 className="ui-type-column-title uppercase tracking-wide text-ink">{section.label}</h3>
              <Counter value={section.issues.length} size="sm" appearance="subtle" className="ml-1" />
              {onBulkUpdate && section.id !== '__hidden__' && (
                <ContextMenu
                  className="ml-auto"
                  trigger={(
                    <Button
                      style="ghost"
                      size="icon-xs"
                      icon={MoreHorizontal}
                      className="hover:!bg-white"
                      aria-label={`Дії зі списком ${section.label}`}
                      title="Дії зі списком"
                    />
                  )}
                  items={[{
                    label: section.issues.every(issue => activeSelectedIssueIds.has(issue.id))
                      ? 'Зняти вибір у списку'
                      : 'Вибрати всі у списку',
                    icon: CheckSquare,
                    onClick: () => toggleSectionSelection(section.issues),
                  }]}
                />
              )}
              <Button
                style="ghost"
                size="icon-xs"
                icon={isCollapsed ? ChevronRight : ChevronDown}
                className={`${onBulkUpdate && section.id !== '__hidden__' ? '' : 'ml-auto'} hover:!bg-white`}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Розгорнути' : 'Згорнути'}
                aria-label={`${isCollapsed ? 'Розгорнути' : 'Згорнути'} ${section.label}`}
              />
            </div>

            {!isCollapsed && (
            <div className="flex flex-col gap-2">
              {section.issues.map(issue => {
                const resolvedProject = projects.find(project => project.id === issue.projectId);
                const resolvedProjectId = issue.projectId || projectId;
                const resolvedProjectName = resolvedProject?.name || projectName;

                return (
                  <TaskRow
                    key={issue.id}
                    issue={issue}
                    issues={allIssues}
                    issueLinks={issueLinks}
                    members={members}
                    labels={labels}
                    sprints={sprints}
                    projectId={resolvedProjectId}
                    projectName={resolvedProjectName}
                    showProjectName={showProjectName}
                    showStatusName={section.showStatusName}
                    isTimerActive={activeTimerIssueId === issue.id}
                    selected={activeSelectedIssueIds.has(issue.id)}
                    selectionActive={selectionActive}
                    onSelect={onBulkUpdate ? toggleIssueSelection : undefined}
                  />
                );
              })}
            </div>
            )}
          </Surface>
        );
      })}
      <BulkActionBar
        count={onBulkUpdate ? activeSelectedIssueIds.size : 0}
        statusOptions={groups.map(group => ({
          value: group.id,
          label: group.label,
          dotColor: group.color,
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
        canArchive={canArchive}
        onApply={applyBulkAction}
        onClear={clearSelection}
      />
    </div>
  );
}
