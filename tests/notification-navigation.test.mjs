import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  notificationDestination,
  notificationOpenLabel,
  notificationDestinationWithOrganization,
  normalizeNotificationLink,
  withNotificationOrganization,
} from '../src/lib/utils/notificationNavigation.mjs';

test('adds organization context to app links', () => {
  assert.equal(
    withNotificationOrganization('/project-1/issue/issue-1', 'org-2'),
    '/project-1/issue/issue-1?org=org-2',
  );
});

test('preserves other query parameters and replaces stale organization context', () => {
  assert.equal(
    withNotificationOrganization('/project-1/issue/issue-1?logTime=5&org=old', 'org new'),
    '/project-1/issue/issue-1?logTime=5&org=org+new',
  );
});

test('rejects links outside the workspace', () => {
  for (const link of ['https://example.com', '//example.com', 'javascript:alert(1)', '/login', '/workspace\\evil']) {
    assert.equal(normalizeNotificationLink(link), '');
    assert.equal(withNotificationOrganization(link, 'org-1'), '');
  }
});

test('normalizes legacy workspace links', () => {
  assert.equal(withNotificationOrganization('/workspace/project-1/issue/issue-1', ''), '/project-1/issue/issue-1');
  assert.equal(withNotificationOrganization('/workspace?new=1', ''), '/?new=1');
});

test('a safe human-key link wins over legacy structured task metadata', () => {
  assert.equal(
    notificationDestination({
      link: '/project-1/issue/ENG-12',
      projectId: 'project-1',
      issueId: 'issue-1',
    }),
    '/project-1/issue/ENG-12',
  );
});

test('derives a scoped task destination when an old notification has no link', () => {
  assert.equal(
    notificationDestinationWithOrganization({
      projectId: 'project-1',
      issueId: 'issue-1',
      organizationId: 'org-1',
    }),
    '/project-1/issue/issue-1?org=org-1',
  );
});

test('keeps a calendar event deep link scoped to the right organization', () => {
  assert.equal(
    notificationDestinationWithOrganization({
      link: '/calendar/event/event-42?occurrence=2026-07-25T09%3A00%3A00.000Z',
      organizationId: 'org-1',
    }),
    '/calendar/event/event-42?occurrence=2026-07-25T09%3A00%3A00.000Z&org=org-1',
  );
});

// The card's button names its destination, and that is where the notification's
// type now lives.
test('the open button says where it goes', () => {
  assert.equal(notificationOpenLabel({ type: 'commented', issueId: 'issue-1' }), 'Відкрити чат завдання');
  assert.equal(notificationOpenLabel({ type: 'assigned', issueId: 'issue-1' }), 'Відкрити завдання');
  assert.equal(notificationOpenLabel({ type: 'deadline', issueId: 'issue-1' }), 'Відкрити завдання');
  assert.equal(notificationOpenLabel({ type: 'chat_message' }), 'Відкрити розмову');
  assert.equal(notificationOpenLabel({ type: 'calendar_reminder' }), 'Відкрити подію');
  assert.equal(notificationOpenLabel({ type: 'emergency' }), 'Відкрити профіль');
  // The same type reaches two different places; the task id is what tells them
  // apart, because a mention in the workspace chat has none.
  assert.equal(notificationOpenLabel({ type: 'mentioned', issueId: 'issue-1' }), 'Відкрити чат завдання');
  assert.equal(notificationOpenLabel({ type: 'mentioned' }), 'Відкрити розмову');
  // Nothing recognisable still gets a working button.
  assert.equal(notificationOpenLabel({ type: 'test' }), 'Перейти');
  assert.equal(notificationOpenLabel(null), 'Перейти');
});

// What the card stopped saying, and why it could never have been saying it.
test('the notification card drops the two lines that carried nothing', async () => {
  const [card, header, notifications] = await Promise.all([
    readFile(new URL('../src/components/ui/Layout/NotificationCard.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/WorkspaceHeader.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/hooks/useNotifications.js', import.meta.url), 'utf8'),
  ]);

  // The organisation is filtered three times over on the way to this card — in
  // the query, before the popup fires, and again in the bell — so its name here
  // could only ever repeat what the header already says.
  assert.match(notifications, /where\('organizationId', '==', activeOrganizationId\)/);
  assert.match(notifications, /if \(n\.organizationId !== activeOrganizationIdRef\.current\) return;/);
  assert.match(header, /const scopedNotifications = notifications\.filter\(n => n\.organizationId === activeOrgId\)/);
  assert.doesNotMatch(card, /organizationName/);
  // And the capitalised category repeated the title in the product's own words.
  assert.doesNotMatch(card, /categoryLabel|categoryColor/);
  assert.match(card, /\{openLabel\}/);
  // The badge on the sender's face could not separate twelve types across far
  // fewer glyphs, so the face is drawn on its own.
  assert.doesNotMatch(header, /absolute -bottom-\[3px\] -right-\[3px\]/);
});
