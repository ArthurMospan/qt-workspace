import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('QUI-77 keeps task detail additions compact and floating menus stationary', async () => {
  const [issueDetail, popover, dropdown, select] = await Promise.all([
    read('../src/components/workspace/IssueDetail.jsx'),
    read('../src/components/ui/Navigation/Popover.jsx'),
    read('../src/components/ui/Navigation/Dropdown.jsx'),
    read('../src/components/ui/Select.jsx'),
  ]);
  const mainSections = issueDetail.slice(
    issueDetail.indexOf('{/* MAIN SECTIONS PANEL */}'),
    issueDetail.indexOf('{/* TIME LOGS LIST */}'),
  );

  assert.match(issueDetail, /<Popover[\s\S]{0,180}align="start"[\s\S]{0,180}hideArrow/);
  assert.match(issueDetail, /padding=\{isExternalReporter \? '16px' : '6px'\}/);
  assert.match(issueDetail, /triggerClassName="inline-flex"/);
  assert.match(issueDetail, /Написати в чат[\s\S]{0,80}<\/Button>/);
  assert.doesNotMatch(popover, /animate-in|zoom-in|slide-in/);
  assert.doesNotMatch(dropdown, /animate-in|zoom-in|slide-in/);
  assert.doesNotMatch(mainSections, /border-t border-line/);
  assert.doesNotMatch(mainSections, /<FormGroup label="(?:Зв’язок|Завдання)"/);
  assert.match(mainSections, /ariaLabel="Тип зв’язку"/);
  assert.match(mainSections, /ariaLabel="Пов’язане завдання"/);
  assert.match(select, /aria-label=\{ariaLabel\}/);
  assert.match(
    mainSections,
    /\{showSubInput && \([\s\S]{0,180}<Surface preset="compact-bordered-card"/,
  );
  assert.match(mainSections, /onClick=\{handleAddSubtask\}/);
  assert.ok(
    mainSections.indexOf('aria-label="Додати мітку"') > mainSections.indexOf('{showLinkInput &&'),
    'the add actions must stay below the shared grey detail surface',
  );
});

test('QUI-76 uses the shared deterministic avatar in project activity', async () => {
  const source = await read('../src/app/(app)/page.js');

  assert.match(source, /actorUser:\s*actorUser\s*\|\|\s*\{/);
  assert.match(source, /<UserAvatar user=\{stats\.lastAction\.actorUser\} size=\{28\} \/>/);
  assert.doesNotMatch(source, /stats\.lastAction\.actor\.slice\(0,\s*2\)/);
});

test('QUI-75 exposes status visibility settings in both My Tasks views', async () => {
  const source = await read('../src/app/(app)/my/page.js');
  const settingsButton = source.match(
    /<Button[\s\S]{0,240}title="Налаштування видимості статусів"[\s\S]{0,40}\/>/,
  );

  assert.ok(settingsButton, 'the visibility settings action must always be rendered');
  assert.doesNotMatch(settingsButton[0], /viewMode === 'kanban'/);
  assert.match(source, /<TaskListView[\s\S]{0,420}hiddenStatusIds=\{hiddenColumns\}/);
  assert.match(source, /<StatusVisibilityPicker[\s\S]{0,180}hiddenStatusIds=\{hiddenColumns\}/);
});

test('QUI-74 gives sprint backlog cards the canonical Kanban card width', async () => {
  const source = await read('../src/app/(app)/sprints/page.js');

  assert.match(
    source,
    /isBacklogCol \? 'px-\[8px\]' : 'px-4'/,
  );
  assert.match(
    source,
    /w-\[82vw\] max-w-\[320px\][^"]*md:w-\[280px\] md:max-w-none/,
  );
});

test('QUI-73 and QUI-81 show newly created sprint, backlog and board tasks first', async () => {
  const [source, createRoute, board] = await Promise.all([
    read('../src/app/(app)/sprints/page.js'),
    read('../src/app/api/issues/route.js'),
    read('../src/components/workspace/AgileBoard.jsx'),
  ]);

  assert.match(source, /useState\('order'\)/);
  assert.match(source, /\[sortDir,\s*setSortDir\]\s*=\s*useState\('asc'\)/);
  assert.match(source, /return sortDir === 'asc' \? res : -res/);
  assert.match(createRoute, /order:\s*-next/);
  assert.match(board, /\.sort\(\(a, b\) => \(a\.order \?\? 0\) - \(b\.order \?\? 0\)\)/);
});

test('QUI-80 gives every FilterBar selector a semantic icon role', async () => {
  const [select, project, my, sprints, analytics] = await Promise.all([
    read('../src/components/ui/Select.jsx'),
    read('../src/app/(app)/[projectId]/page.js'),
    read('../src/app/(app)/my/page.js'),
    read('../src/app/(app)/sprints/page.js'),
    read('../src/app/(app)/analytics/page.js'),
  ]);

  for (const role of ['type', 'priority', 'sprint', 'date', 'member', 'project', 'sort']) {
    assert.match(select, new RegExp(`${role}:\\s*[A-Z]`));
  }
  assert.match(project, /filterRole="sprint"[\s\S]{0,100}value=\{boardSprintFilter\}/);
  assert.match(project, /filterRole="priority"[\s\S]{0,100}value=\{boardPriorityFilter\}/);
  assert.match(my, /filterRole="priority"[\s\S]{0,100}value=\{filters\.priority\}/);
  assert.match(my, /filterRole="sprint"[\s\S]{0,100}value=\{filters\.sprint\}/);
  assert.match(sprints, /filterRole="priority"[\s\S]{0,100}value=\{priorityFilter\}/);
  assert.match(analytics, /filterRole="type"[\s\S]{0,100}value=\{typeFilter\}/);
});

test('QUI-79 reuses the chat attachment viewer on issue details', async () => {
  const source = await read('../src/components/workspace/IssueDetail.jsx');

  assert.match(source, /import AttachmentViewer from '@\/components\/workspace\/AttachmentViewer'/);
  assert.match(source, /function MediaViewer[\s\S]{0,260}<AttachmentViewer/);
  assert.match(source, /previewUrl: getMatFileUrl\(mat\)/);
  assert.doesNotMatch(source, /bg-black\/85 backdrop-blur-sm/);
});

test('QUI-78 uses compact billing rows, one selection control and a defined FormGroup', async () => {
  const [billing, sprints] = await Promise.all([
    read('../src/components/workspace/BillingTab.jsx'),
    read('../src/app/(app)/sprints/page.js'),
  ]);

  assert.match(billing, /data-ui-surface="billing-item"[\s\S]{0,100}data-ui-padding="compact-row"/);
  assert.match(billing, /composition="billing-selection"/);
  assert.doesNotMatch(billing, />Позиції:<\/span>/);
  assert.doesNotMatch(billing, /\(\{checkedCount\} обрано\)/);
  assert.match(billing, /filterRole="status"[\s\S]{0,100}value=\{filterStatus\}/);
  assert.match(billing, /statusLabel=\{statusLabelOf\(iss\.columnId \|\| iss\.status\)\}/);
  assert.match(sprints, /import \{[^}]*\bFormGroup\b[^}]*\} from '@\/components\/ui'/s);
});

test('QUI-72 never submits a completed or stale sprint from Create Task', async () => {
  const source = await read('../src/components/CreateTaskModal.jsx');

  assert.match(
    source,
    /\(sprints \|\| \[\]\)\.filter\(sprint => sprint\.status !== 'completed'\)/,
  );
  assert.match(
    source,
    /form\.sprintId && !availableSprints\.some\(sprint => sprint\.id === form\.sprintId\)/,
  );
  assert.match(source, /\.\.\.availableSprints\.map\(s => \(\{ value: s\.id, label: s\.name \}\)\)/);
  assert.doesNotMatch(source, /\.\.\.sprints\.map\(s => \(\{ value: s\.id, label: s\.name \}\)\)/);
});

test('QUI-71 uses shared date and time controls throughout the calendar event form', async () => {
  const [dialog, kit, timePicker, datePicker] = await Promise.all([
    read('../src/components/workspace/calendar/CalendarEventDialog.jsx'),
    read('../src/app/ui-kit/page.js'),
    read('../src/components/ui/Forms/TimePicker.jsx'),
    read('../src/components/ui/Forms/DatePicker.jsx'),
  ]);

  assert.doesNotMatch(dialog, /<Input type="(?:date|time)"/);
  assert.match(dialog, /<DatePicker[\s\S]{0,220}aria-label="Дата початку"/);
  assert.match(dialog, /<DatePicker[\s\S]{0,220}aria-label="Дата завершення"/);
  assert.match(dialog, /<TimePicker[\s\S]{0,220}aria-label="Час початку"/);
  assert.match(dialog, /<TimePicker[\s\S]{0,220}aria-label="Час завершення"/);
  assert.match(dialog, /value=\{form\.recurrenceUntil\}[\s\S]{0,120}minDate=\{form\.startDate\}/);
  assert.match(datePicker, /disabled=\{Boolean\(isBeforeMinimum\)\}/);
  assert.match(timePicker, /data-ui-size=\{size\}/);
  assert.match(kit, /title="Date & Time Pickers"[\s\S]{0,900}<TimePicker/);
});

test('QUI-70 shares calendar type icons between creation and filtering', async () => {
  const [page, dialog] = await Promise.all([
    read('../src/app/(app)/calendar/page.js'),
    read('../src/components/workspace/calendar/CalendarEventDialog.jsx'),
  ]);

  assert.match(page, /CALENDAR_EVENT_TYPE_OPTIONS/);
  assert.match(
    page,
    /\{ value: 'all', label: 'Усі типи', icon: CalendarDays \}/,
  );
  assert.match(
    page,
    /Object\.entries\(TYPE_CONFIG\)\.map\(\(\[value, config\]\) => \(\{ value, label: config\.label, icon: config\.icon \}\)\)/,
  );
  assert.match(dialog, /\{ value: 'event', label: 'Подія',[\s\S]{0,100}icon: CalendarDays \}/);
});

test('QUI-69 lays out overlaps and renders people as avatar plus name', async () => {
  const [calendarPage, eventDialog, eventPage, select, kit] = await Promise.all([
    read('../src/app/(app)/calendar/page.js'),
    read('../src/components/workspace/calendar/CalendarEventDialog.jsx'),
    read('../src/components/workspace/calendar/CalendarEventPage.jsx'),
    read('../src/components/ui/Select.jsx'),
    read('../src/app/ui-kit/page.js'),
  ]);

  assert.match(calendarPage, /const boxes = layoutDayEvents\(timedEvents, day\)/);
  assert.match(calendarPage, /width: `\$\{box\.widthPercent\}%`/);
  assert.match(calendarPage, /\{ value: 'all', label: 'Уся команда', icon: Users \}/);
  assert.match(calendarPage, /label: member\.name[\s\S]{0,100}user: member/);
  assert.match(eventDialog, /label: memberLabel\(member\),\s*user: member/);
  assert.match(eventPage, /label: memberLabel\(member\),\s*user: member/);
  assert.match(select, /function OptionIdentity\(\{ option, size = 14 \}\)/);
  assert.match(select, /<OptionIdentity option=\{singleSelectedOption\} \/>/);
  assert.match(kit, /label: 'Артур Моспан', user: \{ id: 'u1'/);
});

test('QUI-68 unifies project settings and safely moves hidden statuses to Backlog', async () => {
  const [
    workspace,
    projectPage,
    settingsDialog,
    settingsForm,
    picker,
    projectRoute,
    createProjectRoute,
    createIssueRoute,
    myTasks,
    kit,
  ] = await Promise.all([
    read('../src/app/(app)/page.js'),
    read('../src/app/(app)/[projectId]/page.js'),
    read('../src/components/workspace/BoardConfigModal.jsx'),
    read('../src/components/ui/TaskManagement/ProjectSettingsForm.jsx'),
    read('../src/components/ui/TaskManagement/StatusVisibilityPicker.jsx'),
    read('../src/app/api/projects/[projectId]/route.js'),
    read('../src/app/api/projects/route.js'),
    read('../src/app/api/issues/route.js'),
    read('../src/app/(app)/my/page.js'),
    read('../src/app/ui-kit/page.js'),
  ]);

  assert.doesNotMatch(workspace, /function EditProjectModal/);
  assert.match(workspace, /label: 'Налаштування проєкту'/);
  assert.match(workspace, /hiddenColumns,\s*\n/);
  assert.match(workspace, /<StatusVisibilityPicker[\s\S]{0,240}onChange=\{setHiddenColumns\}/);
  assert.match(projectPage, /title="Налаштування проєкту"/);
  assert.ok(
    projectPage.indexOf('title="Налаштування проєкту"')
      < projectPage.indexOf('title="Створити завдання"'),
    'project settings must be immediately available before task creation',
  );
  assert.match(projectPage, /<BoardConfigModal[\s\S]{0,160}project=\{project\}[\s\S]{0,160}issues=\{issues\}/);
  assert.match(settingsDialog, /size="sm"/);
  assert.doesNotMatch(settingsDialog, /presentation="dialog"/);
  assert.match(settingsDialog, /title: 'Приховати колонки проєкту\?'/);
  assert.match(settingsDialog, /updateProjectSettings\(project\.id/);
  assert.match(settingsDialog, /<ProjectSettingsForm/);
  assert.match(settingsDialog, /layout="stacked"/);
  assert.match(settingsForm, /lg:grid-cols-\[minmax\(0,0\.8fr\)_minmax\(320px,1\.2fr\)\]/);
  assert.match(settingsForm, /<StatusVisibilityPicker/);
  assert.match(picker, /disabled=\{disabled \|\| isBacklog\}/);
  assert.match(projectRoute, /'update-settings'/);
  assert.match(projectRoute, /columnId: backlogStatusId,\s*status: backlogStatusId/);
  assert.match(projectRoute, /completedAt: admin\.firestore\.FieldValue\.delete\(\)/);
  assert.match(createProjectRoute, /hiddenColumns: requestedHidden/);
  assert.match(createIssueRoute, /\(project\.hiddenColumns \|\| \[\]\)\.includes\(statusCandidate\)/);
  assert.match(myTasks, /localStorage\.setItem\('qt_my_tasks_hidden'/);
  assert.match(kit, /title="Project Status Visibility"[\s\S]{0,500}<StatusVisibilityPicker/);
});

test('QUI-67 and QUI-87 keep the sprint task column responsive and fixed on desktop', async () => {
  const source = await read('../src/app/(app)/sprints/page.js');
  const backlogSurface = source.match(
    /<Surface[\s\S]{0,80}preset="panel"[\s\S]{0,80}padding="none"[\s\S]{0,80}className="([^"]+)"/,
  );

  assert.ok(backlogSurface, 'the sprint backlog surface must be present');
  assert.match(backlogSurface[1], /w-\[82vw\]/);
  assert.match(backlogSurface[1], /max-w-\[320px\]/);
  assert.match(backlogSurface[1], /md:w-\[280px\]/);
  assert.match(backlogSurface[1], /md:max-w-none/);
  assert.doesNotMatch(backlogSurface[1], /(?:lg|xl|2xl):w-\[[\d.]+%\]/);
  assert.match(source, /isBacklogCol \? 'px-\[8px\]' : 'px-4'/);
});
