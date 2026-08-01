// scripts/kit-a11y.mjs — the accessibility contract, checked against the code.
//
// A screenshot suite cannot see that a control has no name, that an icon button
// announces itself as "button, button, button", or that a caption above a field
// is not attached to it. None of that shows up in a picture, and all of it is
// the difference between a screen somebody can use with a keyboard or a screen
// reader and one they cannot.
//
// Four categories, all contract zeros, over the authenticated workspace and the
// kit that serves it:
//
//   • namelessControls  — an icon-only control with nothing to announce.
//   • imagesWithoutAlt  — an <img> with no `alt`, not even an empty one.
//   • positiveTabIndex  — a tab order written by hand, which always drifts from
//                         the visual order and strands whatever it forgot.
//   • fakeButtons       — an onClick on a <div>/<span>: not focusable, not
//                         reachable by keyboard, and silent to a screen reader.
//
// The rules are deliberately narrow. Automated a11y checking is full of tests
// that are right in general and wrong here — this file only reports what can be
// decided from the source without guessing, so a zero means something.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { collectWorkspaceUiFiles } from './workspace-ui-files.mjs';

const traverse = traverseModule.default || traverseModule;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_DIR = join(ROOT, 'src', 'components', 'ui');
const OUTPUT = join(ROOT, 'src', 'app', 'ui-kit', 'a11y-audit.generated.json');

// Controls whose whole content can be a single icon. A `<button>` is one by
// definition; the kit's two icon wrappers take their name as a prop.
const CONTROL_TAGS = new Set(['button', 'a', 'Button', 'IconAction', 'AvatarButton', 'TextAction']);

// Any of these gives a control something to announce.
const NAME_ATTRIBUTES = new Set(['aria-label', 'aria-labelledby', 'label', 'title', 'ariaLabel', 'alt']);

function parseSource(source) {
  return parse(source, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'dynamicImport', 'topLevelAwait'],
  });
}

function toPosix(file) {
  return relative(ROOT, file).split(sep).join('/');
}

function jsxName(node) {
  if (!node) return '';
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') return `${jsxName(node.object)}.${jsxName(node.property)}`;
  return '';
}

function attribute(opening, name) {
  return (opening.attributes || []).find(
    item => item.type === 'JSXAttribute' && item.name.name === name,
  );
}

function hasSpread(opening) {
  return (opening.attributes || []).some(item => item.type === 'JSXSpreadAttribute');
}

// Does anything inside this control end up as words?
//
// Read through the whole subtree, because the words are rarely direct children:
// `<button><span>Зберегти</span></button>` says something and
// `<button><ChevronRight size={16} /></button>` does not. The first version of
// this counted any capitalised child as text, which made every icon-only button
// in the product look named — 12 findings where there were 30.
//
// An expression counts as text. `{label}`, `{children}`, `{count}` usually are,
// and being generous is the right bias: a false positive here blocks a build.
function hasVisibleText(element) {
  let found = false;
  const visit = node => {
    if (found || !node || typeof node !== 'object') return;
    if (node.type === 'JSXText' && node.value.trim()) { found = true; return; }
    if (node.type === 'JSXExpressionContainer' && node.expression?.type !== 'JSXEmptyExpression') {
      found = true;
      return;
    }
    (node.children || []).forEach(visit);
  };
  (element.children || []).forEach(visit);
  return found;
}

// The click-away layer around an overlay. It is the same element that centres
// the dialog, so it cannot be `aria-hidden` — that would hide the dialog with
// it — and making it focusable would put a nameless stop in front of every
// modal in the product. It is not a control: everything it does is also done by
// a close button and by Escape. Recognised by what it wraps, not by a name
// somebody has to remember to write.
function isClickAway(element) {
  let found = false;
  const visit = node => {
    if (!node || typeof node !== 'object' || found) return;
    if (node.type === 'JSXAttribute') {
      const name = node.name?.name;
      if (name === 'aria-modal') found = true;
      if (name === 'aria-hidden') found = true;
      if (name === 'role') {
        const value = node.value?.type === 'StringLiteral' ? node.value.value : '';
        if (['dialog', 'alertdialog', 'menu', 'listbox'].includes(value)) found = true;
      }
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object' && child.type) visit(child);
    }
  };
  // The overlay may declare the role on itself — a lightbox is one element —
  // or on the panel it wraps, when the backdrop is what centres it.
  (element.openingElement?.attributes || []).forEach(visit);
  (element.children || []).forEach(visit);
  return found;
}

// `onClick={event => event.stopPropagation()}` is not an action. It is the
// guard that keeps a click inside a panel from reaching the click-away layer
// under it — the panel does nothing, which is exactly the point.
function onlyStopsPropagation(handler) {
  const expression = handler?.value?.type === 'JSXExpressionContainer' ? handler.value.expression : null;
  if (!expression) return false;
  if (expression.type !== 'ArrowFunctionExpression') return false;
  const body = expression.body;
  const calls = body.type === 'BlockStatement'
    ? body.body.filter(statement => statement.type === 'ExpressionStatement').map(statement => statement.expression)
    : [body];
  if (calls.length === 0 || calls.length !== (body.type === 'BlockStatement' ? body.body.length : 1)) return false;
  return calls.every(call =>
    call.type === 'CallExpression'
    && call.callee.type === 'MemberExpression'
    && ['stopPropagation', 'preventDefault'].includes(call.callee.property?.name));
}

