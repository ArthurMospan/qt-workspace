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

test('the card ends in a status distribution, not a row of counts', () => {
  // Five numbers set identically meant nothing on the card was the point. The
  // last row is one band now: where this project's work is sitting, in the
  // categories' own colours, so a colour means the same thing here as on a
  // board column and a list section dot.
  assert.match(projectPage, /function ProjectStatusBand/);
  assert.match(projectPage, /<ProjectStatusBand segments=\{stats\.segments\} total=\{stats\.banded\} isLarge=\{isLarge\} \/>/);
  assert.match(projectPage, /STATUS_CATEGORIES\[categoryId\]\.color/);
  assert.match(projectPage, /STATUS_CATEGORY_IDS/);
  // Never re-derived: the one module that decides what a status means is asked,
  // and a status the workflow no longer has is left out rather than guessed at.
  assert.match(projectPage, /statusCategoryById\.get\(statusId \|\| entryStatus\)/);
  assert.doesNotMatch(projectPage, /\{stats\.inProgress\}/);
  // Not the full width of the card: a bar that runs edge to edge reads as a
  // rule under the text rather than as a reading. The large one is heavier and
  // names its segments on hover; the small one is a glance and says nothing.
  assert.match(projectPage, /max-w-\[240px\]' : 'max-w-\[148px\]/);
  assert.match(projectPage, /isLarge \? 'h-\[7px\]' : 'h-\[5px\]'/);
  assert.match(projectPage, /group-hover\/band:opacity-100/);
  assert.match(projectPage, /role="img"[\s\S]{0,200}Розподіл завдань за статусом/);
  // Two marks survive the row because neither is a status: what is late, and
  // who named you. Both only when they are true.
  assert.match(projectPage, /CalendarClock[\s\S]{0,300}\{stats\.overdue\}[\s\S]{0,100}прострочено/);
  assert.match(projectPage, /<TaskCounters mentions=\{mentionCount\} className="ml-auto" \/>/);
  assert.doesNotMatch(projectPage, /AtSign/);
});

test('the last-action block is a target, not a caption', () => {
  // The whole block links to the task and answers the pointer; only the title
  // used to be clickable, with nothing on the card saying so.
  assert.match(projectPage, /stats\.lastAction && \([\s\S]{0,700}<Link[\s\S]{0,400}hover:bg-canvas/);
});
