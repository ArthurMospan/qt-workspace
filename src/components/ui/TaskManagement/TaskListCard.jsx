'use client';

import Card from '@/components/ui/Layout/Card';
import DetailSection from '@/components/ui/Layout/DetailSection';
import TaskRow from './TaskRow';
import useWorkspaceStore from '@/store/useWorkspaceStore';

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
  emptyText = 'Завдань немає',
  action,
  className = '',
}) {
  const openIssueQuickView = useWorkspaceStore(state => state.openIssueQuickView);
  const total = typeof count === 'number' ? count : issues.length;

  return (
    <Card preset="borderless" padding="lg" className={className}>
      {/* The same heading every other block on the screen has. This card used to
          carry a fourth spelling of it — an eyebrow with the count in
          parentheses — which is why a page of these read as a page of
          unrelated widgets. */}
      <DetailSection
        icon={Icon}
        title={title}
        count={total}
        action={action ? <span className="ml-auto shrink-0">{action}</span> : null}
      >
        {issues.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-faint">{emptyText}</p>
        ) : (
          // Every row, always. Analytics does not fetch a set and then hide part
          // of it — see tests/query-completeness.test.mjs. A shorter card would
          // be quieter, but a number you cannot get to the rows behind is worse
          // than a long list.
          <div className="flex flex-col gap-2">
            {issues.map(issue => {
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
                  // A report is a place you read from, not a place you leave.
                  // Every list of tasks in analytics and on a profile is this
                  // card, so one handler here covers all of them.
                  onClick={() => openIssueQuickView(issue)}
                />
              );
            })}
          </div>
        )}
      </DetailSection>
    </Card>
  );
}
