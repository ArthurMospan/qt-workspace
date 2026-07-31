// QUI-129…QUI-142 plus the project-settings unification.
//
// One batch of reported UI issues. They are kept together rather than folded
// into issue-fixes.test.mjs because most of them are the same kind of finding:
// a decision that lived at a call site instead of in the kit, so the same thing
// looked different depending on where you opened it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('QUI-129 renders the project status chart the same way as global analytics', async () => {
  const [tab, global] = await Promise.all([
    read('../src/components/workspace/AnalyticsTab.jsx'),
    read('../src/app/(app)/analytics/page.js'),
  ]);
  // The tab squeezed each status label into a fixed 100px column and truncated
  // every name; the global page put the label above its bar. One chart now.
  for (const source of [tab, global]) {
    assert.match(source, /<span className="h-2 w-2 shrink-0 rounded-full" style=\{\{ background: color \}\} \/>/);
    assert.match(source, /truncate text-\[13px\] font-semibold text-ink/);
    assert.match(source, /text-\[14px\] font-bold text-ink tabular-nums/);
  }
  assert.doesNotMatch(tab, /w-\[100px\] text-\[11px\] font-medium text-muted/);
});

test('QUI-129 and QUI-139 keep the project header free of team avatars', async () => {
  const [topHeader, workspaceHeader, kit] = await Promise.all([
    read('../src/components/ui/Layout/TopHeader.jsx'),
    read('../src/components/WorkspaceHeader.jsx'),
    read('../src/app/ui-kit/page.js'),
  ]);
  for (const source of [topHeader, workspaceHeader, kit]) {
    assert.doesNotMatch(source, /projectMembers/, 'the project team avatar strip is gone');
  }
  assert.doesNotMatch(topHeader, /ProjectMembersMenu/);
  // Chat keeps its online strip: a different list answering a different question.
  assert.match(topHeader, /renderOnlineUsers/);
  // The preview also stopped reaching for a third-party avatar host, which had
  // been failing on every page load.
  assert.doesNotMatch(kit, /pravatar/);
});

test('QUI-130 drops the epic copy and leads the type list with Задача', async () => {
  const [settings, workflow] = await Promise.all([
    read('../src/app/(app)/settings/page.js'),
    read('../src/lib/hooks/useWorkflowConfig.js'),
  ]);
  assert.doesNotMatch(settings, /Старі Епіки лишаються видимими/);
  assert.doesNotMatch(settings, /legacy-дані/);
  const types = workflow.slice(
    workflow.indexOf('export const DEFAULT_TYPES'),
    workflow.indexOf('export const DEFAULT_PRIORITIES'),
  );
  assert.ok(types.indexOf("id: 'task'") < types.indexOf("id: 'feature'"), 'Задача leads the list');
});

