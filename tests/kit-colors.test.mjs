// Every colour that is styling comes from a token.
//
// The three reports that already existed could not see this one. `kit:drift`
// asks whether a component is passed a variant it declares; `kit:audit` asks
// whether a control is the kit's. A raw `#f0f0f0` on a div is neither — it is a
// value nobody declared anywhere, which is how the product came to own
// twenty-six status colours and six spellings of its own canvas.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scanColors } from '../scripts/kit-colors.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('no product UI file paints a colour the tokens do not name', () => {
  const { findings } = scanColors();
  assert.deepEqual(
    findings.map(f => `${f.file}:${f.line} ${f.value}`),
    [],
    'use a token utility — ink/canvas/surface/line/muted/faint, the four status '
    + 'scales, or the chart tokens. A colour that is genuinely data belongs in '
    + 'DATA_COLORS in scripts/kit-colors.mjs with its reason.',
  );
});

test('the committed colour report matches the code', async () => {
  const committed = JSON.parse(await read('../src/app/ui-kit/kit-colors.generated.json'));
  const { findings } = scanColors();
  assert.equal(committed.totals.hardcoded, findings.length);
});

test('the status scale is declared once, in three roles, and clears AA on white', async () => {
  const css = await read('../src/app/globals.css');
  const lum = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(s => (s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const onWhite = hex => (1.05) / (lum(hex) + 0.05);

  for (const status of ['success', 'warning', 'danger', 'info']) {
    for (const role of ['', '-solid', '-soft']) {
      assert.match(css, new RegExp(String.raw`--color-${status}${role}:\s*#[0-9a-f]{6};`), `${status}${role}`);
    }
    // The ink is the role that carries text, so it is the one with a floor.
    const ink = css.match(new RegExp(String.raw`--color-${status}:\s*(#[0-9a-f]{6});`))[1];
    const contrast = onWhite(ink);
    assert.ok(contrast >= 4.5, `--color-${status} is ${contrast.toFixed(2)}:1 on white, needs 4.5`);
  }

  // The four Pill tones were the only written-down copy of this palette, which
  // is why the tokens carry their values — and why the tones now read them back
  // instead of holding a second copy.
  for (const tone of ['success', 'warning', 'danger', 'info']) {
    assert.match(
      css,
      new RegExp(String.raw`\[data-ui-pill-tone='${tone}'\] \{\s*background: var\(--color-${tone}-soft\);\s*color: var\(--color-${tone}\);`),
      tone,
    );
  }
});

test('a counter on a branded rail takes the rail’s own two colours', async () => {
  const counter = await read('../src/components/ui/DataDisplay/Counter.jsx');
  // `computeSidebarTheme` guarantees 4.5:1 between --sb-text and --sb-bg on
  // every background an organization can pick, so inverting them is legible by
  // construction. The `bg-ink text-white` span this replaced was ink on ink —
  // contrast 1.0 — on the default dark sidebar.
  assert.match(counter, /appearance === 'sidebar'/);
  assert.match(counter, /bg-\[var\(--sb-text,var\(--color-ink\)\)\] text-\[var\(--sb-bg,var\(--color-surface\)\)\]/);

  const sidebar = await read('../src/components/WorkspaceSidebar.jsx');
  const mobile = await read('../src/components/MobileNav.jsx');
  for (const source of [sidebar, mobile]) {
    assert.match(source, /<Counter value=\{otherOrgUnreadCount\} size="sm" appearance="sidebar" \/>/);
  }
  // And the row it sits in yields the name rather than the chevron: 120px of
  // name plus the counter plus the chevron is 156px in a 140px column.
  assert.match(sidebar, /className="flex w-full min-w-0 items-center gap-\[4px\] cursor-pointer transition-colors"/);
  assert.match(sidebar, /className="min-w-0 truncate transition-all"/);
  assert.doesNotMatch(sidebar, /data-ui-pill="branding-counter"/);
});
