import { existingParentIssueId } from './issueHierarchyModel.mjs';
import { withoutArchivedIssues } from './issueArchive.mjs';
import { withoutCancelledIssues } from './issueCancel.mjs';
import { chunkProjectIds } from './projectScopedQueries.mjs';

const issueScopeKey = (issue, id = issue.id) => JSON.stringify([
  issue.organizationId, issue.projectId, id,
]);

// Keep the personal query personal. Only its tasks need their children read,
// including children assigned to somebody else or to nobody. Each query stays
// inside one already-authorized project; it never reads the whole workspace.
export function myTaskChildScopes(tasks, { organizationId, userId, projectIds }) {
  if (!organizationId || !userId) return [];
  const allowedProjects = new Set(projectIds);
  const parentsByProject = new Map();
  for (const task of withoutCancelledIssues(withoutArchivedIssues(tasks))) {
    if (!task.id || task.organizationId !== organizationId
      || !allowedProjects.has(task.projectId) || !task.assigneeIds?.includes(userId)) continue;
    if (!parentsByProject.has(task.projectId)) parentsByProject.set(task.projectId, new Set());
    parentsByProject.get(task.projectId).add(task.id);
  }
  return [...parentsByProject].sort(([a], [b]) => a.localeCompare(b)).flatMap(([projectId, ids]) => (
    chunkProjectIds([...ids].sort()).flatMap(parentIds => (
      ['parentIssueId', 'parentEpicId'].map(field => ({
        organizationId, projectId, parentIds, field,
      }))
    ))
  ));
}

export function mergeMyTaskChildren(tasks, children, scopes) {
  const parents = new Set(scopes.flatMap(scope => (
    scope.parentIds.map(id => issueScopeKey(scope, id))
  )));
  // Canonical parentIssueId wins over a stale legacy parentEpicId. A row found
  // by both queries (or also in the personal query) is still only one child.
  const matchingChildren = children.filter(child => (
    parents.has(issueScopeKey(child, existingParentIssueId(child)))
  ));
  const personalTasks = tasks.filter(task => parents.has(issueScopeKey(task)));
  const merged = [...new Map([...matchingChildren, ...personalTasks]
    .map(issue => [issue.id, issue])).values()];
  return withoutCancelledIssues(withoutArchivedIssues(merged));
}
