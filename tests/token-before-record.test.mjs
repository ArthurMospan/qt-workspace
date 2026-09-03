import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A route that has to read a record to learn which organization to authorize
// against verifies the caller's token *before* that read. The other order —
// read first, ask who is asking second — makes the read on behalf of nobody:
// an anonymous caller can ask for it at any rate they like, against a project
// on a daily read cap, and learn from 404-versus-401 which ids exist.
// `issues/[issueId]/reminders/route.js` had this right and documented why;
// these are the routes that did not.

const ROUTES_THAT_READ_TO_AUTHORIZE = [
  { path: 'src/app/api/issues/[issueId]/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/issues/[issueId]/status/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/issues/[issueId]/archive/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/issues/[issueId]/cancel/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/issues/[issueId]/links/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/issues/[issueId]/parent/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/issues/[issueId]/legacy-checklist/route.js', read: /await issueRef\.get\(\)/ },
  { path: 'src/app/api/invoices/[invoiceId]/void/route.js', read: /await invoiceRef\.get\(\)/ },
  { path: 'src/app/api/calendar/events/[eventId]/route.js', read: /await loadEvent\(eventId\)/ },
  { path: 'src/app/api/projects/[projectId]/route.js', read: /await ref\.get\(\)/ },
];

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every route that reads a record to find its organization verifies the token first', async () => {
  for (const { path, read } of ROUTES_THAT_READ_TO_AUTHORIZE) {
    const text = await source(path);
    const firstToken = text.indexOf('await authenticateRequest(request)');
    const firstRead = text.search(read);
    assert.ok(firstToken !== -1, `${path} never verifies the token itself`);
    assert.ok(firstRead !== -1, `${path} reads no record — remove it from this table`);
    assert.ok(firstToken < firstRead, `${path} reads the record before verifying the token`);
    // The verified identity is handed on, so the token is checked once.
    assert.match(text, /authorizeOrgRequest\([\s\S]*?\{ identity \}/, `${path} verifies the token twice`);
  }
});

test('the calendar event handlers each verify the token before loading the event', async () => {
  const text = await source('src/app/api/calendar/events/[eventId]/route.js');
  const handlers = text.split(/export async function (?:PATCH|DELETE)\(/).slice(1);
  assert.equal(handlers.length, 2);
  for (const handler of handlers) {
    const token = handler.indexOf('await authenticateRequest(request)');
    const read = handler.indexOf('await loadEvent(eventId)');
    assert.ok(token !== -1 && read !== -1 && token < read);
  }
});

test('the shared authorizer accepts an identity a route already verified', async () => {
  const text = await source('src/lib/server/firebaseAdmin.js');
  assert.match(text, /export async function authorizeOrgRequest\(request, organizationId, allowedRoles = \[\], \{ identity \} = \{\}\)/);
  assert.match(text, /identity\?\.user \? identity : await authenticateRequest\(request\)/);
});
