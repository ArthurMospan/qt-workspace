import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationDestination,
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

test('task metadata wins over a stale notification link', () => {
  assert.equal(
    notificationDestination({
      link: '/project-1?issue=OLD-1',
      projectId: 'project-1',
      issueId: 'issue-1',
    }),
    '/project-1/issue/issue-1',
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
      link: '/calendar?event=event-42',
      organizationId: 'org-1',
    }),
    '/calendar?event=event-42&org=org-1',
  );
});
