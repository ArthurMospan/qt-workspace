// scripts/kit-composition.mjs — which `data-ui-*` declarations actually apply.
//
// The kit's named size contracts live in `globals.css` under `@layer components`
// and are meant to be the one place a composition's geometry is written. Half of
// what they declare never reaches the screen, and nothing said so.
//
// The reason is cascade layers, not specificity. `.ui-control[data-ui-composition='menu-item']`
// is a class plus an attribute — 0,2,0 — and beats `.px-4` at 0,1,0 easily. But
// Tailwind emits `@layer theme, base, components, utilities;`, and **layer order
// wins over specificity**: any utility in the last layer beats any rule in an
// earlier one. So the moment `Button` writes `px-4` in its own class list, every
// `padding` a composition declares for it is dead — silently, with the rule
// still sitting in the file looking like the source of truth.
//
// Custom properties are the exception, which is why `--ui-control-height` is the
// one part of these presets that has always worked: no utility sets it, so
// nothing shadows it. Everything else was a decision written down twice, with
// the copy nobody reads winning.
//
// This report names every shadowed declaration, the component whose utility
// beats it, and the class that does the beating. Verified against the browser:
// the same list comes out of `getComputedStyle` on /ui-kit.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBALS = join(ROOT, 'src', 'app', 'globals.css');
const OUTPUT = join(ROOT, 'src', 'app', 'ui-kit', 'composition-audit.generated.json');

// Which component renders each kit class. A composition rule can only be
// shadowed by the element that carries the class, so this is the whole scope.
const CLASS_OWNERS = {
  '.ui-control': ['Button.jsx', 'Input.jsx'],
  '.ui-textarea': ['Forms/Textarea.jsx'],
  '.ui-segmented': ['Segmented.jsx'],
  '.ui-surface': ['Surface.jsx', 'Layout/Card.jsx'],
  '.chat-composer-dock': ['ChatComposerDock.jsx'],
  '.ui-pill': ['DataDisplay/Pill.jsx'],
};

