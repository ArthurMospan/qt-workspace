import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

// `dismiss` is a claim, and this file is what turns it into an observation.
//
// A Button marked `dismiss` says: pressing me does nothing except what the ×
// in this dialog's header does. On that promise, and only on it, globals.css
// stops drawing the button below md — a phone's dialog footer is a stack of
// full-width rows, and «Скасувати» was spending one of them repeating the ×.
//
// Three ways that promise can rot, and all of them are silent:
//   1. Somebody marks a button that also reverts, resets or steps back. Then a
//      phone loses an action that has no other affordance. settings/page.js's
//      Telegram cancel and CalendarEventDialog's «Скасувати» are exactly that
//      shape, and are deliberately unmarked.
//   2. Somebody marks a button in a dialog that draws no × — no `title`, so no
//      header at all, or `showCloseButton={false}`. Then a phone loses the only
//      way out of the dialog.
//   3. The button was the only thing in its footer. Hiding it leaves
//      `.ui-dialog-footer` itself — a ~65px bar of border, padding and canvas
//      with nothing inside it, which costs the phone more than the row the rule
//      was saving. Four dialogs are that shape, so the stylesheet carries a
//      companion rule that takes the bar when it takes the last thing in it,
//      and the fourth assertion is what keeps the two together.
// None of the three shows up in a screenshot, in the drift report, or in a code
// review of the file that broke it. They show up here.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const SOURCE_EXTENSIONS = ['.js', '.jsx'];

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      found.push(...await sourceFiles(full));
    } else if (SOURCE_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === 'string') walk(item, visit);
      }
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
}

const elementName = node => (node.openingElement?.name?.type === 'JSXIdentifier'
  ? node.openingElement.name.name
  : null);

const attribute = (node, name) => node.openingElement?.attributes
  .find(item => item.type === 'JSXAttribute' && item.name?.name === name);

// The written form of an attribute's value, so two handlers can be compared as
// the reader compares them: `onClose` against `onClose`, and the same arrow
// body against the same arrow body.
const valueSource = (source, attr) => {
  if (!attr) return null;
  const value = attr.value;
  if (!value) return true; // bare `dismiss`
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'JSXExpressionContainer') {
    return source.slice(value.expression.start, value.expression.end);
  }
  return source.slice(value.start, value.end);
};

// A Dialog may guard its own onClose — StatusTransitionPicker is
// `onClose={busy ? undefined : onClose}`, which makes the header × inert while
// a write is in flight, exactly as the footer button is `disabled={busy}`. The
// two are still the same action, so a conditional whose live branch is the
// footer's handler counts as the same handler.
function closeHandlerForms(source, dialog) {
  const attr = attribute(dialog, 'onClose');
  if (!attr) return [];
  const written = valueSource(source, attr);
  if (typeof written !== 'string') return [];
  const forms = [written];
  const expression = attr.value?.type === 'JSXExpressionContainer' ? attr.value.expression : null;
  if (expression?.type === 'ConditionalExpression') {
    for (const branch of [expression.consequent, expression.alternate]) {
      const branchSource = source.slice(branch.start, branch.end);
      if (branchSource !== 'undefined' && branchSource !== 'null') forms.push(branchSource);
    }
  }
  return forms;
}

// A file's `const footer = …`, so a Dialog written `footer={footer}` is read as
// the footer it is rather than as an identifier with nothing in it.
// CalendarEventDialog builds one that way, and the branch a member who cannot
// edit gets is a lone «Закрити» — to a scan that stops at the name, that button
// sits in no footer at all, which is the very shape assertion 1 exists to catch.
// Resolved only where the name is declared once in the file: a second
// declaration would mean guessing which one runs, and a wrong guess here lets a
// real stray through while claiming it checked.
function declarationsIn(ast) {
  const byName = new Map();
  walk(ast, node => {
    if (node.type !== 'VariableDeclarator') return;
    if (node.id?.type !== 'Identifier' || !node.init) return;
    const found = byName.get(node.id.name);
    if (found) found.push(node.init);
    else byName.set(node.id.name, [node.init]);
  });
  return name => {
    const found = byName.get(name);
    return found?.length === 1 ? found[0] : null;
  };
}

