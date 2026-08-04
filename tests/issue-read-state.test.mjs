import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIssueUnread,
  issueActivityCursor,
  timestampMillis,
} from '../src/lib/utils/issueReadState.mjs';

test('timestampMillis normalizes Firestore timestamps, dates and milliseconds', () => {
  assert.equal(timestampMillis({ toMillis: () => 42 }), 42);
  assert.equal(timestampMillis(new Date(84)), 84);
  assert.equal(timestampMillis(126), 126);
  assert.equal(timestampMillis(null), 0);
});

test('issueActivityCursor intentionally ignores legacy updatedAt-only issues', () => {
  assert.equal(issueActivityCursor({ updatedAt: new Date(100) }), 0);
  assert.equal(issueActivityCursor({ lastActivityAt: new Date(200) }), 200);
});

test('an activity newer than the per-issue cursor is unread', () => {
  const issue = {
    id: 'issue-a',
    lastActivityAt: new Date(200),
    lastActivityActorId: 'member-b',
  };
  assert.equal(isIssueUnread(issue, new Date(100), 'member-a'), true);
  assert.equal(isIssueUnread(issue, new Date(200), 'member-a'), false);
});

test('a user never gets an unread dot for their own activity', () => {
  const issue = {
    id: 'issue-a',
    lastActivityAt: new Date(200),
    lastActivityActorId: 'member-a',
  };
  assert.equal(isIssueUnread(issue, null, 'member-a'), false);
});

test('missing activity, identity or issue id stays read', () => {
  assert.equal(isIssueUnread({ id: 'issue-a' }, null, 'member-a'), false);
  assert.equal(isIssueUnread({ id: 'issue-a', lastActivityAt: new Date(200) }, null, null), false);
  assert.equal(isIssueUnread({ lastActivityAt: new Date(200) }, null, 'member-a'), false);
});
