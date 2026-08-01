import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditComposition } from '../scripts/kit-composition.mjs';
import { extractVariants } from '../scripts/kit-variants.mjs';

const committed = JSON.parse(
  readFileSync(new URL('../src/app/ui-kit/composition-audit.generated.json', import.meta.url), 'utf8'),
);
const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('the committed composition audit matches the stylesheet', () => {
  assert.deepEqual(
    auditComposition(),
    committed,
    'composition-audit.generated.json is stale — run `npm run kit:composition` and commit the result',
  );
});

// The contract zero. A `data-ui-*` rule inside `@layer components` may not
// declare a property the owning component also writes as a utility: Tailwind
// emits the utility layer last, and layer order beats specificity outright, so
// such a declaration is documentation that cannot come true.
test('no data-ui-* declaration is shadowed by the component that carries it', () => {
  assert.deepEqual(
    committed.shadowed,
    [],
    'A shadowed declaration must be removed, or the utility that beats it must go — it cannot stay and mean nothing',
  );
  assert.equal(committed.totals.shadowed, 0);
  assert.ok(committed.totals.declarations > 100, 'the audit still reads the whole components layer');
});

// Custom properties are the supported way to hand a value to a component,
// because no utility can set one. This is why `--ui-control-height` works while
// every `padding` beside it did not.
test('the presets keep the one mechanism that survives the cascade', () => {
  assert.match(globals, /--ui-control-height: var\(--ui-composition-metric\)/);
  assert.match(globals, /--ui-control-height: var\(--ui-composition-guard\)/);
  assert.match(globals, /--ui-control-height: var\(--ui-composition-invite\)/);
  assert.match(globals, /--ui-control-line: calc\(var\(--ui-control-height\) - 24px\)/);
});

// Removing the dead declarations must not remove the compositions themselves:
// the variant manifest reads these selectors, and a value that disappears here
// becomes an undeclared value at every call site that still passes it.
test('every composition the product passes is still declared', () => {
  const manifest = extractVariants();
  for (const [component, values] of Object.entries({
    Input: ['metric-editor', 'metric-text', 'invite-field', 'inline-edit', 'duration-hours', 'duration-minutes', 'duration-compact-hours', 'duration-compact-minutes', 'status-entry', 'project-name'],
    Segmented: ['dialog-tabs', 'billing-selection'],
    Textarea: ['transcript', 'audio-transcript', 'project-description', 'long-form', 'settings-note'],
    Button: ['menu-item', 'settings-row-action', 'status-submit', 'workspace-guard', 'inline-add-action'],
  })) {
    for (const value of values) {
      assert.ok(
        manifest[component].composition.includes(value),
        `${component} lost the declared composition "${value}"`,
      );
    }
  }
});

// The cleanup was a no-op on screen — the utilities were already winning — and
// that is the whole reason it was safe. These are the values the browser
// reported on /ui-kit both before and after, kept here so a later change that
// does move them has to say so.
test('the surviving declarations are the ones that reach the screen', () => {
  // `flex: 1` is all the dialog-tabs preset ever delivered.
  assert.match(globals, /data-ui-composition='dialog-tabs'\] > button \{\s*flex: 1;\s*\}/);
  // Line height is all the transcript presets ever delivered.
  assert.match(globals, /data-ui-composition='transcript'\] \{\s*line-height: 20px;\s*\}/);
  // The invite field keeps its radius, which no utility sets, and loses the
  // 150px of room it never had.
  assert.match(globals, /data-ui-composition='invite-field'\] \{[^}]*border-radius: 14px;[^}]*\}/);
  assert.doesNotMatch(globals, /padding-right: 150px/);
  assert.doesNotMatch(globals, /padding-right: 54px/);
});

test('the composition audit is documented where the rules live', () => {
  const contract = readFileSync(new URL('../docs/UI_KIT_CONTRACT.md', import.meta.url), 'utf8');
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['kit:composition'], 'node scripts/kit-composition.mjs');
  assert.match(contract, /kit:composition/);
});
