import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, file), 'utf8');

// Every markdown file a person is told to read. `AGENTS.md` and
// `docs/UI_KIT_CONTRACT.md` were already held to this by the UI Kit suite, and
// nothing held the rest — not `docs/MIGRATIONS.md`, which is the one document
// whose whole subject is commands somebody is going to type against production
// data. `../qTicket` had drifted exactly there, keeping three runbooks for
// scripts it never contained. A runbook that cannot be run is worse than no
// runbook: it sends whoever follows it looking for a file, not for the answer.
function documentation() {
  const files = ['README.md', 'AGENTS.md', 'CLAUDE.md'];
  for (const directory of ['docs', 'docs/integrations']) {
    for (const entry of readdirSync(join(root, directory))) {
      if (entry.endsWith('.md')) files.push(`${directory}/${entry}`);
    }
  }
  return files;
}

test('every npm script the documentation names is defined', () => {
  const scripts = JSON.parse(read('package.json')).scripts;

  for (const file of documentation()) {
    const source = read(file);
    for (const [, command] of source.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
      assert.ok(
        command in scripts,
        `${file} tells the reader to run \`npm run ${command}\`, which package.json does not define`,
      );
    }
  }
});

test('every script file the documentation names exists', () => {
  for (const file of documentation()) {
    const source = read(file);
    for (const [, script] of source.matchAll(/scripts\/([A-Za-z0-9._-]+\.mjs)/g)) {
      assert.ok(
        existsSync(join(root, 'scripts', script)),
        `${file} points at scripts/${script}, which is not in this repository`,
      );
    }
  }
});

// The other direction: a migration script nobody documented is a loaded gun in
// a drawer. `scripts/backfill-project-team.mjs` and
// `scripts/remove-legacy-epic-type.mjs` were both one-time migrations named by
// no runbook and no npm script, in this repository and in `../qTicket` alike,
// and both had already been applied where they mattered.
test('every migration and backfill script has a runbook or an npm script', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  const commands = Object.values(scripts).join('\n');
  const runbooks = documentation().map(read).join('\n');

  const orphans = readdirSync(join(root, 'scripts'))
    .filter(entry => /^(migrate|backfill|remove|cleanup)-/.test(entry))
    .filter(entry => !commands.includes(`scripts/${entry}`) && !runbooks.includes(`scripts/${entry}`));

  assert.deepEqual(
    orphans,
    [],
    `These scripts change data and nothing tells anyone how to run them: ${orphans.join(', ')}`,
  );
});
