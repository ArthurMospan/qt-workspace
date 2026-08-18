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