// The footer as the browser will be handed it: the attribute's own JSX, or
// whatever the identifier it names was assigned.
function footerRoot(dialog, resolve) {
  const value = attribute(dialog, 'footer')?.value;
  if (!value) return null;
  if (value.type === 'JSXExpressionContainer' && value.expression.type === 'Identifier') {
    return resolve(value.expression.name);
  }
  return value;
}

const isDismissButton = node => node.type === 'JSXElement'
  && elementName(node) === 'Button'
  && Boolean(attribute(node, 'dismiss'));

// Every shape a footer can come out in, each one the list of elements certainly
// in it. `cond && <X/>` gives a shape with X and a shape without; `a ? <X/> :
// <Y/>` gives X's shapes and Y's; a fragment multiplies its children's together.
// All of it to answer one question: is there a way for this footer to render
// nothing but dismisses, and so to become an empty bar below md?
function shapes(node, resolve, seen = new Set()) {
  if (!node) return [[]];
  switch (node.type) {
    case 'JSXExpressionContainer':
      return shapes(node.expression, resolve, seen);
    case 'Identifier':
      if (seen.has(node.name)) return [[]];
      return shapes(resolve(node.name), resolve, new Set([...seen, node.name]));
    case 'ConditionalExpression':
      return [...shapes(node.consequent, resolve, seen), ...shapes(node.alternate, resolve, seen)];
    case 'LogicalExpression':
      return [[], ...shapes(node.right, resolve, seen)];
    case 'JSXFragment':
      return node.children.reduce(
        (heads, child) => shapes(child, resolve, seen).flatMap(tail => heads.map(head => [...head, ...tail])),
        [[]],
      );
    case 'JSXElement':
      return [[node]];
    default:
      return [[]];
  }
}

async function collect() {
  const files = await sourceFiles(SRC);
  const marked = [];      // every Button that carries `dismiss`
  const inFooter = [];    // …and the Dialog whose `footer` it was found in
  const dismissOnly = []; // …and the Dialogs whose whole footer can be dismisses
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (!/(^|[^A-Za-z])dismiss($|[^A-Za-z])/.test(source)) continue;
    const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] });
    const where = relative(ROOT, file).split(sep).join('/');
    const resolve = declarationsIn(ast);

    walk(ast, node => {
      if (node.type !== 'JSXElement') return;
      if (elementName(node) === 'Button' && attribute(node, 'dismiss')) {
        marked.push({ where, line: node.loc.start.line });
      }
      if (elementName(node) !== 'Dialog') return;
      const root = footerRoot(node, resolve);
      if (!root) return;
      walk(root, inner => {
        if (inner.type !== 'JSXElement') return;
        if (elementName(inner) !== 'Button' || !attribute(inner, 'dismiss')) return;
        inFooter.push({
          where,
          line: inner.loc.start.line,
          title: valueSource(source, attribute(node, 'title')),
          showCloseButton: valueSource(source, attribute(node, 'showCloseButton')),
          onClick: valueSource(source, attribute(inner, 'onClick')),
          closeForms: closeHandlerForms(source, node),
        });
      });
      if (shapes(root, resolve).some(shape => shape.length > 0 && shape.every(isDismissButton))) {
        dismissOnly.push({ where, line: node.loc.start.line });
      }
    });
  }
  return { marked, inFooter, dismissOnly };
}

// globals.css as `@media` blocks and the rest. Comments go first: this file
// quotes its own selectors and queries in prose, and a scan that cannot tell a
// rule from a paragraph about a rule reports whichever it read last.
function splitMedia(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let outside = '';
  let cursor = 0;
  while (cursor < source.length) {
    const at = source.indexOf('@media', cursor);
    if (at === -1) { outside += source.slice(cursor); break; }
    outside += source.slice(cursor, at);
    const open = source.indexOf('{', at);
    if (open === -1) { outside += source.slice(at); break; }
    let depth = 1;
    let end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth += 1;
      else if (source[end] === '}') depth -= 1;
      end += 1;
    }
    blocks.push({ condition: source.slice(at + '@media'.length, open).trim(), body: source.slice(open + 1, end - 1) });
    cursor = end;
  }
  return { blocks, outside };
}

const rulesIn = body => body.split('}').map(chunk => {
  const [selector, declarations] = chunk.split('{');
  if (declarations === undefined) return null;
  return { selector: selector.trim().replace(/\s+/g, ' '), declarations };
}).filter(Boolean);

