import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// What a screen costs to open.
//
// Production runs on a hard daily read cap, and the two outages this product
// has had were not caused by traffic — they were caused by three lines of code
// each. A capsule that asked the server what a task was called, once per
// capsule. A badge that subscribed to a whole channel's history, once per card.
// An audit log that read four hundred documents and kept fifty. None of those
// looked expensive at the call site, and none of them was caught by review.
//
// So the rule is mechanical: a live listener over a collection is bounded, by
// `limit()`, or it is named here with the reason it cannot grow. Adding a
// listener is a cost decision, and this is where that decision is recorded.

const root = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? sourceFiles(full)
      : (/\.(js|jsx|mjs)$/.test(full) ? [full] : []);
  });
}

/**
 * Every `onSnapshot` in the product, with what the fifteen lines above it say
 * about the query. Fifteen is enough for every query in this codebase and is
 * checked below: a listener whose collection cannot be seen is reported too,
 * rather than quietly passing.
 */
function listeners() {
  const found = [];
  for (const file of sourceFiles(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('onSnapshot(')) return;
      const context = lines.slice(Math.max(0, index - 15), index + 6).join('\n');
      const collectionMatch = context.match(/collection\(\s*db,\s*'([^']+)'/);
      found.push({
        file: relative(root, file).split(sep).join('/'),
        line: index + 1,
        collection: collectionMatch?.[1] || null,
        bounded: /\blimit\(/.test(context),
        // A listener on one document reads one document, whatever else is true.
        singleDocument: !/collection\(/.test(context) && /\bdoc\(/.test(context),
      });
    });
  }
  return found;
}

// Listeners over a collection with no `limit()`. Each one is here because
// something other than a limit bounds it — and that something is written down,
// because «it is small today» is how the last two outages started.
const BOUNDED_WITHOUT_LIMIT = new Map([
  // Bounded by the size of the organization: one document per member, per
  // project, per channel, per sprint. These grow with the team, not with use.
  ['lib/context/OrgContext.js', 'memberships and organizations of one user'],
  ['lib/hooks/useOrganization.js', 'one organization document and its members'],
  ['lib/hooks/useOrganizationPresence.js', 'one presence document per member'],
  ['lib/hooks/useProjects.js', 'projects of one organization'],
  ['lib/hooks/useSprints.js', 'sprints of one project'],
  ['lib/hooks/useWorkflowConfig.js', 'one settings document'],
  ['lib/hooks/useQtPlusEnabled.js', 'one settings document'],
  ['lib/hooks/usePortalIntegration.js', 'one integration document per project'],
  ['lib/hooks/useUnreadChatCount.js', 'channels and read cursors of one organization'],
  ['components/IssueReadStateBridge.jsx', 'one read cursor per task this user opened'],
  ['app/(app)/chat/page.js', 'presence and channels of one organization'],
  ['lib/hooks/useWorkspaceChat.js', 'channels of one organization; messages ARE limited'],
  ['lib/hooks/useStagesForProject.js', 'stages of one project'],
  ['lib/portal/usePortalStages.js', 'stages of one project'],
  ['lib/portal/usePortalStageMaterials.js', 'materials of one stage'],
  ['lib/portal/usePortalChat.js', 'one portal conversation'],
  ['components/workspace/BillingTab.jsx', 'invoices of one project'],

  // Bounded by the work itself, and reviewed as a deliberate cost: these are
  // the task datasets the boards, the analytics and «Мої завдання» are made of.
  // They are the product's core read, and the one thing left that grows without
  // a ceiling as the workspace ages. See docs/ARCHITECTURE.md → «Вартість читання».
  ['lib/hooks/useIssues.js', 'tasks and links of one project — the board itself'],
  ['lib/hooks/useAllMyTasks.js', 'tasks assigned to one person'],
  ['lib/hooks/useWorkspaceAnalytics.js', 'the datasets an analytics page is'],
  ['app/(app)/page.js', 'tasks of the projects this user can open — the dashboard'],
  ['lib/hooks/useTimeLogs.js', 'time logged against one task'],
  ['lib/hooks/useProjectTimeLogs.js', 'time logged against one project'],
  ['lib/hooks/useProjectAllTimeLogs.js', 'time logged against one project'],
  ['lib/hooks/useNotifications.js', 'the notification stream, itself limited by query'],
  ['lib/hooks/useAuth.js', 'one user document'],
]);

test('every live listener over a collection is bounded, or says why it cannot grow', () => {
  const unbounded = listeners()
    .filter(entry => !entry.singleDocument && !entry.bounded)
    .filter(entry => !BOUNDED_WITHOUT_LIMIT.has(entry.file))
    .map(entry => `${entry.file}:${entry.line}`);

  assert.deepEqual(
    unbounded,
    [],
    'A new listener reads its whole collection on every screen that mounts it. '
    + 'Give it a limit(), or add it to BOUNDED_WITHOUT_LIMIT with the reason it cannot grow.',
  );
});

test('the listeners that carry a limit keep carrying it', () => {
  const mustBeBounded = [
    'lib/hooks/useComments.js',
    'lib/hooks/useAuditLog.js',
  ];
  const bounded = new Set(listeners().filter(entry => entry.bounded).map(entry => entry.file));
  for (const file of mustBeBounded) {
    assert.ok(
      bounded.has(file),
      `${file} reads a history that grows forever; it must stay windowed by limit().`,
    );
  }
});

test('the allowlist does not outlive the files it names', () => {
  const seen = new Set(listeners().map(entry => entry.file));
  const stale = [...BOUNDED_WITHOUT_LIMIT.keys()].filter(file => !seen.has(file));
  assert.deepEqual(stale, [], 'These files no longer listen to anything; drop them from the list.');
});

// A mention is an exact key, and an exact key is one query. Search reads the
// whole organization to rank it, so nothing that renders per element may call
// it — that is what spent a day's quota on drawing eight words.
test('nothing that renders per element resolves itself through search', () => {
  const renderers = [
    'components/workspace/IssueMentionChip.jsx',
    'components/workspace/HoverCard.jsx',
    'components/workspace/MessageContent.jsx',
    'components/workspace/MentionText.jsx',
  ];
  for (const file of renderers) {
    const source = readFileSync(join(root, file.split('/').join(sep)), 'utf8');
    assert.doesNotMatch(source, /api\/search/, `${file} must not ask search to draw itself`);
  }
});
