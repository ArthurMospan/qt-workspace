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
  assert.match(board, /className="flex"[\s\S]{0,260}icon=\{MoreVertical\}/);
  assert.match(board, /icon=\{MoreVertical\}\s*\r?\n\s*composition="section-kebab"/);
  // A larger box pushed long status names onto a second row.
  assert.doesNotMatch(board, /size="icon-sm"/);
  assert.match(board, /ui-type-column-title[^"]*truncate" title=\{col\.label\}/);
  // The clip and the gutter belong to different boxes — one element carrying
  // both cancels itself out inside an `overflow: hidden` parent.
  assert.match(board, /overflow-hidden bleed-edges/);
  assert.match(board, /overflow-auto[^"]*bleed-gutter/);
  assert.match(sidebar, /after:-inset-\[8px\]/);
  assert.match(sidebar, /className="flex h-full w-full items-center justify-center transition-colors"/);
  // The running timer is a quiet capsule in the rail, not a floating card.
  assert.doesNotMatch(sidebar, /shadow-\[0_4px_12px_rgba\(0,0,0,0\.2\)\]/);
  assert.doesNotMatch(help, />\s*Допомога\s*</);
  assert.doesNotMatch(help, /<Tooltip/);
  // Help is a square, not a rail-wide slab.
  assert.doesNotMatch(help.slice(0, help.indexOf('<Dialog')), /w-full/);
  assert.match(help, /size="icon"\s+icon=\{CircleHelp\}/);
  assert.match(search, /text-\[#cfcfcf\]/);
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
  const [menu, centre, legal] = await Promise.all([
    read('src/components/WorkspaceHelpMenu.jsx'),
    read('src/components/WorkspaceInfoCenter.jsx'),
    read('src/app/(public)/_components/LegalDocumentPage.jsx'),
  ]);
  // Three things you glance at and close. They used to navigate to a separate
  // public shell and throw away whatever was on screen.
  for (const pane of ['help', 'news', 'versions']) {
    assert.match(menu, new RegExp(`setInfoPane\\('${pane}'\\)`));
  }
  assert.doesNotMatch(menu, /router\.push\('\/(help|news|versions)'\)/);
  // A contract needs an address that can be linked, printed and cited.
  for (const legalRoute of ['/terms', '/privacy', '/offer']) {
    assert.match(menu, new RegExp(`router\\.push\\('${legalRoute}'\\)`));
  }
  assert.match(legal, /<LegalBackLink \/>/);
  assert.match(centre, /HELP_ARTICLES/);
  assert.match(centre, /NEWS_ARTICLES/);
  assert.match(centre, /VERSION_HISTORY/);
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