// `onClick={e => e.currentTarget.querySelector('button')?.click()}` — the row
// forwards the click to the control inside it, which widens the pointer target
// and nothing else. That control is the real one: it is a button, it is in the
// tab order, and it does the same thing when activated by keyboard. Making the
// wrapper a second control would add a tab stop that duplicates it.
function forwardsToInnerControl(handler) {
  const expression = handler?.value?.type === 'JSXExpressionContainer' ? handler.value.expression : null;
  if (!expression) return false;
  let found = false;
  const visit = node => {
    if (!node || typeof node !== 'object' || found) return;
    // `?.click()` parses as OptionalCallExpression on an OptionalMemberExpression,
    // which a check for `CallExpression` alone walks straight past — and every
    // one of these forwarders is written with the optional chain.
    if ((node.type === 'CallExpression' || node.type === 'OptionalCallExpression')
      && (node.callee.type === 'MemberExpression' || node.callee.type === 'OptionalMemberExpression')
      && node.callee.property?.name === 'click') {
      found = true;
      return;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object' && child.type) visit(child);
    }
  };
  visit(expression);
  return found;
}

export function auditA11y() {
  const files = [...new Set([...collectWorkspaceUiFiles(), ...walkKit()])].sort();

  const namelessControls = [];
  const imagesWithoutAlt = [];
  const positiveTabIndex = [];
  const fakeButtons = [];
  let elements = 0;

  for (const file of files) {
    let ast;
    let source;
    try {
      source = readFileSync(file, 'utf8');
      ast = parseSource(source);
    } catch {
      continue;
    }
    const posix = toPosix(file);

    traverse(ast, {
      JSXElement(path) {
        const opening = path.node.openingElement;
        const name = jsxName(opening.name);
        if (!name) return;
        elements += 1;
        const where = `${posix}:${opening.loc?.start?.line || 1}`;

        const tabIndex = attribute(opening, 'tabIndex');
        if (tabIndex) {
          const value = tabIndex.value?.type === 'JSXExpressionContainer'
            ? tabIndex.value.expression
            : tabIndex.value;
          if (value?.type === 'NumericLiteral' && value.value > 0) {
            positiveTabIndex.push({ element: name, location: where });
          }
        }

        if (name === 'img' && !attribute(opening, 'alt') && !hasSpread(opening)) {
          imagesWithoutAlt.push({ location: where });
        }

        if ((name === 'div' || name === 'span') && attribute(opening, 'onClick')) {
          const role = attribute(opening, 'role');
          const focusable = attribute(opening, 'tabIndex');
          const keyboard = attribute(opening, 'onKeyDown') || attribute(opening, 'onKeyUp');
          const handler = attribute(opening, 'onClick');
          const excused = isClickAway(path.node)
            || onlyStopsPropagation(handler)
            || forwardsToInnerControl(handler);
          if (!(role && focusable && keyboard) && !excused) {
            fakeButtons.push({ element: name, location: where });
          }
        }

        if (!CONTROL_TAGS.has(name)) return;
        // A control that is only ever rendered by another kit component takes
        // its name from that component; the spread is where it arrives.
        if (hasSpread(opening)) return;
        const named = (opening.attributes || []).some(
          item => item.type === 'JSXAttribute' && NAME_ATTRIBUTES.has(item.name.name),
        );
        if (named) return;
        if (hasVisibleText(path.node)) return;
        namelessControls.push({ element: name, location: where });
      },
    });
  }

  const byLocation = (a, b) => a.location.localeCompare(b.location);
  return {
    generatedBy: 'scripts/kit-a11y.mjs',
    scope: 'authenticated-workspace + src/components/ui',
    contract: {
      namelessControls: 'An icon-only control must carry an accessible name: aria-label, or the kit prop that becomes one.',
      imagesWithoutAlt: 'Every <img> declares alt, empty when the image is decoration.',
      positiveTabIndex: 'Tab order is the document order. A positive tabIndex overrides it and strands whatever it forgot.',
      fakeButtons: 'A click handler belongs on a button or a link. A div needs role, tabIndex and a key handler to be one — and then it should have been a button.',
    },
    totals: {
      files: files.length,
      elements,
      namelessControls: namelessControls.length,
      imagesWithoutAlt: imagesWithoutAlt.length,
      positiveTabIndex: positiveTabIndex.length,
      fakeButtons: fakeButtons.length,
    },
    namelessControls: namelessControls.sort(byLocation),
    imagesWithoutAlt: imagesWithoutAlt.sort(byLocation),
    positiveTabIndex: positiveTabIndex.sort(byLocation),
    fakeButtons: fakeButtons.sort(byLocation),
  };
}

function walkKit(dir = KIT_DIR, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkKit(full, out);
    else if (/\.jsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'));
if (isDirectRun) {
  const result = auditA11y();
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  const { namelessControls, imagesWithoutAlt, positiveTabIndex, fakeButtons } = result.totals;
  console.log(
    `a11y: ${namelessControls} nameless controls, ${imagesWithoutAlt} images without alt, `
    + `${positiveTabIndex} positive tabindex, ${fakeButtons} fake buttons → ${toPosix(OUTPUT)}`,
  );
}
