import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('mobile keeps Kanban as a first-class horizontally swipeable board', () => {
  const board = read('src/components/workspace/AgileBoard.jsx');
  assert.match(board, /w-\[82vw\] max-w-\[320px\]/);
  assert.doesNotMatch(board, /max-(?:sm|md):hidden[^\n]*AgileBoard/);
});

test('task chat exposes an unread boundary and reads it only after visibility', () => {
  const timeline = read('src/components/workspace/UnifiedTimeline.jsx');
  const detail = read('src/components/workspace/IssueDetail.jsx');
  assert.match(timeline, /<UnreadDivider count=\{unreadCommentIds\.length\}/);
  assert.match(timeline, /new IntersectionObserver/);
  assert.match(timeline, /scrollToUnread/);
  assert.match(detail, /label: 'Чат'.*count: unreadTaskChatCount/);
});

test('dense analytics, timesheet and invoice data have dedicated mobile cards', () => {
  const workspaceAnalytics = read('src/app/(app)/analytics/page.js');
  const projectAnalytics = read('src/components/workspace/AnalyticsTab.jsx');
  const timesheet = read('src/components/workspace/TimesheetTab.jsx');
  const billing = read('src/components/workspace/BillingTab.jsx');

  assert.match(workspaceAnalytics, /space-y-2 md:hidden/);
  assert.match(workspaceAnalytics, /hidden overflow-x-auto md:block/);
  assert.match(projectAnalytics, /space-y-2 md:hidden/);
  assert.match(projectAnalytics, /hidden overflow-x-auto md:block/);
  assert.match(timesheet, /space-y-3 lg:hidden/);
  assert.match(timesheet, /hidden overflow-x-auto rounded-\[16px\] bg-white lg:block/);
  assert.match(billing, /mb-2 space-y-2 sm:hidden/);
  assert.match(billing, /hidden w-full sm:table/);
});

test('the task composer respects the device safe area', () => {
  const css = read('src/app/globals.css');
  assert.match(css, /timeline-composer[^}]*calc\(20px \+ var\(--sab\)\)/s);
});
