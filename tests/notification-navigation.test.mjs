import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNotificationLink,
  withNotificationOrganization,
} from '../src/lib/utils/notificationNavigation.mjs';

test('adds organization context to workspace links', () => {
  assert.equal(
    withNotificationOrganization('/workspace/project-1/issue/issue-1', 'org-2'),
    '/workspace/project-1/issue/issue-1?org=org-2',
  );
});

test('preserves other query parameters and replaces stale organization context', () => {
  assert.equal(
    withNotificationOrganization('/workspace/project-1/issue/issue-1?logTime=5&org=old', 'org new'),
    '/workspace/project-1/issue/issue-1?logTime=5&org=org+new',
  );
});

test('rejects links outside the workspace', () => {
  for (const link of ['https://example.com', '//example.com', 'javascript:alert(1)', '/login', '/workspace\\evil']) {
    assert.equal(normalizeNotificationLink(link), '');
    assert.equal(withNotificationOrganization(link, 'org-1'), '');
  }
});

test('keeps safe links usable when an old notification has no organization id', () => {
  assert.equal(withNotificationOrganization('/workspace?new=1', ''), '/workspace?new=1');
});
