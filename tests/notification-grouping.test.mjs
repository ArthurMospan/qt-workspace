import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  groupNotifications,
  notificationGroupKey,
  notificationIssueKey,
} from '../src/lib/utils/notificationGrouping.mjs';

const comment = (id, issueId, extra = {}) => ({
  id,
  type: 'commented',
  issueId,
  title: 'Колега написав у завданні',
  link: `/proj/issue/QT-12`,
  read: false,
  ...extra,
});

test('records about one conversation collapse into one row', () => {
  const rows = groupNotifications([
    comment('n3', 'issue-a'),
    comment('n2', 'issue-a'),
    comment('n1', 'issue-a'),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 3);
  assert.equal(rows[0].title, '3 нові повідомлення в QT-12');
  // The row is drawn from the newest record it stands for.
  assert.equal(rows[0].notification.id, 'n3');
});

test('a lone record is untouched', () => {
  const rows = groupNotifications([comment('n1', 'issue-a')]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 1);
  assert.equal(rows[0].title, 'Колега написав у завданні');
});

test('different conversations stay apart, and keep their order', () => {
  const rows = groupNotifications([
    comment('n4', 'issue-a'),
    comment('n3', 'issue-b'),
    comment('n2', 'issue-a'),
    comment('n1', 'issue-b'),
  ]);
  assert.deepEqual(rows.map(row => row.count), [2, 2]);
  assert.deepEqual(rows.map(row => row.notification.id), ['n4', 'n3']);
});

test('read and unread never share a row', () => {
  // A mixed row could not say whether the dot belongs to it, and marking it
  // read would consume what the reader deliberately left unread.
  const rows = groupNotifications([
    comment('n2', 'issue-a'),
    comment('n1', 'issue-a', { read: true }),
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.notification.read), [false, true]);
});

test('only the types that repeat with the same words are grouped', () => {
  // Two status changes on one task are two different facts; collapsing them
  // would hide the newer one behind a number.
  assert.equal(notificationGroupKey({ type: 'commented', issueId: 'a' }), 'issue:a');
  assert.equal(notificationGroupKey({ type: 'mentioned', issueId: 'a' }), 'issue:a');
  assert.equal(notificationGroupKey({ type: 'status_changed', issueId: 'a' }), '');
  assert.equal(notificationGroupKey({ type: 'assigned', issueId: 'a' }), '');
  assert.equal(notificationGroupKey({ type: 'deadline', issueId: 'a' }), '');
  const rows = groupNotifications([
    { id: 's2', type: 'status_changed', issueId: 'a', title: 'В роботі', read: false },
    { id: 's1', type: 'status_changed', issueId: 'a', title: 'На перевірці', read: false },
  ]);
  assert.equal(rows.length, 2);
});

test('a chat conversation groups by its channel, and says so', () => {
  const rows = groupNotifications([
    { id: 'c2', type: 'chat_message', channelId: 'general', title: 'Нове', read: false },
    { id: 'c1', type: 'chat_message', channelId: 'general', title: 'Нове', read: false },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '2 нові повідомлення в розмові');
  // A record written before `channelId` existed is read from its link instead.
  assert.equal(
    notificationGroupKey({ type: 'chat_message', link: '/chat?channel=general' }),
    'chat:general',
  );
});

test('the task key comes out of the link, and nothing is read to find it', () => {
  assert.equal(notificationIssueKey({ link: '/proj/issue/QT-12?view=chat' }), 'QT-12');
  // A record from before human URLs carries a document id, not a key.
  assert.equal(notificationIssueKey({ link: '/proj/issue/8f2a1c9d0b' }), '');
  assert.equal(notificationIssueKey({}), '');
});

test('the counted words agree with the numbers they follow', () => {
  const rows = count => groupNotifications(
    Array.from({ length: count }, (_, index) => comment(`n${index}`, 'issue-a')),
  )[0].title;
  assert.equal(rows(2), '2 нові повідомлення в QT-12');
  assert.equal(rows(5), '5 нових повідомлень в QT-12');
  assert.equal(rows(11), '11 нових повідомлень в QT-12');
  assert.equal(rows(21), '21 нове повідомлення в QT-12');
});

test('the bell draws rows, not records', async () => {
  const header = await readFile(new URL('../src/components/WorkspaceHeader.jsx', import.meta.url), 'utf8');
  assert.match(header, /groupNotifications\(group\.items\)/);
  // Every action a row offers has to reach every record the row stands for.
  assert.match(header, /row\.items\.map\(item => action\?\.\(item\.id\)\)/);
  assert.match(header, /row\.items\.map\(item => removeNotification\?\.\(item\.id\)\)/);
  assert.match(header, /row\.items\.filter\(item => !item\.read\)/);
});
