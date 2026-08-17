import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('task selection is entered from kebab menus, never from hover', async () => {
  const [board, list, card, row] = await Promise.all([
    read('src/components/workspace/AgileBoard.jsx'),
    read('src/components/ui/TaskManagement/TaskListView.jsx'),
    read('src/components/workspace/IssueCard.jsx'),
    read('src/components/ui/TaskManagement/TaskRow.jsx'),
  ]);
  assert.match(board, /label: allSelected \? 'Зняти вибір у колонці' : 'Вибрати всі у колонці'/);
  assert.match(list, /Вибрати всі у списку/);
  assert.match(card, /selectionActive && onSelect/);
  assert.match(row, /selectionActive && onSelect/);
  assert.doesNotMatch(card, /group-hover[^\n]*(Checkbox|checkbox)/);
  assert.doesNotMatch(row, /group-hover[^\n]*(Checkbox|checkbox)/);
});

test('card and row checkbox replace the priority slot', async () => {
  const [card, row, priorityIcon] = await Promise.all([
    read('src/components/workspace/IssueCard.jsx'),
    read('src/components/ui/TaskManagement/TaskRow.jsx'),
    read('src/components/ui/DataDisplay/PriorityIcon.jsx'),
  ]);
  assert.ok(card.indexOf('selectionActive && onSelect ?') < card.indexOf('<PriorityIcon priority={priorityConfig}'));
  assert.ok(row.indexOf('selectionActive && onSelect ?') < row.indexOf('<PriorityIcon priority={priorityConfig}'));
  assert.match(priorityIcon, /if \(config\.isNoPriority\) return null/);
});

