import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  isExternalActorId,
  issueParticipants,
} from '../src/lib/utils/issueParticipants.mjs';
import { projectIssuePrefix, taskDisplayKey } from '../src/lib/utils/issueKeys.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// An imported task remembers a reporter who never had a QuickTeam account. That
// person is a label on the record, not a participant, and not an actor.
test('an external reporter is never a notification recipient', () => {
  assert.equal(isExternalActorId('external:youtrack:conn1:42'), true);
  assert.equal(isExternalActorId('KJh2kd8sLKJd0912'), false);
  assert.equal(isExternalActorId(''), false);
  assert.equal(isExternalActorId(undefined), false);

  const imported = {
    assigneeIds: ['member-a'],
    reporterId: 'external:youtrack:conn1:42',
    watcherIds: ['member-b'],
  };
  assert.deepEqual(
    issueParticipants(imported, { actorId: 'member-a' }),
    ['member-b'],
  );
});

test('the actor is still excluded, and real reporters are still included', () => {
  const issue = {
    assigneeIds: ['a', 'b'],
    reporterId: 'c',
    watcherIds: ['d'],
  };
  assert.deepEqual(issueParticipants(issue, { actorId: 'a' }), ['b', 'c', 'd']);
  assert.deepEqual(
    issueParticipants(issue, { actorId: 'a', exclude: ['d'] }),
    ['b', 'c'],
  );
});

// One stale recipient used to fail the whole request with 403, so a status
// change on an imported task notified nobody at all.
test('a recipient who is not a member is dropped, not fatal to the batch', async () => {
  const route = await read('../src/app/api/notifications/route.js');
  assert.match(route, /const userIdsToNotify = audienceIds\.filter\(/);
  assert.doesNotMatch(route, /One or more recipients are not organization members/);
  assert.match(route, /if \(!userIdsToNotify\.length\) \{/);
  // Everything downstream reads the validated list, or a dropped recipient
  // would shift the settings/profile lookups out of alignment with it.
  assert.doesNotMatch(route, /db\.getAll\(\.\.\.userIds\.map/);
  assert.doesNotMatch(route, /const recipients = userIds\.map/);
});

test('nobody is notified about their own action, except a self-addressed test', async () => {
  const route = await read('../src/app/api/notifications/route.js');
  assert.match(
    route,
    /const audienceIds = type === 'test'\s*\r?\n\s*\? userIds\s*\r?\n\s*: userIds\.filter\(uid => uid !== authorization\.user\.uid\)/,
  );
});

// The card said "«External Person» оновив завдання" about somebody who does not
// exist, on a task nobody had touched.
test('project activity names only who the activity record says acted', async () => {
  const page = await read('../src/app/(app)/page.js');

  assert.match(page, /const actorId = newestIssue\.lastActivityActorId \|\| newestIssue\.updatedBy \|\| '';/);
  // The reporter is who filed it, not who last touched it.
  assert.doesNotMatch(page, /newestIssue\.reporterId\b/);
  assert.doesNotMatch(page, /actorUser = members\.find\(m => m\.email && m\.email\.toLowerCase\(\) === newestIssue\.reporterName/);
  assert.match(page, /const isExternalActor = isExternalActorId\(actorId\)/);

  // Every activity type reads as itself; "created" used to render as "updated".
  for (const verb of ['створив завдання', 'змінив статус завдання', 'відновив завдання', 'написав у чаті завдання']) {
    assert.ok(page.includes(verb), verb);
  }
  // And an unattributed event is phrased without a person rather than with a
  // blank one.
  for (const event of ['Створено завдання', 'Змінено статус завдання', 'Оновлено завдання']) {
    assert.ok(page.includes(event), event);
  }
});

test('a task key is never invented from a document id', async () => {
  // The client used to build `PRE-a3f2` out of the project name and four
  // characters of the Firestore id whenever a task had no key.
  assert.equal(taskDisplayKey({ issueKey: 'QT-142' }), 'QT-142');
  assert.equal(taskDisplayKey({ issueKey: '' }, { name: 'QuickTeam' }), '');
  assert.equal(taskDisplayKey({}, { name: 'QuickTeam' }), '');
  assert.equal(taskDisplayKey({ id: 'a3f2xyz' }, { name: 'QuickTeam' }), '');
  // A legacy `WS-` key keeps the number that is real and takes the project's
  // prefix in place of the generic one.
  assert.equal(taskDisplayKey({ issueKey: 'WS-17' }, { name: 'QuickTeam' }), 'QUI-17');
  assert.equal(taskDisplayKey({ issueKey: 'WS-17' }, { issuePrefix: 'qt' }), 'QT-17');
  assert.equal(projectIssuePrefix({ name: 'Мій Проєкт' }), 'МІЙ');
  assert.equal(projectIssuePrefix(null), 'WS');

  for (const file of [
    '../src/components/workspace/IssueCard.jsx',
    '../src/components/ui/TaskManagement/TaskRow.jsx',
  ]) {
    const source = await read(file);
    assert.doesNotMatch(source, /getDisplayKey/, file);
    assert.doesNotMatch(source, /id\?\.slice\(0, 4\)/, file);
  }
});

test('the prefix rule is written once, not once per writer', async () => {
  for (const file of ['../src/app/api/issues/route.js', '../src/lib/server/telegram.js']) {
    const source = await read(file);
    assert.match(source, /import \{ projectIssuePrefix \} from '@\/lib\/utils\/issueKeys\.mjs'/, file);
    assert.doesNotMatch(source, /function projectPrefix\(/, file);
  }
});
