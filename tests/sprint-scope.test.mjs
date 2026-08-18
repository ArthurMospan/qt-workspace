import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  conflictingActiveSprint,
  isOrganizationSprint,
  sprintCoversProject,
  sprintScopeLabel,
  sprintsForProject,
  sprintsOverlap,
} from '../src/lib/utils/sprintScope.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('a sprint with no projects covers the whole organization', () => {
  assert.equal(isOrganizationSprint({}), true);
  assert.equal(isOrganizationSprint({ projectIds: [] }), true);
  assert.equal(isOrganizationSprint({ projectIds: ['p1'] }), false);
  // Every sprint written before project scope existed has no field at all, so
  // "absent" has to keep meaning "organization-wide" or they would all vanish.
  assert.equal(sprintCoversProject({}, 'p1'), true);
  assert.equal(sprintCoversProject({ projectIds: ['p1'] }, 'p1'), true);
  assert.equal(sprintCoversProject({ projectIds: ['p1'] }, 'p2'), false);
});

test('a task is offered only the sprints that reach its project', () => {
  const sprints = [
    { id: 'org', status: 'planned' },
    { id: 'design', status: 'active', projectIds: ['design'] },
    { id: 'dev', status: 'active', projectIds: ['dev'] },
    { id: 'old', status: 'completed', projectIds: ['design'] },
  ];
  assert.deepEqual(sprintsForProject(sprints, 'design').map(s => s.id), ['org', 'design']);
  assert.deepEqual(sprintsForProject(sprints, 'dev').map(s => s.id), ['org', 'dev']);
  assert.deepEqual(
    sprintsForProject(sprints, 'design', { includeCompleted: true }).map(s => s.id),
    ['org', 'design', 'old'],
  );
});

test('two sprints may run at once, but not over the same project', () => {
  const design = { id: 'design', status: 'active', projectIds: ['design'] };
  const dev = { id: 'dev', status: 'planned', projectIds: ['dev'] };
  const both = { id: 'both', status: 'planned', projectIds: ['design', 'dev'] };
  const everything = { id: 'all', status: 'planned', projectIds: [] };

  assert.equal(conflictingActiveSprint([design, dev], dev), null);
  assert.equal(conflictingActiveSprint([design, both], both)?.id, 'design');
  // An organization-wide sprint claims every project, so it collides with any
  // active one — and any active one collides with it.
  assert.equal(conflictingActiveSprint([design, everything], everything)?.id, 'design');
  assert.equal(sprintsOverlap(everything, dev), true);
  assert.equal(sprintsOverlap(design, dev), false);
  // Starting a sprint that is already active is not a conflict with itself.
  assert.equal(conflictingActiveSprint([design], design), null);
});

test('the scope label names projects rather than counting ids', () => {
  const projects = [{ id: 'a', name: 'Дизайн' }, { id: 'b', name: 'Розробка' }, { id: 'c', name: 'QA' }];
  assert.equal(sprintScopeLabel({}, projects), 'Усі проєкти');
  assert.equal(sprintScopeLabel({ projectIds: ['a'] }, projects), 'Дизайн');
  assert.equal(sprintScopeLabel({ projectIds: ['a', 'b'] }, projects), 'Дизайн, Розробка');
  assert.equal(sprintScopeLabel({ projectIds: ['a', 'b', 'c'] }, projects), 'Дизайн +2');
});

test('the single-active-sprint rule is gone from the hook and the server checks scope', async () => {
  const [hook, issuesRoute, bulkRoute] = await Promise.all([
    read('../src/lib/hooks/useSprints.js'),
    read('../src/app/api/issues/route.js'),
    read('../src/app/api/issues/bulk/route.js'),
  ]);
  assert.doesNotMatch(hook, /Спочатку завершіть активний спринт/);
  assert.match(hook, /conflictingActiveSprint\(sprints, sprint\)/);
  assert.match(hook, /projectIds,/);
  // A hidden picker is not enforcement; both write paths re-check the scope.
  assert.match(issuesRoute, /sprintCoversProject\(sprintSnap\.data\(\), projectId\)/);
  assert.match(bulkRoute, /sprintCoversProject\(sprint, issue\.projectId\)/);
});
