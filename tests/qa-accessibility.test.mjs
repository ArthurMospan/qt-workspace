import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { auditA11y } from '../scripts/kit-a11y.mjs';
import { computeSidebarTheme, contrastRatio } from '../src/lib/utils/sidebarTheme.js';
import { createUkrainianDndAnnouncements } from '../src/lib/utils/dndAnnouncements.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('quiet text tokens and generated sidebar themes keep AA contrast', () => {
  assert.deepEqual(auditA11y().contrastFailures, []);

  for (let channel = 0; channel <= 255; channel += 17) {
    const hex = `#${channel.toString(16).padStart(2, '0').repeat(3)}`;
    const theme = computeSidebarTheme(hex);
    for (const token of ['text', 'muted', 'mutedProject', 'mutedHeader']) {
      assert.ok(
        contrastRatio(theme[token], theme.bg) >= 4.5,
        `${token} must pass on custom sidebar ${hex}`,
      );
    }
  }
});

test('dynamic control names are queued for runtime verification instead of accepted as proof', () => {
  const audit = auditA11y();
  assert.ok(audit.runtimeNameVerification.length > 0);
  assert.ok(audit.runtimeNameVerification.some(item => (
    item.location.includes('src/components/ui/Tabs.jsx')
    && item.attributes.includes('aria-label')
  )));
});

test('the known board controls, tab icons, headings and breadcrumbs carry accessible semantics', async () => {
  const [project, mine, topHeader, breadcrumb, board, analytics] = await Promise.all([
    read('src/app/(app)/[projectId]/ProjectBoardClient.jsx'),
    read('src/app/(app)/my/page.js'),
    read('src/components/ui/Layout/TopHeader.jsx'),
    read('src/components/ui/Navigation/Breadcrumb.jsx'),
    read('src/components/workspace/AgileBoard.jsx'),
    read('src/app/(app)/analytics/page.js'),
  ]);

  for (const label of [
    'Фільтр за спринтом',
    'Фільтр за виконавцем',
    'Фільтр за пріоритетом',
    'Фільтр за типом завдання',
  ]) assert.match(project, new RegExp(`ariaLabel="${label}"`));

  for (const source of [project, mine]) {
    assert.match(source, /title: 'Дошка', ariaLabel: 'Дошка'/);
    assert.match(source, /title: 'Список', ariaLabel: 'Список'/);
  }
  assert.match(topHeader, /aria-label=\{unreadCount > 0/);
  assert.match(topHeader, /aria-label="Відкрити меню користувача"/);
  assert.match(breadcrumb, /<li key=\{index\}/);
  assert.doesNotMatch(breadcrumb, /<React\.Fragment/);
  assert.doesNotMatch(board, /<h3 className="ui-type-column-title/);
  assert.match(board, /<h2 className="ui-type-column-title/);
  // The projects table used to end each row with a 24px "Відкрити →" link that
  // only appeared on hover — a target you had to find before you could hit it.
  // `DataTable` makes the identifying cell of every row the link instead, so
  // the target is the row, and it is there whether or not a pointer is.
  assert.match(analytics, /<DataTable[\s\S]{0,400}rowHref=/);
  const dataTable = await read('src/components/ui/DataDisplay/DataTable.jsx');
  assert.match(dataTable, /column === leadColumn && href \?[\s\S]{0,120}<a href=\{href\}/);
  assert.doesNotMatch(analytics, /sm:opacity-0 sm:group-hover:opacity-100/);
});

test('drag announcements use Ukrainian labels and never expose droppable ids', () => {
  const messages = [];
  const announcements = createUkrainianDndAnnouncements({
    itemLabel: () => 'DES-42',
    listLabel: id => ({ backlog: 'Беклог', 'in-progress': 'У роботі' })[id],
  });
  const provided = { announce: message => messages.push(message) };
  const start = {
    draggableId: 'internal-issue-id',
    source: { droppableId: 'backlog', index: 1 },
  };
  announcements.onDragStart(start, provided);
  announcements.onDragUpdate({
    ...start,
    destination: { droppableId: 'in-progress', index: 0 },
  }, provided);
  announcements.onDragEnd({
    ...start,
    reason: 'DROP',
    destination: { droppableId: 'in-progress', index: 0 },
  }, provided);

  assert.equal(messages.length, 3);
  assert.ok(messages.every(message => /[А-ЯІЇЄа-яіїє]/.test(message)));
  assert.ok(messages.some(message => message.includes('Беклог')));
  assert.ok(messages.some(message => message.includes('У роботі')));
  assert.ok(messages.every(message => !message.includes('in-progress')));
  assert.ok(messages.every(message => !message.includes('internal-issue-id')));
});
