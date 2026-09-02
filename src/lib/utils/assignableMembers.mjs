import { activeMembers } from './orgMembership.mjs';

// Who a task can be given to.
//
// One rule, and it was not written down anywhere: the bulk bar's
// «Виконавці» selector listed `activeMembers(members)` — the whole
// organization — on both boards. Offering somebody who is not on the project
// makes assigning them the side door into it, and an assignee who cannot open
// their own work is worse than no assignee at all.
//
// Three things the rule has to get right:
//
//   • **Active people only.** A colleague whose seat was switched off keeps
//     their name on everything they did — that is why the roster keeps them —
//     but you cannot hand new work to somebody who can no longer sign in.
//   • **Every project of the selection.** A bulk action writes the same people
//     to all of it, so somebody on three projects of four cannot be made
//     answerable for the fourth. One task is that rule with a list of one.
//   • **Anyone already assigned stays**, even if they have since left the team,
//     or they could never be un-assigned.
//
// A project with no recorded team is legacy data, not a project nobody may be
// assigned to: it constrains nothing.
//
// The same file exists in qTicket, which found this first — its support desk
// has the identical selector with the identical defect.

function assigneeIdsOf(issue) {
  if (Array.isArray(issue?.assigneeIds)) return issue.assigneeIds.filter(Boolean);
  if (Array.isArray(issue?.assignees)) return issue.assignees.filter(Boolean);
  return issue?.assigneeId ? [issue.assigneeId] : [];
}

/**
 * The people this selection may be assigned to.
 *
 * @param {object[]} options.members The organization directory.
 * @param {object[]} options.issues The tasks being acted on — one, or a whole selection.
 * @param {object[]} options.projects The projects those tasks belong to, for their rosters.
 * @returns {object[]} Members, in the order the directory gave them.
 */
export function assignableMembersFor({ members = [], issues = [], projects = [] } = {}) {
  const active = activeMembers(members);
  const scoped = (issues || []).filter(Boolean);
  if (scoped.length === 0) return active;

  const projectIds = [...new Set(scoped.map(issue => issue.projectId).filter(Boolean))];
  const rosters = projectIds
    .map(projectId => (projects || []).find(project => project.id === projectId))
    .map(project => (Array.isArray(project?.team) ? new Set(project.team) : null))
    .filter(roster => roster && roster.size > 0);

  if (rosters.length === 0) return active;

  const alreadyAssigned = new Set(scoped.flatMap(issue => assigneeIdsOf(issue)));
  return active.filter(member => {
    const uid = member.id || member.uid;
    if (alreadyAssigned.has(uid)) return true;
    return rosters.every(roster => roster.has(uid));
  });
}