// Utility prefix → the CSS properties it sets. Only the ones this codebase
// actually writes; a longer table would be a longer list of things to be wrong
// about. The browser check on /ui-kit is what keeps this honest.
const UTILITY_PROPERTIES = [
  [/^-?p-\[?/, ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']],
  [/^-?px-\[?/, ['padding-right', 'padding-left']],
  [/^-?py-\[?/, ['padding-top', 'padding-bottom']],
  [/^-?pt-\[?/, ['padding-top']],
  [/^-?pr-\[?/, ['padding-right']],
  [/^-?pb-\[?/, ['padding-bottom']],
  [/^-?pl-\[?/, ['padding-left']],
  [/^text-\[|^text-(xs|sm|base|lg|xl|\dxl)$/, ['font-size']],
  [/^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/, ['font-weight']],
  [/^font-(mono|sans|serif)$/, ['font-family']],
  [/^leading-/, ['line-height']],
  [/^rounded/, ['border-radius']],
  [/^bg-/, ['background', 'background-color']],
  [/^border-(?!\d|$)/, ['border-color']],
  [/^justify-/, ['justify-content']],
  [/^items-/, ['align-items']],
  [/^gap-/, ['gap']],
  // `w-` is deliberately absent. Button's icon sizes carry `w-[32px]`, which
  // never lands on the text button a `width: 100%` composition is written for,
  // so blaming it reported two shadows the browser could not reproduce.
  [/^h-\[/, ['height']],
  [/^min-h-/, ['min-height']],
  [/^max-h-/, ['max-height']],
  [/^resize/, ['resize']],
  [/^flex-/, ['flex']],
];

// A shorthand in the rule is shadowed when a utility sets any of its longhands,
// and vice versa.
const EXPANDS = {
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  background: ['background-color', 'background-image'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
  gap: ['row-gap', 'column-gap'],
};

function expand(property) {
  return [property, ...(EXPANDS[property] || [])];
}

// Class tokens the component writes, from every string in the file. A
// conditional utility still ships and still wins whenever its branch is taken,
// so branches are not distinguished — a declaration that only applies half the
// time is not a source of truth either.
function utilityTokens(source) {
  const tokens = new Set();
  for (const [, literal] of source.matchAll(/(?:'|"|`)([^'"`]*?)(?:'|"|`)/g)) {
    if (!/[a-z]/.test(literal)) continue;
    for (const token of literal.split(/[\s\n]+/)) {
      const clean = token.replace(/^!/, '').replace(/^[a-z-]+:/, '');
      if (clean) tokens.add(clean);
    }
  }
  return tokens;
}

function propertiesOf(token) {
  for (const [pattern, properties] of UTILITY_PROPERTIES) {
    if (pattern.test(token)) return properties;
  }
  return [];
}

// Rules inside `@layer components` — the only ones utilities can outrank.
function layeredRules(css) {
  const start = css.indexOf('@layer components');
  if (start < 0) return [];
  let depth = 0;
  let index = css.indexOf('{', start);
  const open = index;
  for (; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = css.slice(open + 1, index);

  const rules = [];
  for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // A rule is usually preceded by the comment explaining it, which the
    // selector capture swallows whole.
    const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!/\[data-ui-/.test(selector)) continue;
    if (/:hover|::|:focus/.test(selector)) continue;
    const declarations = [];
    for (const declaration of match[2].split(';')) {
      const [property, ...rest] = declaration.split(':');
      const name = property.trim();
      if (!name || name.startsWith('--')) continue;
      declarations.push({ property: name, value: rest.join(':').trim() });
    }
    if (declarations.length) rules.push({ selector, declarations });
  }
  return rules;
}

// Which component actually renders each composition, from the drift report's
// real usage counts. `.ui-control` is shared by Button and Input, so without
// this the audit blamed Button's `font-bold` for shadowing a rule that only
// ever lands on an Input — a shadow the browser could not reproduce, because
// the two elements never meet.
function compositionOwners() {
  const drift = JSON.parse(readFileSync(join(ROOT, 'src', 'app', 'ui-kit', 'kit-drift.generated.json'), 'utf8'));
  const owners = {};
  for (const key of Object.keys(drift.usage)) {
    const match = key.match(/^(\w+)\.composition\.(.+)$/);
    if (!match) continue;
    (owners[match[2]] = owners[match[2]] || new Set()).add(match[1]);
  }
  return owners;
}

const COMPONENT_FILES = {
  Button: 'Button.jsx',
  Input: 'Input.jsx',
  IconAction: 'Button.jsx',
  Textarea: 'Forms/Textarea.jsx',
  Segmented: 'Segmented.jsx',
  Surface: 'Surface.jsx',
  Card: 'Layout/Card.jsx',
  ChatComposerDock: 'ChatComposerDock.jsx',
  Pill: 'DataDisplay/Pill.jsx',
};

export function auditComposition() {
  const css = readFileSync(GLOBALS, 'utf8');
  const rules = layeredRules(css);
  const owners = compositionOwners();

  const ownerTokens = {};
  for (const [className, files] of Object.entries(CLASS_OWNERS)) {
    ownerTokens[className] = files.map(file => ({
      file: `src/components/ui/${file}`,
      tokens: utilityTokens(readFileSync(join(ROOT, 'src', 'components', 'ui', file), 'utf8')),
    }));
  }

  const shadowed = [];
  let declarations = 0;

  for (const rule of rules) {
    // A selector may list several compositions at once; they share one class.
    const className = Object.keys(CLASS_OWNERS).find(name => rule.selector.includes(name));
    if (!className) continue;

    // Narrow the suspects to the components that really carry this
    // composition. An unused one has no owner yet, so every renderer of the
    // class is a candidate.
    const values = [...rule.selector.matchAll(/data-ui-composition='([^']+)'/g)].map(match => match[1]);
    const named = new Set(values.flatMap(value => [...(owners[value] || [])]));
    const files = new Set([...named].map(component => COMPONENT_FILES[component]).filter(Boolean));
    const suspects = files.size
      ? ownerTokens[className].filter(owner => [...files].some(file => owner.file.endsWith(file)))
      : ownerTokens[className];

    for (const { property, value } of rule.declarations) {
      declarations += 1;
      const wanted = expand(property);
      for (const owner of suspects) {
        const beatenBy = [...owner.tokens].find(token =>
          propertiesOf(token).some(candidate => wanted.includes(candidate) || expand(candidate).includes(property)));
        if (!beatenBy) continue;
        shadowed.push({
          selector: rule.selector.replace(/\s+/g, ' '),
          property,
          value,
          shadowedBy: beatenBy,
          owner: owner.file,
        });
        break;
      }
    }
  }

  const byRule = {};
  for (const entry of shadowed) {
    byRule[entry.selector] = (byRule[entry.selector] || 0) + 1;
  }

  return {
    generatedBy: 'scripts/kit-composition.mjs',
    contract: {
      shadowed: 'A data-ui-* declaration inside @layer components must not set a property the owning component also writes as a utility: the utility layer is emitted last and wins regardless of specificity.',
      customProperties: 'Custom properties are exempt and are the supported way to hand a value to a component — no utility can set one.',
    },
    totals: {
      rules: rules.length,
      declarations,
      shadowed: shadowed.length,
      rulesWithShadowedDeclarations: Object.keys(byRule).length,
    },
    shadowed: shadowed.sort((a, b) =>
      a.selector.localeCompare(b.selector) || a.property.localeCompare(b.property)),
  };
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'));
if (isDirectRun) {
  const result = auditComposition();
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  const { declarations, shadowed, rulesWithShadowedDeclarations } = result.totals;
  console.log(
    `composition: ${shadowed}/${declarations} declarations shadowed by a component utility, `
    + `across ${rulesWithShadowedDeclarations} rules`,
  );
}
