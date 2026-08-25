// A task's assignee has to be able to open the project the task is in.
//
// The workspace could produce the opposite, and did: «Команда» → учасник →
// «Створити завдання» opens the composer with that person already on it, the
// composer offered every project and the whole organization as assignees, and
// the create route only ever checked that an assignee was in the organization.
// The task then sat in their «Мої завдання» pointing at a project they cannot
// open, and the board silently dropped their face — a card resolves faces from
// the project's team, and `.filter(Boolean)` removed anyone who was not on it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assigneesOutsideProject,
  hasProjectAccess,
  hasRecordedTeam,
  isPrivilegedRole,
} from '../src/lib/utils/projectAccess.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('an assignee outside the project team is named, and a privileged one is not', () => {
  const project = { id: 'p1', team: ['owner-1', 'member-in'] };
  const roles = { 'owner-1': 'owner', 'member-in': 'member', 'member-out': 'member', 'admin-out': 'admin' };
  const roleOf = uid => roles[uid] || null;

  assert.deepEqual(assigneesOutsideProject(project, ['member-in'], roleOf), []);
  assert.deepEqual(assigneesOutsideProject(project, ['member-out'], roleOf), ['member-out']);
  // An admin reaches every project of the organization without being listed on
  // one, so assigning to them needs no grant at all.
  assert.deepEqual(assigneesOutsideProject(project, ['admin-out'], roleOf), []);
  assert.deepEqual(
    assigneesOutsideProject(project, ['member-in', 'member-out', 'member-out'], roleOf),
    ['member-out'],
  );
});

test('a project whose team was never recorded is legacy data, not a closed door', () => {
  assert.equal(hasRecordedTeam({ id: 'p' }), false);
  assert.equal(hasRecordedTeam({ id: 'p', team: [] }), true);
  // Without this the rule would refuse every assignment on the oldest projects
  // in the workspace, which is not what "nobody is on this team" means there.
  assert.deepEqual(assigneesOutsideProject({ id: 'p' }, ['anyone'], () => 'member'), []);
  // An empty recorded team is a real answer and does close the door.
  assert.deepEqual(assigneesOutsideProject({ id: 'p', team: [] }, ['anyone'], () => 'member'), ['anyone']);
  assert.equal(hasProjectAccess({ team: [] }, 'member', 'someone'), false);
  assert.equal(isPrivilegedRole('admin'), true);
  assert.equal(isPrivilegedRole('member'), false);
});

test('the create route checks project access, not only organization membership', async () => {
  const route = await read('../src/app/api/issues/route.js');
  assert.match(route, /assigneesOutsideProject/);
  // Granting project access is `manage:team`, which a member does not hold, so
  // for them the assignment is refused rather than performed half-way.
  assert.match(route, /assigneesToAddToTeam\.length && !isPrivileged/);
  assert.match(route, /ASSIGNEE_OUTSIDE_PROJECT/);
  // An owner's assignment grants the access in the same write that creates the
  // task, so the assignee can open what they were just given.
  assert.match(route, /team: FieldValue\.arrayUnion\(\.\.\.assigneesToAddToTeam\)/);
});

