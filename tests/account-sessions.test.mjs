import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_REMEMBERED_SESSIONS,
  describeDevice,
  describePlace,
  describeSignInMethods,
  expiredSessionIds,
  isSessionId,
  listSessions,
} from '../src/lib/utils/accountSessions.mjs';

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/141.0.0.0`;
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

test('a device is named by the most specific claim its user agent makes', () => {
  assert.equal(describeDevice(CHROME_WINDOWS), 'Chrome · Windows');
  // Edge and Chrome both say "Chrome"; Chrome and Safari both say "Safari".
  // Reading them in the wrong order makes every browser the last one listed.
  assert.equal(describeDevice(EDGE_WINDOWS), 'Edge · Windows');
  assert.equal(describeDevice(SAFARI_IOS), 'Safari · iOS');
  assert.equal(describeDevice('curl/8.4.0'), 'Невідомий пристрій');
  assert.equal(describeDevice(undefined), 'Невідомий пристрій');
});

test('a session with no reported origin claims none', () => {
  assert.equal(describePlace({}), null);
  assert.equal(describePlace({ city: '', country: '  ' }), null);
  // The country is spelled out. «UA» is an identifier for a machine, and the
  // row it sits in is read by a person deciding whether they recognise a login.
  assert.equal(describePlace({ city: 'Kyiv', country: 'UA' }), 'Kyiv, Україна');
  // Vercel percent-encodes city names.
  assert.equal(describePlace({ city: '%D0%9A%D0%B8%D1%97%D0%B2', country: 'UA' }), 'Київ, Україна');
  // The region arrives as a code — «32» is Kyiv oblast — and a number in the
  // middle of an address tells nobody anything. The city already said where.
  assert.equal(
    describePlace({ city: 'Sofiivska Borschahivka', region: '32', country: 'UA' }),
    'Sofiivska Borschahivka, Україна',
  );
  assert.equal(describePlace({ city: 'Kyiv', region: 'Kyiv', country: 'UA' }), 'Kyiv, Україна');
  // With no city, a region that is an actual name still answers «звідки».
  assert.equal(describePlace({ region: 'Kyiv City', country: 'UA' }), 'Kyiv City, Україна');
  // A code nothing recognises is repeated, never invented.
  assert.equal(describePlace({ country: 'QQ' }), 'QQ');
});

test('the device you are reading on comes first, then the most recent', () => {
  const stored = {
    old: { device: 'Firefox · Linux', lastSeenAt: 1_000 },
    mine: { device: 'Chrome · Windows', lastSeenAt: 500 },
    recent: { device: 'Safari · iOS', lastSeenAt: 9_000 },
  };
  const rows = listSessions(stored, { currentSessionId: 'mine' });
  assert.deepEqual(rows.map(row => row.id), ['mine', 'recent', 'old']);
  assert.equal(rows[0].isCurrent, true);
  assert.equal(rows[1].isCurrent, false);
});

test('a record with no stored label is still named from its user agent', () => {
  const rows = listSessions({ a: { userAgent: SAFARI_IOS, lastSeenAt: 1 } });
  assert.equal(rows[0].device, 'Safari · iOS');
  assert.equal(rows[0].place, null);
});

test('the document never grows past the cap, and the current device survives it', () => {
  const stored = {};
  for (let index = 0; index < MAX_REMEMBERED_SESSIONS + 5; index += 1) {
    stored[`s${index}`] = { device: 'Chrome · Windows', lastSeenAt: index };
  }
  // `s0` is the oldest of them all and would fall off on recency alone.
  assert.equal(listSessions(stored).length, MAX_REMEMBERED_SESSIONS);
  const dropped = expiredSessionIds(stored, { keepId: 's0' });
  assert.ok(!dropped.includes('s0'));
  assert.equal(dropped.length, 5);
});

test('a session id is opaque and device-local, and nothing else is one', () => {
  assert.equal(isSessionId('4f2a9c1e-2b7d-4a0f-9c11-8f3d5a6b7c8d'), true);
  assert.equal(isSessionId('short'), false);
  assert.equal(isSessionId('../../users/someone-else'), false);
  assert.equal(isSessionId(null), false);
});

test('sign-in methods are named the way the sign-in page names them', () => {
  const methods = describeSignInMethods([
    { providerId: 'google.com' },
    { providerId: 'password' },
    { providerId: 'google.com' },
  ]);
  assert.deepEqual(methods.map(method => method.label), ['Google', 'Пошта і пароль']);
  assert.deepEqual(describeSignInMethods(undefined), []);
});
