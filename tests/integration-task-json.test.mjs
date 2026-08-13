import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the BuggyBag task endpoint rejects malformed JSON before touching Firebase', async () => {
  const route = await readFile(
    new URL('../src/app/api/v1/tasks/route.js', import.meta.url),
    'utf8',
  );
  const parse = route.indexOf('body = await req.json()');
  const database = route.indexOf('const db = getAdminDb()');
  assert.ok(parse >= 0 && database > parse);
  assert.match(route, /catch \{[\s\S]{0,180}Invalid JSON body[\s\S]{0,80}status: 400/);
  assert.match(route, /Request body must be an object/);
});
