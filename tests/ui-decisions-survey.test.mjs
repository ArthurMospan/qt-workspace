import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_EXTENSIONS = ['.js', '.jsx'];

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (SOURCE_EXTENSIONS.includes(extname(path))) found.push(path.split(sep).join('/'));
  }
  return found;
}

// `/ui-decisions` is a survey of the hand-written controls that have not taken
// the kit look yet, and every item points at the code it is asking about. That
// pointer is the whole value of the page, and it is also the part that rots
// silently: four items went on describing an `ai-call` screen and an
// AudioTaskPanel that had already been migrated or deleted, and nothing said so
// — the page still rendered a faithful picture of markup that no longer
// existed anywhere.
//
// Only the file is checked, not the line number. A line moves whenever anything
// above it does, and a test that fails on that would be noise; a file that is
// gone means the question is gone with it.
test('every decision still points at code that exists', () => {
  const decisions = readFileSync(join(ROOT, 'src/app/ui-decisions/decisions.jsx'), 'utf8');
  const sources = walk(join(ROOT, 'src'));

  const referenced = new Set();
  for (const entry of decisions.matchAll(/where: '([^']+)'/g)) {
    for (const match of entry[1].matchAll(/[\w[\]().+/-]+\.jsx?/g)) referenced.add(match[0]);
  }

  assert.ok(referenced.size > 10, 'the survey must still be pointing at something');
  const missing = [...referenced].filter(
    reference => !sources.some(file => file === reference || file.endsWith(`/${reference}`)),
  );
  assert.deepEqual(
    missing,
    [],
    `a decision names a file that no longer exists: ${missing.join(', ')}`,
  );
});

// «Дзвінок → задачі» existed twice: as a tab inside CreateTaskModal and as a
// standalone `/ai-call` route that nothing linked to. They were the same screen
// written out twice, so a fix to one silently missed the other — which is
// exactly what happened when the panel learned to keep its drafts.
test('the call-to-tasks screen exists once, as a tab in the task composer', () => {
  const sources = walk(join(ROOT, 'src'));
  assert.equal(
    sources.filter(file => file.includes('(app)/ai-call/')).length,
    0,
    'the standalone /ai-call route is a duplicate of AudioTaskPanel and must stay deleted',
  );

  const modal = readFileSync(join(ROOT, 'src/components/CreateTaskModal.jsx'), 'utf8');
  assert.match(modal, /import AudioTaskPanel from '@\/components\/AudioTaskPanel'/);
  assert.match(modal, /<AudioTaskPanel/);
});
