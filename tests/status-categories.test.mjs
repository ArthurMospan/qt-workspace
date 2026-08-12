import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  activeStatusCategoryIds,
  availableStatusesInCategory,
  backlogStatusIds,
  closedStatusIds,
  deliveredStatusIds,
  entryStatusId,
  inProgressStatusIds,
  isClosingCategory,
  isDeliveringCategory,
  resolveCategoryStatusId,
  statusCategoryColumns,
  statusCategoryMap,
  STATUS_CATEGORY_IDS,
  withStatusCategories,
} from '../src/lib/utils/statusCategories.mjs';
import {
  resolveClosedStatusIds,
  resolveDeliveredStatusIds,
  resolveEntryStatusId,
} from '../src/lib/utils/workflowDefaults.mjs';
import { normalizeWorkflowMutationInput } from '../src/lib/utils/workflowMutation.mjs';
import { hydrateWorkflowSettings } from '../src/lib/utils/workflowSettingsHydration.mjs';

const systemPriorities = () => [
  { id: 'blocker', label: 'Критичний' },
  { id: 'high', label: 'Високий' },
  { id: 'medium', label: 'Середній' },
  { id: 'low', label: 'Низький' },
];

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// A workflow saved before categories existed: no `category` anywhere, one
// `isDone` flag, two custom columns in the middle.
const legacyWorkflow = [
  { id: 'backlog', label: 'Беклог' },
  { id: 'todo', label: 'До виконання' },
  { id: 'code-review', label: 'Код-ревʼю' },
  { id: 's-1700000000', label: 'Погодження' },
  { id: 'done', label: 'Готово', isDone: true },
];

test('a workflow saved before categories keeps exactly the meaning it had', () => {
  const categories = statusCategoryMap(legacyWorkflow);
  assert.equal(categories.get('backlog'), 'backlog');
  assert.equal(categories.get('todo'), 'todo');
  assert.equal(categories.get('code-review'), 'in-progress');
  // A custom id is never guessed at by name — it is work in progress.
  assert.equal(categories.get('s-1700000000'), 'in-progress');
  assert.equal(categories.get('done'), 'done');
  // The terminal set is unchanged by the migration, which is the whole point:
  // nothing about completion, billing or velocity moves under anybody's feet.
  assert.deepEqual(closedStatusIds(legacyWorkflow), ['done']);
  assert.deepEqual(resolveClosedStatusIds(legacyWorkflow), ['done']);
});

test('the pre-category fallbacks still resolve the terminal set', () => {
  // Nothing flagged, but an id called 'done'.
  assert.deepEqual(
    closedStatusIds([{ id: 'todo', label: 'A' }, { id: 'done', label: 'B' }]),
    ['done'],
  );
  // Nothing flagged and nothing called 'done': the last column closes tasks.
  assert.deepEqual(
    closedStatusIds([{ id: 'a', label: 'A' }, { id: 'z', label: 'Z' }]),
    ['z'],
  );
  // Several flagged statuses all count — «Готово», «Скасовано», «Дубль».
  assert.deepEqual(
    closedStatusIds([
      { id: 'a', label: 'A' },
      { id: 'ok', label: 'OK', isDone: true },
      { id: 'dup', label: 'Дубль', isDone: true },
    ]),
    ['ok', 'dup'],
  );
  // No workflow at all still answers, so no server route can crash on it.
  assert.deepEqual(resolveClosedStatusIds(undefined), ['done']);
  assert.deepEqual(resolveClosedStatusIds([]), ['done']);
});

test('an explicit category outranks every fallback', () => {
  const categories = statusCategoryMap([
    { id: 'inbox', label: 'Вхідні', category: 'todo' },
    { id: 'done', label: 'Готово', category: 'in-progress' },
    { id: 'shipped', label: 'Відправлено', category: 'done' },
  ]);
  // The first column is not automatically the backlog…
  assert.equal(categories.get('inbox'), 'todo');
  // …and an id of 'done' is not automatically terminal.
  assert.equal(categories.get('done'), 'in-progress');
  assert.deepEqual(closedStatusIds([
    { id: 'inbox', label: 'Вхідні', category: 'todo' },
    { id: 'done', label: 'Готово', category: 'in-progress' },
    { id: 'shipped', label: 'Відправлено', category: 'done' },
  ]), ['shipped']);
});

test('cancelling closes a task, exactly as flagging it done did', () => {
  const workflow = [
    { id: 'todo', label: 'До виконання', category: 'todo' },
    { id: 'done', label: 'Готово', category: 'done' },
    { id: 'dropped', label: 'Не актуально', category: 'cancelled' },
  ];
  assert.equal(isClosingCategory('cancelled'), true);
  assert.deepEqual(closedStatusIds(workflow), ['done', 'dropped']);
});

