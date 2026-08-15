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
  assert.match(board, /kanban-full-bleed/);
  assert.match(sidebar, /after:-inset-\[8px\]/);
  assert.match(sidebar, /className="flex h-full w-full items-center justify-center transition-colors"/);
  assert.doesNotMatch(help, />\s*Допомога\s*</);
  assert.doesNotMatch(help, /<Tooltip/);
  assert.match(search, /text-\[#cfcfcf\]/);
  assert.doesNotMatch(team, /lastActivity|Остання активність/);
  assert.match(settings, /backAction=\{\([\s\S]*Усі інтеграції/);
  assert.match(bulk, /!bg-white hover:!bg-canvas !text-ink/);
});
