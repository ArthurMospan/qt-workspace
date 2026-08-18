// src/lib/utils/sprintScope.mjs
// Which projects a sprint covers, and what «активний» therefore means.
//
// A sprint used to belong to the whole organization and only one could run at a
// time, which is a rule for a team that works on one thing. This product is for
// a team working on several at once: design can be mid-sprint while development
// starts its own, and a sprint can be scoped to a single project entirely.
//
// `projectIds` is that scope. An empty list means the whole organization — the
// shape every sprint written before this had, so nothing needs a migration.
// «Активний» is then per project rather than per organization: two sprints may
// run side by side as long as they do not claim the same project, because
// inside one project "what we are doing now" still has to name one thing.

export function sprintProjectIds(sprint) {
  const ids = sprint?.projectIds;
  return Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id.trim()) : [];
}

export function isOrganizationSprint(sprint) {
  return sprintProjectIds(sprint).length === 0;
}

export function sprintCoversProject(sprint, projectId) {
  const ids = sprintProjectIds(sprint);
  if (ids.length === 0) return true;
  return Boolean(projectId) && ids.includes(projectId);
}

/** The sprints a task in this project may be put into. */
export function sprintsForProject(sprints, projectId, { includeCompleted = false } = {}) {
  return (Array.isArray(sprints) ? sprints : []).filter(sprint => (
    (includeCompleted || sprint.status !== 'completed')
    && sprintCoversProject(sprint, projectId)
  ));
}

/** Do two sprints claim any project in common? */
export function sprintsOverlap(left, right) {
  if (isOrganizationSprint(left) || isOrganizationSprint(right)) return true;
  const rightIds = new Set(sprintProjectIds(right));
  return sprintProjectIds(left).some(id => rightIds.has(id));
}

/**
 * The active sprint standing in this one's way, or null.
 * Starting a second sprint is fine; starting a second sprint *in the same
 * project* is what makes "зараз у роботі" stop meaning anything.
 */
export function conflictingActiveSprint(sprints, sprint) {
  if (!sprint) return null;
  return (Array.isArray(sprints) ? sprints : []).find(candidate => (
    candidate.id !== sprint.id
    && candidate.status === 'active'
    && sprintsOverlap(candidate, sprint)
  )) || null;
}

/** Short, human answer to «на що цей спринт». */
export function sprintScopeLabel(sprint, projects = []) {
  const ids = sprintProjectIds(sprint);
  if (ids.length === 0) return 'Усі проєкти';
  const named = ids
    .map(id => projects.find(project => project.id === id))
    .filter(Boolean);
  if (named.length === 1) return named[0].name || 'Один проєкт';
  if (named.length === 0) return `${ids.length} проєкти`;
  if (named.length === 2) return named.map(project => project.name).join(', ');
  return `${named[0].name} +${named.length - 1}`;
}
