// src/lib/utils/projectAccess.mjs
// Who may act inside a project, decided in one place.
//
// `project.team` is the visibility gate of the whole workspace: an owner or an
// admin reaches every project of the organization, everyone else reaches the
// projects they were added to. The same sentence is written three times over —
// in `firestore.rules` (`canAccessProject`), in the server routes that create,
// delete and bulk-edit issues, and in the page loader behind `/[projectId]`.
// This module is the copy the server routes share, so that adding a route
// cannot quietly invent a fourth interpretation.

export function isPrivilegedRole(role) {
  return role === 'owner' || role === 'admin';
}

/** Does this person reach the project's contents at all? */
export function hasProjectAccess(project, role, uid) {
  if (!project) return false;
  if (isPrivilegedRole(role)) return true;
  return Array.isArray(project.team) && project.team.includes(uid);
}

/**
 * The localized reason a project cannot be written to, or '' when it can.
 * Order matters: "not found" and "being deleted" are facts about the project
 * and must not be reported as a permission problem.
 */
export function projectWriteError(project, organizationId, role, uid) {
  if (!project || project.organizationId !== organizationId) return 'Проєкт задачі не знайдено';
  if (project.deletionPending === true) return 'Проєкт уже видаляється';
  if (!hasProjectAccess(project, role, uid)) return 'Ви не входите до команди цього проєкту';
  return '';
}

/**
 * A project whose team was never recorded is legacy data, not a project nobody
 * belongs to. Every reader of `team` has to make that distinction or it starts
 * refusing writes on the oldest projects in the workspace.
 */
export function hasRecordedTeam(project) {
  return Array.isArray(project?.team);
}

/**
 * The assignees who could not open the task being handed to them.
 *
 * A task's assignee has to be able to reach its project — otherwise the task is
 * not work assigned to somebody, it is a note about them. The workspace could
 * produce exactly that: «Команда» → a member → «Створити завдання» offers every
 * project, the composer offered the whole organization as assignees, and the
 * server only ever checked that an assignee was in the organization. The result
 * was a task its own assignee could not find, whose avatar the board then
 * dropped silently because the card resolves faces from the project's team.
 *
 * Who may then do something about it is a separate question, and the caller's:
 * adding somebody to a project is `manage:team`, so an owner or an admin
 * assigning work grants the access along with it, and anyone else is refused.
 *
 * @param {object} project The project the task lives in.
 * @param {string[]} assigneeIds The people being assigned.
 * @param {(uid: string) => string|null} roleOf Their role in the organization.
 * @returns {string[]} The subset that needs to be added to `project.team`.
 */
export function assigneesOutsideProject(project, assigneeIds, roleOf) {
  if (!hasRecordedTeam(project)) return [];
  return [...new Set(assigneeIds || [])].filter(
    uid => uid && !hasProjectAccess(project, roleOf(uid), uid),
  );
}
