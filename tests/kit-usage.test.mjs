import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanKitUsage } from '../scripts/scan-kit-usage.mjs';
import { auditUiFidelity } from '../scripts/audit-ui-fidelity.mjs';

const committed = JSON.parse(
  readFileSync(new URL('../src/app/ui-kit/kit-usage.generated.json', import.meta.url), 'utf8'),
);
const committedFidelityAudit = JSON.parse(
  readFileSync(new URL('../src/app/ui-kit/fidelity-audit.generated.json', import.meta.url), 'utf8'),
);

// This is the whole anti-drift mechanism. /ui-kit is hand-written, so it had no
// way of knowing what the product uses and slowly stopped describing the site.
// The status screen now reads generated data — and this test is what keeps that
// data true: start using a kit component, or stop, and the build fails until
// `npm run kit:scan` is run.
test('the committed kit usage data matches the code', () => {
  const fresh = scanKitUsage();
  assert.deepEqual(
    fresh,
    committed,
    'kit-usage.generated.json is stale — run `npm run kit:scan` and commit the result',
  );
});

test('the committed UI fidelity audit matches every product UI file', () => {
  assert.deepEqual(
    auditUiFidelity(),
    committedFidelityAudit,
    'fidelity-audit.generated.json is stale — run `npm run kit:audit` and review every changed drift category',
  );
  assert.equal(committedFidelityAudit.totals.parseErrors, 0);
  assert.deepEqual(committedFidelityAudit.parseErrors, []);
});

test('new UI work cannot silently grow the audited drift baseline', () => {
  const maximums = {
    manualLabels: 0,
    manualModalShells: 0,
    manualPills: 0,
    manualSurfaces: 0,
    manualIconButtons: 0,
    headingStyles: 0,
    sharedChromeOverrides: 0,
    localSharedNameCollisions: 0,
    localSurfaceExceptions: 68,
    reviewedNativeControls: 18,
  };
  for (const [category, maximum] of Object.entries(maximums)) {
    assert.ok(
      committedFidelityAudit.totals[category] <= maximum,
      `${category} grew from the audited baseline (${maximum}) to ${committedFidelityAudit.totals[category]}; reuse the UI Kit or add an approved named context`,
    );
  }
  assert.deepEqual(
    committedFidelityAudit.repeatedNativeFingerprints,
    [],
    'Repeated native-control fingerprints must become a shared component/preset or receive an explicit reviewed context',
  );

  const legacyUnused = new Set([
    'Avatar',
    'AvatarGroup',
    'Badge',
    'Breadcrumb',
    'ButtonGroup',
    'Chip',
    'CommentThread',
    'Container',
    'Dropdown',
    'FileInput',
    'Grid',
    'HeaderSearch',
    'ListItem',
    'PageContentWrapper',
    'PageLayout',
    'Pagination',
    'Progress',
    'ProgressRing',
    'ProjectCard',
    'RadioButton',
    'SearchInput',
    'Spacer',
    'SplitButton',
    'Stack',
    'Stat',
    'StatusBadge',
    'Stepper',
    'Table',
    'TaskCard',
    'TeamMemberCard',
    'TimeLogDisplay',
    'TimePicker',
    'Toast',
  ]);
  const unexpectedUnused = committedFidelityAudit.kit.unusedComponents
    .filter(name => !legacyUnused.has(name));
  assert.deepEqual(
    unexpectedUnused,
    [],
    `New shared components must be used by the product and shown in /ui-kit in the same change: ${unexpectedUnused.join(', ')}`,
  );
});

test('the durable repository instructions keep product and UI Kit changes atomic', () => {
  const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
  const contract = readFileSync(new URL('../docs/UI_KIT_CONTRACT.md', import.meta.url), 'utf8');
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(agents, /Treat the authenticated workspace and `\/ui-kit` as one UI contract/);
  assert.match(agents, /used by the product, and rendered in `\/ui-kit` in the same change/);
  assert.match(agents, /npm run kit:scan/);
  assert.match(agents, /npm run kit:audit/);
  assert.match(contract, /A new shared component is exported[\s\S]*used by[\s\S]*rendered in `\/ui-kit` in the same change/);
  assert.equal(packageJson.scripts['kit:audit'], 'node scripts/audit-ui-fidelity.mjs');
});

