import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const SERVER_ADMIN_PATH = new URL('../src/lib/server/firebaseAdmin.js', import.meta.url);
const SOURCE_PATH = new URL('../src/', import.meta.url);
const SCRIPTS_PATH = new URL('../scripts/', import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(?:js|jsx|mjs)$/.test(entry.name)) return [];
    return [{ path: path.pathname, source: await readFile(path, 'utf8') }];
  }));
  return files.flat();
}

test('Firebase Admin 14 call sites do not use the removed namespace import', async () => {
  const files = [
    ...await sourceFiles(SOURCE_PATH),
    ...await sourceFiles(SCRIPTS_PATH),
  ];

  for (const { path, source } of files) {
    assert.doesNotMatch(
      source,
      /(?:import|export)[^;]*from\s+['"]firebase-admin['"]|import\s+['"]firebase-admin['"]/,
      `${path} must import a Firebase Admin v14 subpath`,
    );
    assert.doesNotMatch(
      source,
      /\badmin\.(?:app|auth|credential|firestore|initializeApp)\b/,
      `${path} uses the removed Firebase Admin namespace API`,
    );
  }

  const serverAdmin = await readFile(SERVER_ADMIN_PATH, 'utf8');
  assert.match(serverAdmin, /from 'firebase-admin\/app'/);
  assert.match(serverAdmin, /from 'firebase-admin\/auth'/);
  assert.match(serverAdmin, /from 'firebase-admin\/firestore'/);
});