test('QUI-131 allows several terminal statuses but never the entry column', async () => {
  const settings = await read('../src/app/(app)/settings/page.js');
  const toggle = settings.slice(
    settings.indexOf('const handleToggleStatusDone'),
    settings.indexOf('const handleStatusDeleteClick'),
  );
  // The first status takes new tasks and the fallback of any deleted column.
  assert.match(toggle, /if \(prev\[0\]\?\.id === id\) return prev;/);
  // Something has to close a task, so the last terminal status cannot be cleared.
  assert.match(toggle, /if \(done\.size <= 1\) return prev;/);
  assert.match(settings, /doneLocked=\{i === 0 \|\| \(doneIds\.length === 1/);
  assert.match(settings, /Завершальних може бути кілька/);
});

test('QUI-132 leaves one clock on the time field, and only on touch', async () => {
  const [timePicker, globals] = await Promise.all([
    read('../src/components/ui/Forms/TimePicker.jsx'),
    read('../src/app/globals.css'),
  ]);
  assert.match(timePicker, /ui-time-input/);
  assert.match(globals, /@media \(pointer: fine\)/);
  assert.match(globals, /\.ui-time-input::-webkit-calendar-picker-indicator/);
});

test('QUI-133 gives the money input its currency instead of bare padding', async () => {
  const [input, billing, kit] = await Promise.all([
    read('../src/components/ui/Input.jsx'),
    read('../src/components/workspace/BillingTab.jsx'),
    read('../src/app/ui-kit/page.js'),
  ]);
  assert.match(input, /money: 'text-right font-bold tabular-nums'/);
  assert.doesNotMatch(input, /pr-\[54px\]/, 'the hardcoded suffix gutter is gone');
  assert.match(input, /suffixText && \(/);
  // Both call sites hand-drew the suffix, at two different sizes and offsets.
  assert.match(billing, /suffix=\{`\$\{currency\}\/г`\}/);
  assert.match(billing, /suffix=\{currency\}/);
  assert.doesNotMatch(billing, /absolute right-[\d.]+ top-1\/2 -translate-y-1\/2 text-\[(?:9|10)px\]/);
  assert.match(kit, /preset="money" suffix=/);
});

test('QUI-134 gives the neutral dot the surface opposite, not a brand hue', async () => {
  const counter = await read('../src/components/ui/DataDisplay/Counter.jsx');
  assert.doesNotMatch(counter, /818cf8|6366f1/, 'the indigo dot and its glow are gone');
  assert.match(counter, /info: 'bg-white shadow-\[0_0_8px_rgba\(255,255,255,0\.45\)\]'/);
  assert.match(counter, /info: 'bg-ink'/);
  // Colours that mean something keep meaning it.
  assert.match(counter, /danger: 'bg-\[#ef4444\]'/);
  assert.match(counter, /success: 'bg-\[#10b981\]'/);
});

test('QUI-135 keeps every status pill readable against its own tint', async () => {
  const [sprints, kit] = await Promise.all([
    read('../src/app/(app)/sprints/page.js'),
    read('../src/app/ui-kit/page.js'),
  ]);
  // `#cbd5e1` text on a 9% tint of itself scored about 1.5:1.
  for (const source of [sprints, kit]) {
    assert.doesNotMatch(source, /label="Завершено" color="#cbd5e1"/);
    assert.match(source, /label="Завершено" color="#1f1f1f"/);
  }
});

test('QUI-136 gives every tooltip the same seamless arrow', async () => {
  const tooltip = await read('../src/components/ui/Navigation/Tooltip.jsx');
  // A border triangle butted against the bubble showed its seam on `top` — the
  // one side that lands inside the bubble's own downward-offset shadow.
  assert.doesNotMatch(tooltip, /border-[tblr]-\[4px\]/);
  assert.match(tooltip, /absolute h-\[6px\] w-\[6px\] rotate-45 bg-ink/);
  for (const offset of ['bottom-\\[-3px\\]', 'top-\\[-3px\\]', 'right-\\[-3px\\]', 'left-\\[-3px\\]']) {
    assert.match(tooltip, new RegExp(offset), `all four sides use the same offset (${offset})`);
  }
});

test('QUI-137 makes the inline add control look like a button', async () => {
  const globals = await read('../src/app/globals.css');
  const rule = globals.slice(
    globals.indexOf(".ui-control[data-ui-composition='inline-add-action'] {"),
    globals.indexOf(".ui-control[data-ui-composition='inline-add-action']:hover"),
  );
  assert.match(rule, /background: var\(--color-canvas\)/);
  assert.match(rule, /color: var\(--color-ink\)/);
  assert.doesNotMatch(rule, /var\(--color-surface\)/, 'white on white read as a bare link');
});

test('QUI-138 says where each rare Dialog variant actually lives', async () => {
  const kit = await read('../src/app/ui-kit/page.js');
  const list = kit.slice(kit.indexOf('const DIALOG_VARIANTS'), kit.indexOf('function DialogsSection'));
  for (const id of ['flush', 'responsive', 'spacious', 'invite', 'sheet', 'status']) {
    assert.match(list, new RegExp(`id: '${id}'`), `${id} must stay listed`);
  }
  // Six bare buttons labelled with prop syntax read as options invented for the
  // catalogue; each one now names the screen it ships on and how to open it.
  assert.equal([...list.matchAll(/\bwhere:/g)].length, 6);
  assert.equal([...list.matchAll(/\bopen:/g)].length, 6);
  assert.match(kit, /Де на сайті:/);
});

test('QUI-140 removes the unreachable portal route and the variant it kept alive', async () => {
  const [pageHeader, variants] = await Promise.all([
    read('../src/components/ui/Layout/PageHeader.jsx'),
    read('../scripts/kit-variants.mjs'),
  ]);
  await assert.rejects(
    read('../src/app/(app)/[projectId]/portal/page.js'),
    'the orphan route is gone',
  );
  assert.doesNotMatch(pageHeader, /variant === 'alt'/);
  assert.doesNotMatch(variants, /PageHeader: \{ variant/);
});

// QUI-141 / QUI-142. The previews were hand-copies of the two rails, and the
// copies were wrong in five ways at once — 8px radius drawn as 10px, the
// `#ebebeb` selected row drawn as white-with-a-shadow, a 32px avatar drawn at
// 24px, a muted name drawn as bold ink, no presence dot. A copy will always
// drift; the fix is that there is no copy. One component, three call sites.
test('the chat and team rails exist once, and the pages and catalogue all render it', async () => {
  const [rail, memberRail, chat, team, kit] = await Promise.all([
    read('../src/components/ui/Navigation/ChannelRail.jsx'),
    read('../src/components/ui/Navigation/MemberRail.jsx'),
    read('../src/app/(app)/chat/page.js'),
    read('../src/app/(app)/team/page.js'),
    read('../src/app/ui-kit/page.js'),
  ]);

  // The markup lives in the components and nowhere else.
  assert.match(rail, /data-ui-control="chat-list-action"/);
  assert.match(rail, /bg-\[#ebebeb\] text-ink font-semibold/);
  assert.match(memberRail, /rounded-\[8px\][\s\S]{0,80}isSelected \? 'bg-\[#ebebeb\]'/);
  assert.match(memberRail, /<UserAvatar user=\{member\} size="md" \/>/);
  assert.match(memberRail, /text-\[13px\] font-medium truncate/);
  assert.match(memberRail, /w-2\.5 h-2\.5 bg-\[#10b981\] rounded-full ring-2 ring-canvas/);

  for (const [name, source] of [['chat', chat], ['team', team], ['kit', kit]]) {
    assert.doesNotMatch(
      source,
      /data-ui-control="chat-list-action"|isSelected \? 'bg-\[#ebebeb\]'/,
      `${name} must render the shared rail, not its own copy of the markup`,
    );
  }
  assert.match(chat, /<ChannelRail/);
  assert.match(team, /<MemberRail/);
  assert.match(kit, /<ChannelRail/);
  assert.match(kit, /<MemberRail/);
});

test('both entry points to project settings offer the same capabilities', async () => {
  const [projectPage, list] = await Promise.all([
    read('../src/app/(app)/[projectId]/page.js'),
    read('../src/app/(app)/page.js'),
  ]);
  // Opening "Налаштування проєкту" from the kebab included archive, delete and
  // invites; opening it inside the project silently dropped all three.
  for (const source of [projectPage, list]) {
    const at = source.indexOf('<BoardConfigModal');
    const call = source.slice(at, at + 600);
    for (const prop of ['canInvite', 'onArchive', 'onUnarchive', 'onDelete']) {
      assert.match(call, new RegExp(`${prop}=`), `BoardConfigModal must receive ${prop}`);
    }
  }
  // Archiving or deleting the project you are standing in has to leave it.
  assert.match(projectPage, /handleArchiveProject[\s\S]{0,220}router\.push\('\/'\)/);
  assert.match(projectPage, /handleDeleteProject[\s\S]{0,220}router\.push\('\/'\)/);
});