test('the fidelity decision record contains every approved audit decision', () => {
  const page = readFileSync(new URL('../src/app/ui-kit/page.js', import.meta.url), 'utf8');
  const survey = readFileSync(new URL('../src/app/ui-kit/FidelitySurvey.jsx', import.meta.url), 'utf8');
  const questionIds = [...survey.matchAll(/^    id: '([^']+)',/gm)].map(match => match[1]);

  assert.deepEqual(questionIds, [
    'token-source',
    'form-labels',
    'side-sheets',
    'pill-taxonomy',
    'icon-actions',
    'control-compositions',
    'component-twins',
    'surface-boundary',
    'typography-contexts',
    'catalog-scope',
  ]);
  assert.match(page, /import FidelitySurvey from '\.\/FidelitySurvey';/);
  assert.match(page, /\{ id: 'fidelity-survey', label: 'Опитування розбіжностей'/);
  assert.match(page, /'fidelity-survey': <FidelitySurvey \/>/);
  assert.match(survey, /fidelity-audit\.generated\.json/);
  assert.match(survey, /navigator\.clipboard\.writeText/);
  assert.match(survey, /'catalog-scope': 'authenticated-workspace'/);
  assert.match(survey, /disabled/);
});

test('the approved follow-up decisions are read-only and encoded in the product', () => {
  const page = readFileSync(new URL('../src/app/ui-kit/page.js', import.meta.url), 'utf8');
  const record = readFileSync(new URL('../src/app/ui-kit/FidelityFollowUpSurvey.jsx', import.meta.url), 'utf8');
  const taskList = readFileSync(new URL('../src/components/ui/TaskManagement/TaskListView.jsx', import.meta.url), 'utf8');
  const taskRow = readFileSync(new URL('../src/components/ui/TaskManagement/TaskRow.jsx', import.meta.url), 'utf8');
  const createTask = readFileSync(new URL('../src/components/CreateTaskModal.jsx', import.meta.url), 'utf8');
  const issueDetail = readFileSync(new URL('../src/components/workspace/IssueDetail.jsx', import.meta.url), 'utf8');
  const agileBoard = readFileSync(new URL('../src/components/workspace/AgileBoard.jsx', import.meta.url), 'utf8');
  const myTasks = readFileSync(new URL('../src/app/(app)/my/page.js', import.meta.url), 'utf8');
  const project = readFileSync(new URL('../src/app/(app)/[projectId]/page.js', import.meta.url), 'utf8');
  const questionIds = [...record.matchAll(/^    id: '([^']+)',/gm)].map(match => match[1]);

  assert.deepEqual(questionIds, [
    'hidden-kanban-columns',
    'hidden-list-items',
    'task-create-entry',
    'project-identity',
    'legacy-epic-policy',
    'task-hierarchy',
  ]);
  assert.match(page, /import FidelityFollowUpSurvey from '\.\/FidelityFollowUpSurvey';/);
  assert.match(page, /'fidelity-follow-up': <FidelityFollowUpSurvey \/>/);
  for (const approvedChoice of [
    "'hidden-kanban-columns': 'context-hidden-lane'",
    "'hidden-list-items': 'group-both-lists'",
    "'task-create-entry': 'context-create'",
    "'project-identity': 'cross-project-only'",
    "'legacy-epic-policy': 'legacy-read-only'",
    "'task-hierarchy': 'real-child-issues'",
  ]) {
    assert.ok(record.includes(approvedChoice), `missing approved follow-up decision: ${approvedChoice}`);
  }
  assert.match(record, /const selectedChoice = question\.choices\.find/);
  assert.doesNotMatch(record, /question\.choices\.map/);
  assert.doesNotMatch(record, /setAnswers|localStorage/);

  assert.match(taskList, /hiddenStatusIds = \[\]/);
  assert.match(taskList, /visibleStatuses = statuses\.filter/);
  assert.match(taskList, /label: 'Приховані'/);
  assert.match(taskList, /showProjectName=\{showProjectName\}/);
  assert.match(taskRow, /showProjectName = false/);
  assert.match(taskRow, /showProjectName && projectName/);
  assert.match(myTasks, /hiddenStatusIds=\{hiddenColumns\}/);
  assert.match(project, /hiddenStatusIds=\{project\?\.hiddenColumns \|\| \[\]\}/);
  assert.match(myTasks, /<AgileBoard[\s\S]{0,500}showHiddenLane/);
  assert.match(myTasks, /<AgileBoard[\s\S]{0,600}onRequestAddIssue=/);
  assert.doesNotMatch(project, /<AgileBoard[\s\S]{0,700}showHiddenLane/);

  assert.match(createTask, /types\.filter\(type => type\.id !== 'epic'\)/);
  assert.match(createTask, /options=\{creatableTypes\.map/);
  assert.match(issueDetail, /parentIssueId: issueId/);
  assert.match(issueDetail, /legacy-checklist/);
  assert.doesNotMatch(issueDetail, /update\(\{\s*subtasks|subtasks:\s*arrayUnion/);
  assert.match(issueDetail, /ISSUE_LINK_OPTIONS/);
  assert.match(agileBoard, /collapseHierarchy = false/);
  assert.match(project, /collapseHierarchy/);
  assert.doesNotMatch(agileBoard, /parentEpicId|swimlane === 'epic'/);
});

test('usage requires an imported component to be rendered as JSX', () => {
  const { components } = committed;
  // `Stat` appears inside every `useState`/`Status`, and `Grid` inside every
  // `grid` class. A substring-based scan reported both as heavily used; only an
  // import-based one can tell that nothing actually imports them.
  for (const name of ['Stat', 'Grid']) {
    assert.ok(name in components, `${name} should be in the inventory`);
    for (const file of components[name].usedIn) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(
        source,
        new RegExp(`^import[^;]*\\b${name}\\b[^;]*from\\s+['"]@/components/ui`, 'm'),
        `${file} is listed as using ${name} but does not import it`,
      );
    }
  }

  // Stale imports must not make a component look like live product UI.
  for (const name of ['Badge', 'StatusBadge', 'TaskCard']) {
    assert.equal(components[name].count, 0, `${name} is imported but not rendered`);
  }
});

test('every recorded usage really imports the component it is credited with', () => {
  for (const [name, entry] of Object.entries(committed.components)) {
    assert.equal(entry.count, entry.usedIn.length, `${name}: count and usedIn disagree`);
    for (const file of entry.usedIn) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(source, /@\/components\/ui/, `${file} credited to ${name} imports nothing from the kit`);
      assert.match(
        source,
        new RegExp(`<${name}\\b`),
        `${file} is credited to ${name} but never renders it`,
      );
    }
  }
});

test('the showcase pages are never counted as product usage', () => {
  for (const [name, entry] of Object.entries(committed.components)) {
    for (const file of entry.usedIn) {
      assert.ok(
        !file.startsWith('src/app/ui-kit/') &&
        !file.startsWith('src/app/ui-diff/') &&
        !file.startsWith('src/components/ui/'),
        `${name} is credited to ${file}, which is the kit or a showcase page`,
      );
    }
  }
});

test('components known to be live are reported as live', () => {
  // Regression guard for a real bug in the scanner: the import pattern used to
  // span statements, so the capture ran from a file's first import to its first
  // kit import and silently swallowed the names in between. These two are
  // imported on a line of their own, far down the file — exactly the shape that
  // was being lost.
  for (const name of ['ConfirmProvider', 'TopHeader', 'Button', 'Select']) {
    assert.ok(committed.components[name].count > 0, `${name} should be reported as used`);
  }
});

test('every UI component used by the product is showcased in /ui-kit', () => {
  const uncovered = Object.entries(committed.components)
    .filter(([, entry]) => entry.count > 0 && !entry.showcased)
    .map(([name]) => name);
  const showcasedButUnused = Object.entries(committed.components)
    .filter(([, entry]) => entry.count === 0 && entry.showcased)
    .map(([name]) => name);

  assert.deepEqual(
    uncovered,
    [],
    `Live product components missing from /ui-kit: ${uncovered.join(', ')}`,
  );
  assert.equal(committed.totals.uncovered, 0);
  assert.equal(committed.totals.covered, committed.totals.used);
  assert.deepEqual(
    showcasedButUnused,
    [],
    `Unused components must not be visible in /ui-kit: ${showcasedButUnused.join(', ')}`,
  );
});

test('high-risk composed previews keep the product markup signatures', () => {
  const kit = readFileSync(new URL('../src/app/ui-kit/page.js', import.meta.url), 'utf8');
  const chat = readFileSync(new URL('../src/app/(app)/chat/page.js', import.meta.url), 'utf8');
  const projects = readFileSync(new URL('../src/app/(app)/page.js', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/app/(app)/settings/page.js', import.meta.url), 'utf8');
  const issueDetail = readFileSync(new URL('../src/components/workspace/IssueDetail.jsx', import.meta.url), 'utf8');
  const calendarEvent = readFileSync(new URL('../src/components/workspace/calendar/CalendarEventPage.jsx', import.meta.url), 'utf8');
  const timeline = readFileSync(new URL('../src/components/workspace/UnifiedTimeline.jsx', import.meta.url), 'utf8');
  const qtPlusComposer = readFileSync(new URL('../src/components/workspace/qtplus/chat/ChatComposer.jsx', import.meta.url), 'utf8');
  const composerCore = readFileSync(new URL('../src/components/ui/ChatComposerCore.jsx', import.meta.url), 'utf8');
  const taskAttributes = readFileSync(new URL('../src/components/ui/Layout/TaskAttributesPanel.jsx', import.meta.url), 'utf8');

  for (const signature of [
    'overflow-hidden rounded-2xl border border-line bg-white transition-all hover:border-[#cfcfcf] focus-within:border-[#cfcfcf] focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
    'w-full px-4 py-3.5 text-[14px] text-ink placeholder-[#b0b0b0] bg-transparent outline-none resize-none max-h-[200px] leading-relaxed',
    'overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.04] transition-all hover:ring-black/10 focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
    'custom-scrollbar min-h-[36px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-[14px] leading-5 text-ink outline-none placeholder:text-muted',
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105 disabled:bg-[#cfcfcf] disabled:hover:scale-100',
    'flex min-h-[44px] items-end gap-1 rounded-[24px] bg-white p-1 ring-1 ring-black/[0.04] transition-all focus-within:ring-4 focus-within:ring-black/10 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
    'max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-5 text-ink outline-none placeholder:text-muted disabled:opacity-50',
  ]) {
    assert.ok(composerCore.includes(signature), `shared composer core lost product geometry: ${signature}`);
  }
  assert.match(chat, /<ChatComposerCore[\s\S]*variant="workspace"/);
  assert.match(timeline, /<ChatComposerCore[\s\S]*variant="timeline"/);
  assert.match(qtPlusComposer, /<ChatComposerCore[\s\S]*variant="qtplus"/);
  for (const variant of ['workspace', 'timeline', 'qtplus']) {
    assert.match(kit, new RegExp(`<ChatComposerCore[\\s\\S]{0,220}variant="${variant}"`));
  }

  assert.match(projects, /<EmptyState[\s\S]{0,1200}context="page"/);
  assert.match(kit, /<EmptyState[\s\S]{0,1200}context="page"/);
  assert.doesNotMatch(projects, /<EmptyState[\s\S]{0,320}className="min-h-\[328px\]"/);

  assert.match(issueDetail, /getTaskAttributeChrome\(\{ condensed: isHeaderScrolled \}\)/);
  assert.match(issueDetail, /<TaskAttributesPanel[\s\S]{0,120}context="task"/);
  assert.match(calendarEvent, /getTaskAttributeChrome\(\)/);
  assert.match(calendarEvent, /<TaskAttributesPanel[\s\S]{0,120}context="calendar"/);
  assert.match(taskAttributes, /task: 'grid w-full grid-cols-\[repeat\(3,minmax\(0,1fr\)\)_32px\]/);
  assert.match(taskAttributes, /calendar: 'grid w-full grid-cols-2/);
  assert.match(taskAttributes, /compactSelectClass: 'h-\[22px\][^']*rounded-\[10px\]/);
  assert.match(kit, /getTaskAttributeChrome\(\)/);
  assert.match(kit, /<TaskAttributesPanel[\s\S]{0,120}context="task"/);
  assert.match(kit, /<TaskAttributesPanel[\s\S]{0,120}context="calendar"/);

  for (const role of ['member', 'date', 'sort']) {
    assert.match(projects, new RegExp(`filterRole="${role}"`));
    assert.match(kit, new RegExp(`filterRole="${role}"`));
  }

  for (const signature of [
    'flex-1 overflow-y-auto custom-scrollbar bg-canvas relative',
    'max-w-[760px] mx-auto px-[16px] py-[24px] md:px-[32px] md:py-[48px] min-h-full flex flex-col',
  ]) {
    assert.ok(settings.includes(signature), `settings product signature changed: ${signature}`);
    assert.ok(kit.includes(signature), `settings /ui-kit preview does not mirror: ${signature}`);
  }
});

test('the atomic hierarchy and section renderer stay in sync', () => {
  const source = readFileSync(new URL('../src/app/ui-kit/page.js', import.meta.url), 'utf8');
  const groupsSource = source.slice(source.indexOf('const GROUPS'), source.indexOf('const SECTIONS'));
  const mapSource = source.slice(source.indexOf('const SECTION_MAP'), source.indexOf('// MAIN PAGE'));

  for (const layer of ['Атоми (Atoms)', 'Молекули (Molecules)', 'Організми (Organisms)', 'Лейаути (Layouts)']) {
    assert.match(groupsSource, new RegExp(layer.replace(/[()]/g, '\\$&')), `Missing ${layer} layer`);
  }

  const sectionIds = [...groupsSource.matchAll(/\{\s*id:\s*'([^']+)'/g)].map(match => match[1]);
  const renderedIds = [...mapSource.matchAll(/^\s*(?:'([^']+)'|([a-z][\w-]*)):\s*</gm)]
    .map(match => match[1] || match[2]);
  assert.deepEqual(
    sectionIds.filter(id => !renderedIds.includes(id)),
    [],
    'A visible navigation section is missing its renderer',
  );

  const sectionFunctions = [...source.matchAll(/^function (\w+Section)\(/gm)].map(match => match[1]);
  const renderedFunctions = new Set(
    [...mapSource.matchAll(/<([A-Z]\w+Section)\s*\/>/g)].map(match => match[1]),
  );
  assert.deepEqual(
    sectionFunctions.filter(name => !renderedFunctions.has(name)),
    [],
    'Dead section functions duplicate previews without being reachable from the hierarchy',
  );
});

test('the approved decision record keeps every audited divergence canonical and read-only', () => {
  const page = readFileSync(new URL('../src/app/ui-kit/page.js', import.meta.url), 'utf8');
  const lab = readFileSync(new URL('../src/app/ui-kit/DecisionLab.jsx', import.meta.url), 'utf8');
  const decisionIds = [...lab.matchAll(/^    id: '([^']+)',/gm)].map(match => match[1]);

  assert.deepEqual(decisionIds, [
    'button-colors',
    'typography',
    'control-heights',
    'chat-composers',
    'task-attributes',
    'cards-surfaces',
    'filter-bars',
    'sprint-badge',
    'empty-states',
    'manual-controls',
  ]);
  assert.match(page, /import DecisionLab from '\.\/DecisionLab';/);
  assert.match(page, /\{ id: 'decision-lab', label: 'Затверджені рішення'/);
  assert.match(page, /'decision-lab': <DecisionLab \/>/);
  assert.match(page, /useState\('kit-status'\)/);
  assert.match(lab, /const APPROVED_ANSWERS =/);
  assert.match(lab, /const selectedChoice = decision\.choices\.find/);
  assert.doesNotMatch(lab, /decision\.choices\.map/);
  assert.doesNotMatch(lab, /const choose =/);
  assert.match(lab, /navigator\.clipboard\.writeText/);
  assert.match(lab, /Брендинг не входить в опитування/);
  assert.match(lab, /тільки sidebar/);
  for (const approvedChoice of [
    "'button-colors': 'dark-red-only'",
    "typography: 'live-24-18'",
    "'control-heights': 'named-sizes'",
    "'chat-composers': 'shared-core-context-shells'",
    "'task-attributes': 'same-chrome-different-fields'",
    "'cards-surfaces': 'named-context-presets'",
    "'filter-bars': 'content-presets'",
    "'sprint-badge': 'shared-status-pill'",
    "'empty-states': 'context-props'",
    "'manual-controls': 'extract-repeated-only'",
  ]) {
    assert.ok(lab.includes(approvedChoice), `missing approved decision: ${approvedChoice}`);
  }
});

test('approved UI decisions stay encoded in shared components', () => {
  const tokens = readFileSync(new URL('../src/lib/design/tokens.js', import.meta.url), 'utf8');
  const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  const input = readFileSync(new URL('../src/components/ui/Input.jsx', import.meta.url), 'utf8');
  const select = readFileSync(new URL('../src/components/ui/Select.jsx', import.meta.url), 'utf8');
  const emptyState = readFileSync(new URL('../src/components/ui/Feedback/EmptyState.jsx', import.meta.url), 'utf8');
  const filterBar = readFileSync(new URL('../src/components/ui/FilterBar.jsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/ui/Layout/Card.jsx', import.meta.url), 'utf8');
  const surface = readFileSync(new URL('../src/components/ui/Surface.jsx', import.meta.url), 'utf8');
  const sprints = readFileSync(new URL('../src/app/(app)/sprints/page.js', import.meta.url), 'utf8');

  assert.match(tokens, /h1: \{ size: '24px'/);
  assert.match(tokens, /h2: \{ size: '18px'/);
  assert.doesNotMatch(tokens, /buttonPrimary:[\s\S]{0,900}\bblue:/);
  for (const size of ['sm', 'md', 'lg']) {
    assert.match(globals, new RegExp(`--ui-control-${size}:`));
  }
  assert.match(input, /data-ui-size=\{size\}/);
  assert.match(select, /data-ui-size=\{variant === 'ghost' \? 'sm' : size\}/);
  assert.match(globals, /\.ui-type-page-title/);
  assert.match(globals, /\.ui-type-section-title/);
  assert.match(globals, /\.ui-pill/);
  assert.match(globals, /\.ui-surface/);
  for (const context of ['page', 'inset', 'flexible', 'centered']) {
    assert.match(emptyState, new RegExp(`${context}:`));
  }
  for (const role of ['type', 'date', 'member', 'project', 'sort']) {
    assert.match(filterBar, new RegExp(`${role}: 'w-\\[`));
  }
  for (const preset of ['bordered', 'borderless', 'canvas']) {
    assert.match(card, new RegExp(`${preset}:`));
  }
  for (const preset of ['panel', 'card', 'inset', "'nested-card'", "'bordered-panel'"]) {
    assert.ok(surface.includes(`${preset}:`), `Surface preset missing: ${preset}`);
  }
  assert.match(sprints, /<StatusPill label="Активний"/);
  assert.doesNotMatch(sprints, /function Badge\(/);
  assert.doesNotMatch(sprints, /<select\b/);
});

test('local reference pages do not depend on a working login flow', () => {
  const source = readFileSync(new URL('../src/proxy.js', import.meta.url), 'utf8');
  const developmentBypass = source.indexOf("process.env.NODE_ENV === 'development'");
  const sessionLookup = source.indexOf("request.cookies.get('qt_session')");

  assert.ok(developmentBypass >= 0, 'the local UI reference pages need a development-only auth bypass');
  assert.ok(
    developmentBypass < sessionLookup,
    'the development bypass must run before Firebase session verification',
  );
  assert.match(source, /pathname === '\/ui-kit'/);
  assert.match(source, /pathname === '\/ui-diff'/);
  assert.match(source, /if \(isDevelopmentReferencePage\) return NextResponse\.next\(\)/);
  assert.match(
    source,
    /if \(!hasSession\)[\s\S]*NextResponse\.redirect\(loginUrl\)/,
    'production reference pages must remain session-protected',
  );
});
