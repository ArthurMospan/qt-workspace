#!/usr/bin/env node
// Scans the codebase for real usage of every UI-kit component and writes the
// result to src/app/ui-kit/kit-usage.generated.json.
//
// Why this exists: /ui-kit is hand-written, so it had no way of knowing what
// the product actually uses. It showcased nine components with zero usages
// alongside ones used in dozens of places, with nothing telling them apart —
// which is what made the kit read as "not matching the site".
//
// Usage is counted from IMPORT STATEMENTS, not from occurrences of the name in
// the source. Counting bare names produces nonsense: "Stat" matches "Status",
// "Grid" matches every `grid` class, and the numbers end up meaningless.
//
// Run `npm run kit:scan` after adding or removing a kit import.
// tests/kit-usage.test.mjs fails if the committed JSON is out of date.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const KIT_DIR = join(ROOT, 'src', 'components', 'ui');
const SCAN_DIRS = [join(ROOT, 'src', 'app'), join(ROOT, 'src', 'components')];
const OUTPUT = join(ROOT, 'src', 'app', 'ui-kit', 'kit-usage.generated.json');
const SHOWCASE_FILE = join(ROOT, 'src', 'app', 'ui-kit', 'page.js');

// The kit itself and the two showcase pages are excluded: a component being
// demoed on /ui-kit is not the same as the product using it.
const EXCLUDED = [
  join('src', 'components', 'ui') + sep,
  join('src', 'app', 'ui-kit') + sep,
  join('src', 'app', 'ui-diff') + sep,
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const toPosix = path => relative(ROOT, path).split(sep).join('/');

// ── Inventory: what the kit actually exports ────────────────────────────────
// The filename is the canonical component name; named exports (MultiSelect in
// Select.jsx, HeaderSearch in Forms/HeaderSearch.jsx) are picked up too.
function buildInventory() {
  const inventory = new Map();
  for (const file of walk(KIT_DIR)) {
    const name = file.split(sep).at(-1).replace(/\.jsx?$/, '');
    if (name === 'index') continue;
    const source = readFileSync(file, 'utf8');
    const names = new Set([name]);
    for (const match of source.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z]\w*)/g)) {
      names.add(match[1]);
    }
    for (const exported of names) {
      if (!inventory.has(exported)) inventory.set(exported, { file: toPosix(file), usedIn: [] });
    }
  }
  return inventory;
}

// ── Usage: who imports from @/components/ui ─────────────────────────────────
// Anchored at the start of a line and forbidden from crossing a `;`, so the
// clause cannot swallow preceding import statements. A [\s\S]*? here matches
// across newlines AND across statements: the capture then starts at the file's
// first import and runs to the first kit import, and every name in between is
// lost. `[^;]` still spans newlines, so multi-line named imports keep working.
const IMPORT_RE = /^import\s+([^;]*?)\s+from\s+['"](@\/components\/ui[^'"]*)['"]/gm;

function importedNames(clause) {
  const names = [];
  const braced = clause.match(/\{([\s\S]*)\}/);
  if (braced) {
    for (const part of braced[1].split(',')) {
      // `Foo as Bar` — the kit component is Foo, the local alias is irrelevant.
      const name = part.split(/\bas\b/)[0].trim();
      if (/^[A-Z]\w*$/.test(name)) names.push(name);
    }
  }
  const leading = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
  if (/^[A-Z]\w*$/.test(leading)) names.push(leading);
  return names;
}

export function scanKitUsage() {
  const inventory = buildInventory();
  const showcased = new Set();

  const showcaseSource = readFileSync(SHOWCASE_FILE, 'utf8');
  for (const match of showcaseSource.matchAll(IMPORT_RE)) {
    for (const name of importedNames(match[1])) {
      // An import alone is not a showcase. Requiring a JSX render prevents a
      // stale/unused import from making coverage look green.
      if (inventory.has(name) && new RegExp(`<${name}\\b`).test(showcaseSource)) {
        showcased.add(name);
      }
    }
  }

  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const rel = relative(ROOT, file);
      if (EXCLUDED.some(prefix => rel.startsWith(prefix))) continue;
      const source = readFileSync(file, 'utf8');
      const seen = new Set();
      for (const match of source.matchAll(IMPORT_RE)) {
        for (const name of importedNames(match[1])) {
          if (inventory.has(name)) seen.add(name);
        }
      }
      for (const name of seen) inventory.get(name).usedIn.push(toPosix(file));
    }
  }

  const components = {};
  for (const name of [...inventory.keys()].sort()) {
    const entry = inventory.get(name);
    components[name] = {
      file: entry.file,
      count: entry.usedIn.length,
      showcased: showcased.has(name),
      usedIn: entry.usedIn.sort(),
    };
  }

  const used = Object.values(components).filter(entry => entry.count > 0).length;
  const covered = Object.values(components).filter(entry => entry.count > 0 && entry.showcased).length;
  return {
    // Regenerate with `npm run kit:scan`; tests/kit-usage.test.mjs enforces it.
    generatedBy: 'scripts/scan-kit-usage.mjs',
    totals: {
      components: Object.keys(components).length,
      used,
      unused: Object.keys(components).length - used,
      covered,
      uncovered: used - covered,
    },
    components,
  };
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'));
if (isDirectRun) {
  const result = scanKitUsage();
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  const { components, used, unused } = result.totals;
  console.log(`kit usage: ${components} components — ${used} used, ${unused} unused → ${toPosix(OUTPUT)}`);
}
