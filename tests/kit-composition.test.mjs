import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layeredCompositionRules } from '../scripts/kit-composition.mjs';
import { extractVariants } from '../scripts/kit-variants.mjs';

const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

// Whether a declaration survives the cascade is decided in a browser, by
// tests/visual/ui-kit.spec.mjs: `@layer components` loses to Tailwind's utility
// layer regardless of specificity, and no static rule reliably tells an
// unconditional utility from a variant or an error branch. What is checkable
// here is what the stylesheet declares, and that the presets keep the one
// mechanism a utility cannot touch.
test('the composition rules are readable, and only declare what can travel', () => {
  const rules = layeredCompositionRules(globals);
  assert.ok(rules.length > 20, 'the components layer must still be parsed');

  for (const rule of rules) {
    assert.doesNotMatch(rule.selector, /\/\*/, 'a selector must not swallow its comment');
    for (const { property } of rule.declarations) {
      assert.doesNotMatch(property, /^--/, 'custom properties are exempt and must not be listed');
    }
  }
});

// Custom properties are the supported way to hand a value to a component: no
// utility can set one. This is why `--ui-control-height` works while every
// `padding` beside it did not.
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

// What each preset actually delivered, measured in the browser before the
// cleanup and unchanged by it. Kept here so a later edit that does move one has
// to say so.
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

test('the browser is the one that decides, and the rules say so', () => {
  const spec = readFileSync(new URL('./visual/ui-kit.spec.mjs', import.meta.url), 'utf8');
  const contract = readFileSync(new URL('../docs/UI_KIT_CONTRACT.md', import.meta.url), 'utf8');

  assert.match(spec, /every data-ui-\* declaration survives the cascade/);
  assert.match(spec, /getComputedStyle/);
  assert.match(contract, /layeredCompositionRules|getComputedStyle/);
});
