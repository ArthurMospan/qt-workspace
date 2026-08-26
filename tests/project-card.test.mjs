import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectPage = readFileSync(new URL('../src/app/(app)/page.js', import.meta.url), 'utf8');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

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
  // Full width, and the last line on the card: a short bar floating in a wide
  // card reads as a fragment of something, and every segment needs enough room
  // to be a target rather than a sliver.
  assert.match(projectPage, /flex w-full gap-\[2px\] overflow-hidden rounded-full bg-chart-track/);
  assert.match(projectPage, /isLarge \? 'h-\[8px\]' : 'h-\[6px\]'/);
  assert.doesNotMatch(projectPage, /max-w-\[240px\]/);
  // Each segment names itself, and only itself. A legend under the bar meant
  // reading five labels to learn about the one colour under the pointer.
  assert.match(projectPage, /title=\{`\$\{segment\.label\}: \$\{segment\.count\}`\}/);
  assert.doesNotMatch(projectPage, /group-hover\/band/);
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

// «@ 3» on a project card, end to end.
//
// The counter has been on the card the whole time and had never once been seen,
// which is the same evidence for "it is broken" as for "nobody has been named
// in a task lately". So the contract is pinned instead of argued about: the
// three places that have to agree on one notification shape are read together,
// and if any of them stops carrying the project, this fails rather than the
// card quietly going blank for another few months.
test('a mention in a task counts towards its project on the dashboard', () => {
  const timeline = read('../src/components/workspace/UnifiedTimeline.jsx');
  const route = read('../src/app/api/notifications/route.js');

  // 1. The task chat says which project it is naming you in.
  assert.match(timeline, /type: 'mentioned',[\s\S]{0,300}projectId,/);
  // 2. The route that writes the document keeps that field.
  assert.match(route, /const projectId = cleanText\(payload\.projectId, 128\)/);
  assert.match(route, /type, title, body, link: scopedLink, issueId, projectId, organizationId/);
  // 3. The card counts exactly that, unread, in this organization — no other
  //    notification type, and never one belonging to a different workspace.
  assert.match(projectPage, /!item\.read[\s\S]{0,120}item\.type === 'mentioned'[\s\S]{0,120}item\.projectId === project\.id[\s\S]{0,120}item\.organizationId === activeOrgId/);
  // And it is drawn by the task card's own mark, so being named looks the same
  // wherever it is counted.
  assert.match(projectPage, /<TaskCounters mentions=\{mentionCount\}/);
});
