import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (['.js', '.jsx'].includes(extname(path))) found.push(path.split(sep).join('/'));
  }
  return found;
}

const sources = walk(join(ROOT, 'src'))
  .filter(file => !file.includes('/ui-decisions/') && !file.endsWith('lib/design/icons.js'))
  .map(file => ({ file: file.slice(file.indexOf('src/')), source: readFileSync(file, 'utf8') }));

// «Мої завдання», «Календар» and «Чат» are named once, in lib/design/icons, and
// everything that means one of those three reads the name. The rule exists
// because the first attempt at changing them was a find-and-replace over
// imports, and it missed every place that had not imported anything: the task
// card and the task row drew the chat bubble as a literal `<path d="…">`, so no
// rename could ever reach them, and they went on showing the old glyph beside
// the new one everywhere else.
test('no file draws a feature glyph past the names that own it', () => {
  // The exact lucide paths for the glyphs these three replaced. A hand-drawn
  // copy is invisible to every rename, which is the whole failure mode.
  const HAND_DRAWN = [
    ['MessageSquare', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5'],
    ['CalendarDays', 'M8 2v4M16 2v4M3 10h18'],
  ];
  const offenders = [];
  for (const { file, source } of sources) {
    for (const [name, path] of HAND_DRAWN) {
      if (source.includes(path)) offenders.push(`${file}: hand-drawn ${name}`);
    }
    // The glyphs themselves, imported by their lucide names.
    for (const name of ['CalendarDays', 'MessagesSquare']) {
      if (new RegExp(`\b${name}\b`).test(source)) offenders.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(offenders, [], `these bypass @/lib/design/icons:\n${offenders.join('\n')}`);
});

// The one that matters most: the type icon feeds the task detail, every type
// select and every filter in the product.
test('the task type reads the shared task icon', () => {
  const workflow = readFileSync(join(ROOT, 'src/lib/hooks/useWorkflowConfig.js'), 'utf8');
  assert.match(workflow, /TYPE_ICONS = \{ epic: Zap, feature: Star, task: TaskIcon, bug: Bug \}/);
  assert.match(workflow, /from '@\/lib\/design\/icons'/);
});

// The two lists a task appears in, which is where the miss was visible.
test('the task card and the task row use the shared icons', () => {
  for (const file of [
    'src/components/workspace/IssueCard.jsx',
    'src/components/ui/TaskManagement/TaskRow.jsx',
  ]) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    assert.match(source, /import \{ CalendarIcon, ChatIcon, TaskIcon \} from '@\/lib\/design\/icons'/, file);
    assert.doesNotMatch(source, /<svg[\s\S]{0,200}M21 15a2 2/, `${file} still draws the bubble by hand`);
    assert.match(source, /<ChatIcon size=\{1[23]\} \/>/, file);
  }
});

// A `CheckCircle`-shaped tick that means "this succeeded" is a different
// decision that happens to look alike, and it keeps its own icon.
test('the success tick is left alone', () => {
  const invite = readFileSync(join(ROOT, 'src/app/invite/[token]/page.js'), 'utf8');
  assert.match(invite, /<CheckCircle2 className="mx-auto mb-4 h-8 w-8 text-emerald-500"/);
});
