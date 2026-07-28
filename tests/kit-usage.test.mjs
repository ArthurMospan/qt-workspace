import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanKitUsage } from '../scripts/scan-kit-usage.mjs';

const committed = JSON.parse(
  readFileSync(new URL('../src/app/ui-kit/kit-usage.generated.json', import.meta.url), 'utf8'),
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

test('usage is counted from imports, not from bare name occurrences', () => {
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
});

test('every recorded usage really imports the component it is credited with', () => {
  for (const [name, entry] of Object.entries(committed.components)) {
    assert.equal(entry.count, entry.usedIn.length, `${name}: count and usedIn disagree`);
    for (const file of entry.usedIn) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(source, /@\/components\/ui/, `${file} credited to ${name} imports nothing from the kit`);
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
