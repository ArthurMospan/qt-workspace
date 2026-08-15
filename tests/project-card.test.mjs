import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectPage = readFileSync(new URL('../src/app/(app)/page.js', import.meta.url), 'utf8');

test('project cards keep the familiar team-first composition', () => {
  assert.match(projectPage, /project\.team \|\| \[\][\s\S]{0,500}<UserAvatar/);
  assert.match(projectPage, /md:col-span-2 md:row-span-2/);
  assert.doesNotMatch(projectPage, />Ви в команді</);
  assert.doesNotMatch(projectPage, />Внутрішній</);
  assert.doesNotMatch(projectPage, />Спільний</);
});

test('project-card footer uses literal task, progress and assignee semantics', () => {
  assert.match(projectPage, /ListTodo[\s\S]{0,300}\{stats\.total\}[\s\S]{0,100}завдань/);
  assert.match(projectPage, /CircleDotDashed[\s\S]{0,300}\{stats\.inProgress\}[\s\S]{0,100}в роботі/);
  // «N моїх» counted something nobody acts on. What is late, who named you and
  // what is unread are the three facts that make a card worth opening — the
  // same ones a task card carries.
  assert.match(projectPage, /CalendarClock[\s\S]{0,300}\{stats\.overdue\}[\s\S]{0,100}прострочено/);
  assert.match(projectPage, /AtSign[\s\S]{0,300}\{mentionCount\}[\s\S]{0,100}вам/);
  assert.match(projectPage, /MessageSquare[\s\S]{0,300}\{unreadCount\}[\s\S]{0,100}нових/);
  assert.match(projectPage, /<TaskCounters mentions=\{mentionCount\} unread=\{unreadCount > 0\}/);
});