// Below md, and the same below md every time. `(width < 48rem)` is what Tailwind
// 4.3 compiles `max-md:` into; `(max-width: 767px)` is a different query at a
// viewport of 767.5px, which browser zoom and fractional device pixel ratios
// produce all day. Either spelling is allowed here, one spelling per feature is
// not negotiable: the bar and the button inside it must never land on opposite
// sides of md.
const BELOW_MD = /^\(\s*(?:width\s*<\s*48rem|max-width:\s*767(?:\.\d+)?px)\s*\)$/;

test('every `dismiss` button sits in a dialog footer', async () => {
  const { marked, inFooter } = await collect();
  assert.ok(marked.length > 0, 'the prop is in use — this scan found nothing, so it is broken');
  const seen = new Set(inFooter.map(item => `${item.where}:${item.line}`));
  const stray = marked
    .filter(item => !seen.has(`${item.where}:${item.line}`))
    .map(item => `${item.where}:${item.line}`);
  assert.deepEqual(stray, [], 'only a dialog footer can hide a button below md — a `dismiss` anywhere else does nothing and lies about the button');
});

test('every `dismiss` button sits under a header that draws an ×', async () => {
  const { inFooter } = await collect();
  const unreachable = inFooter
    .filter(item => !item.title || item.showCloseButton === 'false')
    .map(item => `${item.where}:${item.line}`);
  assert.deepEqual(unreachable, [], 'Dialog draws its header, and its ×, only when it has a title and keeps showCloseButton — hiding this button would leave the dialog with no way out on a phone');
});

test('a `dismiss` button does exactly what its dialog\'s × does', async () => {
  const { inFooter } = await collect();
  const different = inFooter
    .filter(item => !item.closeForms.includes(item.onClick))
    .map(item => `${item.where}:${item.line}`);
  assert.deepEqual(different, [], 'this button is hidden on a phone because the × replaces it — if its handler is not the dialog\'s onClose, something it does is only reachable above md');
});

// The one the first three cannot see. They read the buttons; this reads what is
// left of the footer once the buttons are gone. A dialog whose footer is a lone
// «Закрити» — a calendar event a member may only read, an unexportable invoice,
// a timesheet day — hides that button below md and keeps a bordered, padded,
// empty ~65px bar, which is a worse phone than the one the rule set out to fix.
// So the stylesheet must also take the bar, and it must take it at exactly the
// width it takes the button.
test('a footer that can hold nothing but a dismiss goes with it', async () => {
  const { dismissOnly } = await collect();
  assert.ok(
    dismissOnly.length > 0,
    'the product has dialogs whose whole footer is one dismiss — this scan found none, so it is broken and the rule below is being checked against nothing',
  );

  const { blocks, outside } = splitMedia(await readFile(join(ROOT, 'src/app/globals.css'), 'utf8'));
  const gated = blocks.filter(block => block.body.includes("data-ui-dismiss='true'"));

  assert.ok(
    !outside.includes("data-ui-dismiss='true'"),
    'a `dismiss` rule outside a media query reaches the desktop, where the footer row is one of a line of buttons and hides nothing',
  );
  assert.deepEqual(
    [...new Set(gated.map(block => block.condition))].filter(condition => !BELOW_MD.test(condition)),
    [],
    'every rule keyed on `dismiss` is a phone rule and must be gated below md',
  );
  assert.equal(
    new Set(gated.map(block => block.condition)).size,
    1,
    'the bar and the button inside it are one behaviour written twice — at a viewport of 767.5px two different queries disagree, and the footer collapses around a button still being drawn, or keeps a bar with nothing in it',
  );

  const collapse = gated
    .flatMap(block => rulesIn(block.body))
    .find(rule => rule.selector.startsWith(".ui-dialog-footer[data-ui-close-in-header='true']:not(")
      && rule.selector.includes(':has(')
      && rule.selector.includes(":not([data-ui-dismiss='true'])")
      && /display:\s*none/.test(rule.declarations));
  assert.ok(
    collapse,
    'globals.css must hide a `.ui-dialog-footer` with no child that is not a dismiss — without it these dialogs trade a repeated button for an empty bar. The negation is what spares every other footer: one real action in the bar and the bar stays',
  );
});