test('closed and delivered are two different questions', () => {
  const workflow = [
    { id: 'todo', label: 'До виконання', category: 'todo' },
    { id: 'qa', label: 'QA', category: 'in-progress' },
    { id: 'done', label: 'Готово', category: 'done' },
    { id: 'dropped', label: 'Не актуально', category: 'cancelled' },
  ];
  // Nothing left to do — a cancelled task must stop being overdue and must stop
  // blocking whatever it blocked.
  assert.deepEqual(closedStatusIds(workflow), ['done', 'dropped']);
  // Something was produced — a sprint whose work was dropped is not finished.
  assert.deepEqual(deliveredStatusIds(workflow), ['done']);
  assert.equal(isDeliveringCategory('cancelled'), false);
  assert.equal(isClosingCategory('cancelled'), true);
});

test('a workflow that only ever cancels still reports something', () => {
  // No `done` category at all: a flat zero for every percentage would be a worse
  // answer than treating what closes tasks as what finishes them.
  const workflow = [
    { id: 'todo', label: 'До виконання', category: 'todo' },
    { id: 'dropped', label: 'Скасовано', category: 'cancelled' },
  ];
  assert.deepEqual(deliveredStatusIds(workflow), ['dropped']);
  assert.deepEqual(resolveDeliveredStatusIds(undefined), ['done']);
});

test('a workflow with no cancelled status answers both questions the same way', () => {
  // Which is why this split changes nothing for anybody today, and everything on
  // the day somebody adds «Скасовано».
  assert.deepEqual(
    closedStatusIds(legacyWorkflow),
    deliveredStatusIds(legacyWorkflow),
  );
});

test('materialising a workflow writes a category and an isDone that agrees with it', () => {
  const materialised = withStatusCategories(legacyWorkflow);
  assert.deepEqual(
    materialised.map(status => [status.id, status.category, status.isDone]),
    [
      ['backlog', 'backlog', false],
      ['todo', 'todo', false],
      ['code-review', 'in-progress', false],
      ['s-1700000000', 'in-progress', false],
      ['done', 'done', true],
    ],
  );
});