test('requested navigation and readability regressions stay fixed', async () => {
  const [board, sidebar, help, search, team, settings, bulk] = await Promise.all([
    read('src/components/workspace/AgileBoard.jsx'),
    read('src/components/WorkspaceSidebar.jsx'),
    read('src/components/WorkspaceHelpMenu.jsx'),
    read('src/components/ui/Forms/HeaderSearch.jsx'),
    read('src/components/ui/Navigation/MemberRail.jsx'),
    read('src/app/(app)/settings/page.js'),
    read('src/components/ui/TaskManagement/BulkActionBar.jsx'),
  ]);
  assert.match(board, /\{columnActionMenu\(col, colTotalIssues\)\}[\s\S]{0,600}icon=\{Plus\}/);
  assert.match(board, /\{columnActionMenu\(col, colIssues\)\}[\s\S]{0,600}icon=\{Plus\}/);
  assert.doesNotMatch(board, /kanban-full-bleed/);
  // The kebab and the plus beside it are one pair: the same miniature box, the
  // vertical glyph the rest of the product uses, and a smaller icon size so
  // three filled dots do not read darker than two hairline strokes.
  assert.match(board, /icon=\{MoreVertical\}\s*\r?\n\s*composition="section-kebab"/);
  // The wrapper is a flex box in the component itself, so no call site has to
  // pass `flex` — which collided with its `inline-block` and left the kebab
  // sitting on a text baseline, a few pixels above the plus beside it.
  const contextMenu = await read('src/components/ui/ContextMenu.jsx');
  assert.match(contextMenu, /relative inline-flex items-center/);
  assert.doesNotMatch(contextMenu, /relative inline-block/);
  assert.doesNotMatch(board, /<ContextMenu\s*\r?\n\s*className="flex"/);
  // A larger box pushed long status names onto a second row.
  assert.doesNotMatch(board, /size="icon-sm"/);
  assert.match(board, /ui-type-column-title[^"]*truncate" title=\{col\.label\}/);
  // The clip and the gutter belong to different boxes — one element carrying
  // both cancels itself out inside an `overflow: hidden` parent.
  assert.match(board, /overflow-hidden bleed-edges/);
  assert.match(board, /overflow-auto[^"]*bleed-gutter/);
  // A bare pseudo-element hit area answered nothing: no hover, no pointer. The
  // collapse and expand controls are 32px buttons that react like buttons.
  assert.doesNotMatch(sidebar, /after:-inset-\[8px\]/);
  // 36px, not 32: the old pseudo-element inset already gave the glyph a 36px
  // target, and shrinking it to fit a hover box would undo the enlargement.
  assert.equal((sidebar.match(/h-\[36px\] w-\[36px\][^"]*cursor-pointer/g) || []).length, 2);
  // The running timer is a quiet capsule in the rail, not a floating card.
  assert.doesNotMatch(sidebar, /shadow-\[0_4px_12px_rgba\(0,0,0,0\.2\)\]/);
  assert.doesNotMatch(help, />\s*Допомога\s*</);
  assert.doesNotMatch(help, /<Tooltip/);
  // Help is a square, not a rail-wide slab.
  assert.doesNotMatch(help.slice(0, help.indexOf('<Dialog')), /w-full/);
  assert.match(help, /size="icon"\s+icon=\{CircleHelp\}/);
  // The palette shortcut is a hint, and a hint nobody needs while they are
  // looking elsewhere: it fades in on hover or focus rather than sitting in the
  // header all day.
  assert.match(search, /group\/search/);
  assert.match(search, /opacity-0 transition-opacity group-hover\/search:/);
  assert.match(search, /group-focus-within\/search:opacity-100/);
  assert.doesNotMatch(team, /lastActivity|Остання активність/);
  assert.match(settings, /backAction=\{\([\s\S]*Усі інтеграції/);
  // The bulk bar's pickers are drawn on the dark bar, never as white blocks
  // dropped on top of it, and the bar wraps instead of cropping its last
  // controls inside an invisible scroller.
  assert.doesNotMatch(bulk, /!bg-white hover:!bg-canvas !text-ink/);
  assert.match(bulk, /ui-bulk-actions__trigger/);
  assert.equal((bulk.match(/ui-bulk-actions__control/g) || []).length, 6);
});

test('help, news and versions are read in place; contracts keep their own address', async () => {
  const [menu, centre, shell, legal, helpExplorer, newsIndex, versions] = await Promise.all([
    read('src/components/WorkspaceHelpMenu.jsx'),
    read('src/components/WorkspaceInfoCenter.jsx'),
    read('src/app/(public)/layout.js'),
    read('src/app/(public)/_components/LegalDocumentPage.jsx'),
    read('src/app/(public)/help/HelpExplorer.jsx'),
    read('src/app/(public)/news/page.js'),
  ]);
  // The public routes are a document shell, not a second site: no logo lockup,
  // no navigation across sections, no "Увійти" — only the way back.
  const withoutComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(shell, /<PublicBackLink \/>/);
  assert.doesNotMatch(withoutComments(shell), /next\/image|Увійти|<nav/);
  // …and set in the product's own type scale, not a landing page's.
  for (const [name, source] of [
    ['legal document', legal],
    ['help explorer', helpExplorer],
    ['news index', newsIndex],
  ]) {
    assert.doesNotMatch(
      withoutComments(source),
      /font-black|rounded-3xl|shadow-sm|text-[34]xl/,
      `${name} must use the kit's scale, not a second one`,
    );
  }
  // Three things you glance at and close. They used to navigate to a separate
  // public shell and throw away whatever was on screen.
  for (const pane of ['help', 'news']) {
    assert.match(menu, new RegExp(`setInfoPane\\('${pane}'\\)`));
  }
  assert.doesNotMatch(menu, /router\.push\('\/(help|news)'\)/);
  // The version history went out with its page: a changelog grouped by area is
  // written for whoever built the thing, not for somebody asking what changed.
  // The build number stays, because a support conversation asks for it.
  assert.doesNotMatch(menu, /setInfoPane\('versions'\)/);
  assert.match(menu, /QuickTeam \{APP_VERSION\}/);
  // A contract needs an address that can be linked, printed and cited.
  for (const legalRoute of ['/terms', '/privacy', '/offer']) {
    assert.match(menu, new RegExp(`router\\.push\\('${legalRoute}'\\)`));
  }
  assert.match(centre, /HELP_ARTICLES/);
  assert.match(centre, /NEWS_ARTICLES/);
});

test('the quiet greys stay light and stay three steps apart', async () => {
  const [styles, { textContrastRatio }] = await Promise.all([
    read('src/app/globals.css'),
    import('../scripts/kit-a11y.mjs'),
  ]);
  const token = name => styles.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  const canvas = token('canvas');
  const muted = textContrastRatio(token('muted'), canvas);
  const faint = textContrastRatio(token('faint'), canvas);
  // Pushed to AA these two landed nine points apart and the product went heavy.
  // What has to hold is that they are visible and that they are not one grey.
  assert.ok(muted > 2, `muted must stay readable, got ${muted}`);
  assert.ok(muted < 4, `muted must stay light, got ${muted}`);
  assert.ok(muted - faint > 0.5, 'faint must stay clearly quieter than muted');
});

test('a stopped timer keeps its minutes until they are written down', async () => {
  const [store, detail, sidebar] = await Promise.all([
    read('src/store/useWorkspaceStore.js'),
    read('src/components/workspace/IssueDetail.jsx'),
    read('src/components/WorkspaceSidebar.jsx'),
  ]);
  // Persisted the moment the timer stops, so a reload or the task page's own
  // canonical-URL redirect cannot take the tracked time with it.
  assert.match(store, /pendingTimeLog/);
  assert.match(store, /writeStoredPendingLog\(pending\)/);
  assert.match(store, /clearPendingTimeLog/);
  // The handoff is the store, not a query param that gets stripped on arrival.
  assert.doesNotMatch(sidebar, /timerTargetHref\(result, \{ minutes/);
  assert.match(detail, /pendingTimeLog/);
  assert.match(detail, /closeLogForm/);
  // Closing the dialog on unsaved timer minutes has to be a decision.
  assert.match(detail, /Не зберігати відстежений час\?/);
});

test('a project card offers no action the role cannot perform', async () => {
  const projects = await read('src/app/(app)/page.js');
  assert.match(projects, /const canEditProject = can\(orgRole, 'edit:project_settings'\)/);
  assert.match(projects, /const canDeleteProject = can\(orgRole, 'delete:project'\)/);
  assert.match(projects, /\{projectMenuItems\.length > 0 && \(/);
  // «N моїх» is not something anyone acts on; what is late and what is waiting
  // for you is.
  assert.doesNotMatch(projects, /<span>моїх<\/span>/);
  assert.match(projects, /<span>прострочено<\/span>/);
});

test('a new task appears at the top of My tasks, as it does on a board', async () => {
  const { compareMyTaskIssues } = await import('../src/lib/utils/myTaskOrder.mjs');
  const arranged = { old: 0, older: 1 };
  const fresh = { id: 'fresh', order: -9 };
  const sorted = [
    { id: 'old', order: -1 },
    { id: 'older', order: -2 },
    fresh,
  ].toSorted(compareMyTaskIssues(arranged));
  assert.equal(sorted[0].id, 'fresh');
  // Cards the user has arranged keep the order they were dragged into.
  assert.deepEqual(sorted.slice(1).map(issue => issue.id), ['old', 'older']);
});

test('the planning board reads like the boards it borrows from', async () => {
  const sprints = await read('src/app/(app)/sprints/page.js');

  // A row and a card name the parent from every task in view. Each list used to
  // be handed only its own column, so a subtask dropped into a sprint could not
  // find its parent there and fell back to the words «Батьківське завдання»
  // where the key belongs.
  // Once for the card in «Без спринта», once for the row inside a sprint.
  assert.equal(sprints.match(/allIssues=\{issues\}/g)?.length, 2);
  assert.doesNotMatch(sprints, /issues=\{issueList\}/);
  // Both also say what blocks a task, so the two views of one list agree.
  assert.match(sprints, /<TaskRow[\s\S]{0,400}?issueLinks=\{issueLinks\}/);

  // «Без спринта» is a board column and is drawn like one: no rule under the
  // header, and the same count badge the board columns carry.
  assert.doesNotMatch(sprints, /border-b border-line/);
  assert.match(sprints, /<Pill tone="count" size="md"/);
  assert.doesNotMatch(sprints, /<Counter/);
});

test('a collapsed sprint opens on the first click', async () => {
  const { nextSectionExpansion } = await import('../src/lib/utils/sectionExpansion.mjs');

  // A finished sprint starts collapsed, so the first click has to open it. The
  // toggle used to write `false` into an empty slot — the value it already had
  // — and the header only answered the second click.
  assert.deepEqual(nextSectionExpansion({}, 'done-sprint', false), { 'done-sprint': true });
  assert.deepEqual(nextSectionExpansion({}, 'live-sprint', true), { 'live-sprint': false });
  // An explicit state is flipped, and its neighbours are left alone.
  assert.deepEqual(
    nextSectionExpansion({ a: false, b: true }, 'a', false),
    { a: true, b: true },
  );
});