test('bulk assignment applies the same rule, per task, to the people it adds', async () => {
  const route = await read('../src/app/api/issues/bulk/route.js');
  assert.match(route, /assigneesOutsideProject\(freshProject, valueMemberships/);
  assert.match(route, /outsideProject\.length && !isPrivilegedActor/);
  // Granted after the loop, in the batch that already touches each project:
  // writing `team` inside the per-task transaction would put the whole
  // selection back onto the one hot document `updatedAt` was moved out of.
  assert.doesNotMatch(route, /transaction\.update\(projectRef/);
  assert.match(route, /grants\?\.size \? \{ team: FieldValue\.arrayUnion\(\.\.\.grants\) \}/);
  // Only the people the action is adding. Reading it off the patch would put
  // somebody who has since left the team back into it while removing them.
  assert.doesNotMatch(route, /assigneesOutsideProject\(freshProject, patch\.assigneeIds/);
});

test('the composer scopes assignees to the project selected inside it', async () => {
  const modal = await read('../src/components/CreateTaskModal.jsx');
  // Three of the four screens that open this dialog handed it the whole
  // organization, because they ask for a project inside the dialog and had none
  // to scope by. The dialog knows which project is selected.
  assert.match(modal, /const assignableMembers = useMemo/);
  assert.match(modal, /assignableMembers\.map\(m => \{/);
  assert.doesNotMatch(modal, /\{teamMembers\.map\(m => \{/);
  // What will happen is said before it happens, and a member — who may not
  // grant project access — is not offered the dead end.
  assert.match(modal, /assigneesJoiningProject/);
  assert.match(modal, /буде додано разом зі створенням завдання/);
  assert.match(modal, /disabled=\{joining && !mayGrantProjectAccess\}/);
});

test('a board card no longer loses the face of someone outside the project team', async () => {
  const board = await read('../src/app/(app)/[projectId]/ProjectBoardClient.jsx');
  // A face is a record of who is on a task; a picker is a question about who
  // may be handed one. The union answers both, which is the rule the task
  // screen already used for its own assignee list.
  assert.match(board, /for \(const participant of issueDisplayParticipants\(issue\)\) uids\.add\(participant\.id\);/);
  const detail = await read('../src/components/workspace/IssueDetail.jsx');
  assert.match(detail, /const assignableIds = new Set\(\[\.\.\.teamUids, \.\.\.\(issue\?\.assigneeIds \|\| \[\]\)\]\);/);
  // And the task itself says so for the tasks that already exist in this state.
  assert.match(detail, /assigneesOutsideProjectTeam\.length > 0 && \(/);
  assert.match(detail, /Виконавець не має доступу до проєкту/);
  // The grant the task screen has always performed stopped being silent, in
  // both directions: it used to succeed without a word and fail into a `catch {}`.
  assert.doesNotMatch(detail, /catch \{ \/\* member assigner lacks team-write permission — non-fatal \*\/ \}/);
  assert.match(detail, /додано до команди проєкту/);
});

// The other half of the same afternoon: a task screen with nowhere to type.
test('a role still loading is not read as a refusal', async () => {
  const { can, canWhileRoleLoads } = await import('../src/lib/utils/can.js');

  // What `can` says while the membership is in flight, and why a screen cannot
  // act on it: it is the same `false` as a real denial.
  assert.equal(can(null, 'create:comment'), false);
  assert.equal(can(null, 'create:project'), false);

  // Every role in the workspace may comment, so a missing role there can only
  // mean "not yet" — nobody who is in the organization at all is refused.
  assert.equal(canWhileRoleLoads(null, 'create:comment'), true);
  assert.equal(canWhileRoleLoads(null, 'edit:comment'), true);
  assert.equal(canWhileRoleLoads(null, 'edit:issue'), true);
  assert.equal(canWhileRoleLoads(null, 'delete:issue'), true);
  // An owner-only action stays hidden until the role proves otherwise: showing
  // a control somebody is about to lose is the worse way to be wrong.
  assert.equal(canWhileRoleLoads(null, 'create:project'), false);
  assert.equal(canWhileRoleLoads(null, 'manage:finance'), false);
  assert.equal(canWhileRoleLoads(null, 'transfer:ownership'), false);
  // Once the role is known it answers exactly as `can` does.
  for (const role of ['owner', 'admin', 'member']) {
    for (const action of ['create:comment', 'create:project', 'manage:team', 'delete:issue']) {
      assert.equal(canWhileRoleLoads(role, action), can(role, action), `${role}/${action}`);
    }
  }
});

test('the comment composer is on the task screen before the membership arrives', async () => {
  const timeline = await read('../src/components/workspace/UnifiedTimeline.jsx');
  // It was gated on `can(orgRole, …)`, so the composer was simply not there
  // until the role landed — which looks exactly like a task you are not allowed
  // to write in, and there is no such task for anyone who can open it.
  assert.match(timeline, /const canWriteComments = canWhileRoleLoads\(orgRole, 'create:comment'\);/);
  assert.match(timeline, /const canEditOwnComment = canWhileRoleLoads\(orgRole, 'edit:comment'\);/);
  // Moderating somebody else's comment is owner/admin, so it keeps waiting.
  assert.match(timeline, /const canModerateComments = can\(orgRole, 'moderate:content'\);/);

  // The same conflation hid every member-level task action for as long.
  for (const path of [
    '../src/components/workspace/IssueDetail.jsx',
    '../src/app/(app)/my/page.js',
    '../src/app/(app)/sprints/page.js',
    '../src/app/(app)/[projectId]/ProjectBoardClient.jsx',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /can\(orgRole, '(?:edit|delete):issue'\)/, path);
  }
});