test('category columns are the same five for everyone, in one fixed order', () => {
  assert.deepEqual(STATUS_CATEGORY_IDS, [
    'backlog', 'todo', 'in-progress', 'done', 'cancelled',
  ]);
  // Declared out of order, rendered in canonical order.
  assert.deepEqual(
    activeStatusCategoryIds([
      { id: 'x', label: 'X', category: 'done' },
      { id: 'y', label: 'Y', category: 'backlog' },
      { id: 'z', label: 'Z', category: 'in-progress' },
    ]),
    ['backlog', 'in-progress', 'done'],
  );
  // A category no status maps to is not a column anybody could drop into.
  assert.deepEqual(
    statusCategoryColumns(legacyWorkflow).map(column => column.id),
    ['backlog', 'todo', 'in-progress', 'done'],
  );
  for (const column of statusCategoryColumns(legacyWorkflow)) {
    assert.ok(column.label, `${column.id} needs a label`);
    assert.match(column.color, /^#[0-9a-f]{6}$/i);
  }
});

test('«в роботі» and «беклог» are answers from the data, not positions in a list', () => {
  assert.deepEqual(inProgressStatusIds(legacyWorkflow), ['code-review', 's-1700000000']);
  assert.deepEqual(backlogStatusIds(legacyWorkflow), ['backlog']);
  // The old rule was `statuses.slice(1)` minus terminal ones, which counted
  // «До виконання» as work in progress.
  assert.ok(!inProgressStatusIds(legacyWorkflow).includes('todo'));
});

test('a drop on a category column resolves a status of the task’s own project', () => {
  const workflow = [
    { id: 'backlog', label: 'Беклог', category: 'backlog' },
    { id: 'code-review', label: 'Код-ревʼю', category: 'in-progress' },
    { id: 'qa', label: 'QA', category: 'in-progress' },
    { id: 'done', label: 'Готово', category: 'done' },
  ];

  // Nothing hidden: the first status of the category.
  assert.equal(resolveCategoryStatusId('in-progress', workflow), 'code-review');
  // The project switched that column off, so the drop lands in the next one of
  // the same category rather than being refused.
  assert.equal(
    resolveCategoryStatusId('in-progress', workflow, { hiddenStatusIds: ['code-review'] }),
    'qa',
  );
  // Already in the target category: moving inside one category is a reorder, so
  // the status must not change.
  assert.equal(
    resolveCategoryStatusId('in-progress', workflow, { currentStatusId: 'qa' }),
    'qa',
  );
  // …unless the status it is sitting in is hidden in this project, which is the
  // case the board's «Приховані» lane is for.
  assert.equal(
    resolveCategoryStatusId('in-progress', workflow, {
      currentStatusId: 'code-review',
      hiddenStatusIds: ['code-review'],
    }),
    'qa',
  );
  // Every status of the category switched off: the caller has to say so.
  assert.equal(
    resolveCategoryStatusId('in-progress', workflow, {
      hiddenStatusIds: ['code-review', 'qa'],
    }),
    null,
  );
  assert.equal(resolveCategoryStatusId('nonsense', workflow), null);
  assert.deepEqual(
    availableStatusesInCategory('in-progress', workflow, {
      hiddenStatusIds: ['code-review'],
    }).map(status => status.id),
    ['qa'],
  );
  assert.deepEqual(availableStatusesInCategory('nonsense', workflow), []);
});

test('new work lands in a backlog column, never in a position', () => {
  assert.equal(entryStatusId(legacyWorkflow), 'backlog');
  // No backlog category at all: the first status that does not close a task.
  assert.equal(entryStatusId([
    { id: 'shipped', label: 'Готово', category: 'done' },
    { id: 'doing', label: 'У роботі', category: 'in-progress' },
  ]), 'doing');
  // Hidden columns are honoured, so a fallback is never a column the project
  // has switched off.
  assert.equal(resolveEntryStatusId(legacyWorkflow, ['backlog']), 'todo');
  assert.equal(resolveEntryStatusId(legacyWorkflow, ['backlog', 'todo']), 'code-review');
  // A workflow that was never saved still answers.
  assert.equal(resolveEntryStatusId(undefined), 'backlog');
  assert.equal(resolveEntryStatusId(undefined, ['backlog']), 'todo');
});

test('saving a workflow persists the category and derives isDone from it', () => {
  const result = normalizeWorkflowMutationInput({
    workflow: {
      statuses: [
        { id: 'backlog', label: 'Беклог', color: '#9a9a9a' },
        { id: 'done', label: 'Готово', color: '#10b981', isDone: true },
      ],
      types: [{ id: 'task', label: 'Задача' }],
      priorities: systemPriorities(),
      labels: [],
      positions: [{ id: 'dev', label: 'Розробник', hourlyRate: 30 }],
    },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.value.workflow.statuses, [
    { id: 'backlog', label: 'Беклог', color: '#9a9a9a', category: 'backlog', isDone: false },
    { id: 'done', label: 'Готово', color: '#10b981', isDone: true, category: 'done' },
  ]);
});

test('a saved workflow always has somewhere to start and somewhere to finish', () => {
  const sections = statuses => ({
    workflow: {
      statuses,
      types: [{ id: 'task', label: 'Задача' }],
      priorities: systemPriorities(),
      labels: [],
      positions: [],
    },
  });

  assert.equal(
    normalizeWorkflowMutationInput(sections([
      { id: 'a', label: 'A', category: 'todo' },
      { id: 'b', label: 'B', category: 'in-progress' },
    ])).error.code,
    'MISSING_TERMINAL_STATUS',
  );
  assert.equal(
    normalizeWorkflowMutationInput(sections([
      { id: 'a', label: 'A', category: 'done' },
      { id: 'b', label: 'B', category: 'cancelled' },
    ])).error.code,
    'MISSING_OPEN_STATUS',
  );
  // An unknown category is read the way a document with no category is read,
  // so an older or third-party client cannot lock itself out of saving.
  const unknown = normalizeWorkflowMutationInput(sections([
    { id: 'a', label: 'A', category: 'wat' },
    { id: 'done', label: 'Готово' },
  ]));
  assert.equal(unknown.error, undefined);
  assert.equal(unknown.value.workflow.statuses[0].category, 'backlog');
  assert.equal(unknown.value.workflow.statuses[1].category, 'done');
});

test('Settings opens on resolved categories, so it never saves on its own', () => {
  const hydrated = hydrateWorkflowSettings({ statuses: legacyWorkflow }, {});
  assert.deepEqual(
    hydrated.statuses.map(status => status.category),
    ['backlog', 'todo', 'in-progress', 'in-progress', 'done'],
  );
  // Idempotent: hydrating what was already hydrated changes nothing, which is
  // what makes the loaded payload a usable autosave baseline.
  assert.deepEqual(
    hydrateWorkflowSettings({ statuses: hydrated.statuses }, {}).statuses,
    hydrated.statuses,
  );
});

test('every surface that spans projects groups by category, never by status name', async () => {
  const [myTasks, board, listView, hook] = await Promise.all([
    read('../src/app/(app)/my/page.js'),
    read('../src/components/workspace/AgileBoard.jsx'),
    read('../src/components/ui/TaskManagement/TaskListView.jsx'),
    read('../src/lib/hooks/useAllMyTasks.js'),
  ]);

  // «Мої завдання» — both views.
  assert.match(myTasks, /<AgileBoard[\s\S]{0,600}groupBy="category"/);
  assert.match(myTasks, /<TaskListView[\s\S]{0,420}groupBy="category"/);
  // Its columns are categories, so what a person folds away is a category too.
  assert.match(myTasks, /qt_my_tasks_hidden_categories/);
  assert.doesNotMatch(myTasks, /'qt_my_tasks_hidden'/);
  // A drop names a category and the hook resolves the project's own status.
  assert.match(myTasks, /moveTaskToCategory\(issueId, categoryId, position/);
  assert.match(hook, /resolveCategoryStatusId\(categoryId, statuses, \{/);
  // Both organisms accept the mode; neither has a second copy of the grouping.
  assert.match(board, /groupBy = 'status'/);
  assert.match(listView, /groupBy = 'status'/);
  assert.match(board, /statusCategoryById\.get\(columnOf\(issue\)\)/);
});

test('nothing decides completion or «в роботі» by a status’s position any more', async () => {
  const [dashboard, analytics, analyticsTab, workload, hook, defaults] = await Promise.all([
    read('../src/app/(app)/page.js'),
    read('../src/app/(app)/analytics/page.js'),
    read('../src/components/workspace/AnalyticsTab.jsx'),
    read('../src/components/workspace/WorkloadTab.jsx'),
    read('../src/lib/hooks/useWorkflowConfig.js'),
    read('../src/lib/utils/workflowDefaults.mjs'),
  ]);

  // The comment that records the old rule may name it; the code may not run it.
  assert.doesNotMatch(dashboard, /statuses\.slice\(1\)\.filter/);
  assert.match(dashboard, /inProgressStatusIds\(statuses\)/);
  for (const [name, source] of [
    ['analytics', analytics],
    ['AnalyticsTab', analyticsTab],
    ['WorkloadTab', workload],
  ]) {
    assert.doesNotMatch(source, /columnId === 'in-progress'/, name);
    assert.match(source, /inProgressStatusIds\(statuses\)/, name);
  }
  for (const [name, source] of [['analytics', analytics], ['AnalyticsTab', analyticsTab]]) {
    assert.doesNotMatch(source, /firstStatusId/, name);
    assert.match(source, /backlogStatusIds\(statuses\)/, name);
  }
  // One definition of "finished", shared by the client and the server routes.
  assert.match(hook, /return resolveClosedStatusIds\(list\)/);
  assert.match(defaults, /closedStatusIds\(statuses\)/);
});

test('what measures output reads delivered; what asks "is there work left" reads closed', async () => {
  const [dashboard, analytics, analyticsTab, velocity, workload, team, billing] = await Promise.all([
    read('../src/app/(app)/page.js'),
    read('../src/app/(app)/analytics/page.js'),
    read('../src/components/workspace/AnalyticsTab.jsx'),
    read('../src/components/workspace/VelocityTab.jsx'),
    read('../src/components/workspace/WorkloadTab.jsx'),
    read('../src/components/workspace/ProjectTeamTab.jsx'),
    read('../src/components/workspace/BillingTab.jsx'),
  ]);

  // Every percentage, every throughput number, and the invoice preset.
  assert.match(dashboard, /const deliveredSet = new Set\(deliveredStatusIds\)/);
  assert.match(analytics, /const done\s+= issues\.filter\(i => deliveredSet\.has/);
  assert.match(analyticsTab, /const done\s+= filteredIssues\.filter\(i => deliveredSet\.has/);
  assert.match(velocity, /function WeeklyVelocityChart\([^)]*deliveredSet/);
  assert.match(workload, /done: actionableIssues\.filter\(issue => \(\s*\n\s*deliveredSet\.has/);
  assert.match(team, /const done = memberIssues\.filter\(issue => deliveredSet\.has/);
  assert.match(billing, /deliveredStatusIds\.includes\(issue\.columnId \|\| issue\.status\)/);

  // And the ones that must stay closed: a cancelled task is not overdue, does not
  // block anything, and is not work remaining on a burndown.
  assert.match(analytics, /due\.getTime\(\) < now && !closedSet\.has/);
  assert.match(velocity, /function BurndownChart\([^)]*closedSet/);
  assert.match(workload, /const openItems = memberIssues\.filter\(issue => !closedSet\.has/);
});

test('no writer guesses the incoming column by the name «backlog»', async () => {
  for (const path of [
    '../src/app/api/issues/route.js',
    '../src/app/api/v1/tasks/route.js',
    '../src/lib/server/telegram.js',
    '../src/lib/server/youtrackImporter.js',
  ]) {
    const source = await read(path);
    assert.match(source, /resolveEntryStatusId\(/, path);
    assert.doesNotMatch(source, /includes\('backlog'\)\s*$/m, path);
    assert.doesNotMatch(source, /\?\s*'backlog'/, path);
  }
});
