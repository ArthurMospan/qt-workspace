// Runs the Firestore emulator once and says what happened, loudly enough to be
// read from outside GitHub.
//
// The rules suite passes locally and does not on the runner, and the failure
// had to be narrowed one step at a time because the Actions log API needs a
// token that a read-only clone does not have. The annotations API does not — so
// this prints the tail of the output as a `::error::` annotation, which can be
// fetched over the public API.
//
// Written as a committed file rather than an inline `run:` on purpose. Two
// attempts at the same thing inside a YAML scalar put a literal newline where
// an escaped one belonged, once breaking the workflow outright. Nothing here
// passes through a heredoc, a nested quote, or a block scalar.
//
// Delete this when the rules job has been green for a while: it is scaffolding
// for one investigation, not a check of its own.
import { spawnSync } from 'node:child_process';

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('usage: node scripts/ci-emulator-probe.mjs <command to run inside the emulator>');
  process.exit(2);
}

const args = [
  '--project', 'demo-quickteam',
  'emulators:exec',
  '--only', 'firestore',
  '--debug',
  command.join(' '),
];

console.log(`> firebase ${args.join(' ')}`);
const result = spawnSync('npx', ['firebase', ...args], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const output = `${result.stdout || ''}${result.stderr || ''}`;
console.log(output);

if (result.status === 0) process.exit(0);

// One line, no newlines, short enough to survive the annotation limit. The
// interesting part of a CLI failure is always at the end.
const tail = output
  .split(/\r?\n/)
  .filter(line => line.trim())
  .slice(-14)
  .join(' | ')
  .slice(-1400);
console.log(`::error::firebase emulators:exec exited ${result.status}: ${tail || '(no output)'}`);
process.exit(result.status ?? 1);
