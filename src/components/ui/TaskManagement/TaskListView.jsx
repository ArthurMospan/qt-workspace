'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import Counter from '@/components/ui/DataDisplay/Counter';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import Surface from '@/components/ui/Surface';
import TaskRow from './TaskRow';

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
  hiddenStatusIds = [],
  activeTimerIssueId,
  emptyTitle = 'Завдань не знайдено',
  emptyDescription = 'Змініть фільтри або створіть нове завдання.',
}) {
  const { statuses } = useWorkflowConfig();
  const [collapsedSections, setCollapsedSections] = useState([]);
  const toggleSection = sectionId => setCollapsedSections(current => (
    current.includes(sectionId)
      ? current.filter(id => id !== sectionId)
      : [...current, sectionId]
  ));
  const firstStatusId = statuses[0]?.id;
  const visibleStatuses = statuses.filter(status => !hiddenStatusIds.includes(status.id));
  const statusIdForIssue = issue => issue.columnId || issue.status || firstStatusId;
  const visibleSections = visibleStatuses.map(status => ({
    ...status,
    issues: issues.filter(issue => statusIdForIssue(issue) === status.id),
  }));
  const hiddenIssues = issues.filter(issue => hiddenStatusIds.includes(statusIdForIssue(issue)));
  const sections = [
    ...visibleSections,
    ...(hiddenIssues.length > 0 ? [{
      id: '__hidden__',
      label: 'Приховані',
      color: 'var(--color-muted)',
      issues: hiddenIssues,
    }] : []),
  ].filter(section => section.issues.length > 0);

  if (issues.length === 0) {
    return (
      <Surface preset="panel" padding="md" className="w-full">
        <EmptyState
          icon={ClipboardList}
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
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: section.color }} />
              <h3 className="ui-type-column-title uppercase tracking-wide text-ink">{section.label}</h3>
              <Counter value={section.issues.length} size="sm" appearance="subtle" className="ml-1" />
              <Button
                style="ghost"
                size="icon-xs"
                icon={isCollapsed ? ChevronRight : ChevronDown}
                iconSize={16}
                className="ml-auto hover:!bg-white"
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
                    isTimerActive={activeTimerIssueId === issue.id}
                  />
                );
              })}
            </div>
            )}
          </Surface>
        );
      })}
    </div>
  );
}
