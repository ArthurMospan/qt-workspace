'use client';

import Card from '@/components/ui/Layout/Card';
import TaskRow from './TaskRow';

/**
 * A titled card holding a flat list of tasks — "Прострочені", "Поточний фокус",
 * "Нещодавно закриті". The rows are `TaskRow`, so a task looks and behaves the
 * same wherever it is listed: same key, badges, assignees, overdue marker, and
 * the same click through to the task.
 *
 * Analytics used to draw three different lists of tasks. Overview had TaskRows;
 * the team pages had a priority dot with a subtitle line; "нещодавно закриті"
 * had a title, a cycle time and a pill, and could not be clicked at all. Unlike
 * `TaskListView`, this one does not group by status: the caller has already
 * decided what the list is.
 *
 * @param {string} props.title Caption above the list.
 * @param {React.ComponentType} props.icon Leading glyph on the caption.
 * @param {string} props.iconClassName Colour for that glyph, where it carries meaning.
 * @param {number} props.count Shown next to the title; defaults to the number of tasks.
 * @param {object[]} props.issues The tasks to list.
 * @param {object[]} props.allIssues Every task in scope, for parents and blockers.
 * @param {object[]} props.members Workspace members, for avatars.
 * @param {object[]} props.labels Label definitions, for the chips.
 * @param {object[]} props.sprints Sprint definitions.
 * @param {object[]} props.projects Projects, for naming each row's project.
 * @param {object[]} props.issueLinks Relations, for the blocked marker.
 * @param {boolean} props.showProjectName Whether each row names its project — true on cross-project lists.
 * @param {number} props.limit How many rows to draw.
 * @param {string} props.emptyText Sentence shown when there is nothing to list.
 * @param {React.ReactNode} props.action Optional control on the right of the caption.
 * @param {string} props.className Placement in the parent only.
 */
export default function TaskListCard({
  title,
  icon: Icon,
  iconClassName = 'text-muted',
  count,
  issues = [],
  allIssues,
  members = [],
  labels = [],
  sprints = [],
  projects = [],
  issueLinks = [],
  showProjectName = true,
  limit = 8,
  emptyText = 'Завдань немає',
  action,
  className = '',
}) {
  const shown = issues.slice(0, limit);
  const total = typeof count === 'number' ? count : issues.length;

  return (
    <Card preset="borderless" padding="lg" className={className}>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon size={13} className={`shrink-0 ${iconClassName}`} />}
        <h3 className="ui-type-eyebrow uppercase tracking-wider text-muted">
          {title}{total > 0 ? ` (${total})` : ''}
        </h3>
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-faint">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map(issue => {
            const project = projects.find(item => item.id === issue.projectId);
            return (
              <TaskRow
                key={issue.id}
                issue={issue}
                issues={issues}
                allIssues={allIssues}
                issueLinks={issueLinks}
                members={members}
                labels={labels}
                sprints={sprints}
                projectId={issue.projectId}
                projectName={project?.name}
                showProjectName={showProjectName}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
