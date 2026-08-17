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
  // A face in the stack says whose it is on hover; nothing else on the card
  // names the project's people.
  assert.match(projectPage, /<UserAvatar key=\{uid\}[^/]*tooltip/);
});

test('project-card footer uses literal task, progress and assignee semantics', () => {
  assert.match(projectPage, /ListTodo[\s\S]{0,300}\{stats\.total\}[\s\S]{0,100}завдань/);
  // Not «в роботі»: that is the name of a status category, and the card was
  // read as counting only that category rather than everything still open.
  assert.match(projectPage, /CircleDotDashed[\s\S]{0,300}\{stats\.active\}[\s\S]{0,100}активних/);
  assert.doesNotMatch(projectPage, /\{stats\.inProgress\}/);
  // «N моїх» counted something nobody acts on. What is late, who named you and
  // what is unread are the three facts that make a card worth opening — the
  // same ones a task card carries.
  assert.match(projectPage, /CalendarClock[\s\S]{0,300}\{stats\.overdue\}[\s\S]{0,100}прострочено/);
  assert.match(projectPage, /MessageSquare[\s\S]{0,300}\{unreadCount\}[\s\S]{0,100}нових/);
  // Mentions are the task card's own mark, at the end of the row where the eye
  // stops — not a second hand-drawn «вам» counter.
  assert.match(projectPage, /<TaskCounters mentions=\{mentionCount\} className="ml-auto" \/>/);
  assert.doesNotMatch(projectPage, /AtSign/);
});

test('the last-action block is a target, not a caption', () => {
  // The whole block links to the task and answers the pointer; only the title
  // used to be clickable, with nothing on the card saying so.
  assert.match(projectPage, /stats\.lastAction && \([\s\S]{0,700}<Link[\s\S]{0,400}hover:bg-\[#f0f0f0\]/);
});
