import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('mobile keeps Kanban as a first-class horizontally swipeable board', () => {
  const board = read('src/components/workspace/AgileBoard.jsx');
  assert.match(board, /w-\[82vw\] max-w-\[320px\]/);
  assert.doesNotMatch(board, /max-(?:sm|md):hidden[^\n]*AgileBoard/);
});

test('task chat exposes an unread boundary and reads it only after visibility', () => {
  const timeline = read('src/components/workspace/UnifiedTimeline.jsx');
  const detail = read('src/components/workspace/IssueDetail.jsx');
  // The boundary counts everything the feed carries — messages and changes both.
  // Drawn from the messages alone, it left a task where somebody moved the
  // deadline and said nothing looking untouched.
  assert.match(timeline, /const unreadTotal = unreadCommentIds\.length \+ unreadChangeIds\.length;/);
  // The line carries no number: it stays where the visit found it while the
  // conversation moves, so any count on it goes stale the moment anybody writes.
  assert.match(timeline, /<UnreadDivider label=\{unreadLabel\}/);
  assert.match(timeline, /new IntersectionObserver/);
  assert.match(timeline, /scrollToUnread/);
  // The line stays where the visit found it. Derived live from `unreadTotal` it
  // disappeared the moment it was read, pulling its own height out of the list
  // under the reader.
  assert.match(timeline, /sessionBoundary/);
  // Reading the boundary consumes the changes too. They used to be consumed
  // only by leaving the task, so «11 нових» stood there for a whole visit no
  // matter how far you read.
  assert.match(timeline, /consumeChanges\(\);/);
  // And having been read is what takes the line down. It used to take it down
  // to 70% opacity and no further — `read: true` only faded it — so a reader
  // who opened a task, read the two new messages and looked away was still
  // being told they had something new by a marker that already knew they did
  // not. The trigger is the intersection observer the read receipt already
  // trusts, never a hover: a pointer entering a box is not a person reading
  // what is in it, and on a phone there is no pointer at all.
  assert.match(timeline, /if \(!boundary\.read \|\| boundary\.dismissed\) return undefined;/);
  assert.match(timeline, /window\.setTimeout\(dismissBoundary, 320\)/);
  assert.match(timeline, /markIssueSeen\(\{/);
  // The jump button points where the line actually is.
  assert.match(timeline, /unreadDirection === 'up' \? ChevronUp : ChevronDown/);
  assert.match(detail, /label: 'Чат'.*count: unreadTaskChatCount/);
});

test('dense analytics, timesheet and invoice data have dedicated mobile cards', () => {
  const workspaceAnalytics = read('src/app/(app)/analytics/page.js');
  const projectAnalytics = read('src/components/workspace/AnalyticsTab.jsx');
  const timesheet = read('src/components/workspace/TimesheetTab.jsx');
  const billing = read('src/components/workspace/BillingTab.jsx');

  // The two analytics tables are `DataTable` now, and the stacked layout is
  // part of it rather than a second block each screen wrote for itself. Both
  // screens had written it, and only one of the three tables on them had it at
  // all — the team overview shipped a six-column grid with no phone layout.
  const dataTable = read('src/components/ui/DataDisplay/DataTable.jsx');
  assert.match(dataTable, /className="hidden min-w-0 overflow-hidden md:block"/);
  assert.match(dataTable, /flex flex-col gap-2 md:hidden/);
  for (const source of [workspaceAnalytics, projectAnalytics]) {
    assert.match(source, /<DataTable/);
  }
  assert.match(timesheet, /space-y-3 lg:hidden/);
  assert.match(timesheet, /hidden overflow-x-auto rounded-\[16px\] bg-white lg:block/);
  assert.match(billing, /mb-2 space-y-2 sm:hidden/);
  assert.match(billing, /hidden w-full sm:table/);
});

test('settings headers, workflow rows and clickable setting rows fit a phone', () => {
  const settings = read('src/app/(app)/settings/page.js');
  const settingRow = read('src/components/ui/Layout/SettingRow.jsx');
  const integration = read('src/components/integrations/IntegrationScreen.jsx');

  // The header of a settings screen puts the title and its description on their
  // own full-width line below md — but only where something else is competing
  // for that width, so the fifteen plain sections keep the layout they have.
  assert.match(settings, /const stackHeader = Boolean\(desc && \(rightAction \|\| icon\)\);/);
  assert.match(settings, /max-md:contents/);
  assert.match(settings, /max-md:order-1 max-md:basis-full/);
  // …and the header's secondary action gives the text back its ~70px by
  // becoming a square icon button. Hiding the label removes the accessible
  // name, so the aria-label is not decoration.
  assert.match(integration, /collapseAt="md"/);
  assert.match(integration, /aria-label=\{action\.label\}/);

  // A workflow row printed its name twice — once as text, once in the preview
  // badge — and the badge could not shrink, so the edit/delete box was pushed
  // off the card. Below md the plain copy goes and the badge wraps instead.
  assert.match(settings, /className="flex-1 text-\[13px\] font-semibold text-ink max-md:hidden"/);
  // The wrapping is a named kit preset, not a handful of utilities at the call
  // site: `justify-content`, `white-space` and `flex-shrink` are declarations
  // `.ui-pill` makes for itself, and a className that re-makes them is a second
  // copy of the kit's geometry living where nothing can propagate to it. Three
  // previews ask for it — type, priority, and everything else.
  assert.equal((settings.match(/preset="workflow-preview"/g) || []).length, 3);
  assert.doesNotMatch(settings, /max-md:whitespace-normal|max-md:break-words/);
  const globals = read('src/app/globals.css');
  assert.match(
    globals,
    /@media \(width < 48rem\) \{\s*\.ui-pill\[data-ui-pill-preset='workflow-preview'\] \{[^}]*\bwhite-space: normal;[^}]*\}/,
  );

  // A clickable setting row drops its value under the label at the same
  // breakpoint the field rows already use — sm, not md.
  assert.match(settingRow, /sm:gap-6 max-sm:flex-wrap max-sm:gap-y-1/);
  assert.match(settingRow, /max-sm:order-1 max-sm:w-full max-sm:shrink/);
});

test('the QuickTeam+ project tab is on one 16px step below md', () => {
  const tab = read('src/components/workspace/QtPlusProjectTab.jsx');
  const stages = read('src/components/workspace/qtplus/QtPlusStagesView.jsx');
  const grid = read('src/components/workspace/qtplus/MaterialGrid.jsx');
  const file = read('src/components/workspace/qtplus/cards/FileCard.jsx');

  // The linked project's name, its stage progress, «Перейти» and the kebab were
  // one unwrapping row, and three of the four do not shrink: on a phone the
  // name — the thing the row is named after — was two characters and an
  // ellipsis. Below md the row wraps and the name takes the first line alone.
  assert.match(tab, /flex items-center gap-2 max-md:flex-wrap max-md:gap-y-2/);
  assert.match(tab, /truncate tracking-tight text-ink max-md:basis-full/);

  // One step through the panel below md: the same 16px above the stage strip
  // and below it as the gutters beside them, and between the material tiles.
  // These two stay utilities on purpose — neither is the card row's decision.
  // The panel is already on 16 horizontally and only closes one vertical seam;
  // the grid's is a gap between cards, not padding inside a surface.
  assert.match(stages, /px-4 pb-3 pt-4 max-md:pb-4/);
  assert.match(stages, /px-4 pb-4 pt-3 max-md:pt-4/);
  assert.match(grid, /gap-3 max-md:gap-4/);

  // An attachment's caption row breathes, and the 28px square in it stops being
  // a second copy of the picture already filling the top of the same card —
  // only where there IS such a picture, so a failed preview keeps its glyph.
  assert.match(file, /data-ui-surface="qtplus-card-row" className="ui-surface/);
  assert.match(file, /view\.url && !thumbFailed && isVisualKind\(view\.kind\) \? 'max-md:hidden' : ''/);

  // Every tile of the grid on that same step: one stage can hold a checklist, a
  // poll, a link and a file at once, and on a phone they stand in one column.
  //
  // One named preset, not eight copies of `px-3 py-2 max-md:px-4 max-md:py-3`.
  // The row's geometry is a member of the `data-ui-surface` family in
  // globals.css and the call sites name it — which is also what keeps the eight
  // of them from drifting apart the next time one of the numbers moves.
  const globals = read('src/app/globals.css');
  assert.match(globals, /\.ui-surface\[data-ui-surface='qtplus-card-row'\] \{\s*padding: 8px 12px;\s*\}/);
  assert.match(
    globals,
    /@media \(width < 48rem\) \{\s*\.ui-surface\[data-ui-surface='qtplus-card-row'\] \{\s*padding: 12px 16px;\s*\}/,
  );
  for (const card of ['ChecklistCard', 'PollCard', 'LinkCard', 'NoteCard']) {
    const source = read(`src/components/workspace/qtplus/cards/${card}.jsx`);
    assert.match(source, /data-ui-surface="qtplus-card-row" className="ui-surface/);
  }
  // …and none of them keeps a second copy of it. The note's sticker is the one
  // survivor of `max-md:px-4`: it takes the horizontal step and must not take
  // the vertical one, because `line-clamp-[7]` × 18px + 20px is exactly its
  // 160px and 12px would cost it the seventh line.
  for (const card of ['ChecklistCard', 'PollCard', 'LinkCard', 'NoteCard', 'FileCard']) {
    const source = read(`src/components/workspace/qtplus/cards/${card}.jsx`);
    assert.doesNotMatch(source, /max-md:py-3/, `${card} retypes the row padding instead of naming it`);
  }
  assert.equal((read('src/components/workspace/qtplus/cards/NoteCard.jsx').match(/max-md:px-4/g) || []).length, 1);

  // And nothing at or above md moved: every declaration this fix adds is a
  // `max-md:` utility, which Tailwind 4.3 emits as `(width < 48rem)`. The
  // lookbehind is what keeps `max-md:` itself out of the negation — a plain
  // `\bmd:` matches inside it, because the hyphen before `md` is a word
  // boundary, and the guard would then forbid the very thing it is checking.
  for (const source of [tab, stages, grid, file]) {
    assert.doesNotMatch(source, /(?<![-\w])md:/);
  }
});

test('the task composer respects the device safe area', () => {
  const css = read('src/app/globals.css');
  assert.match(css, /timeline-composer[^}]*calc\(20px \+ var\(--sab\)\)/s);
});
