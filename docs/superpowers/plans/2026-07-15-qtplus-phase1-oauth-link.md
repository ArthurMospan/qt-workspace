# QuickTeam+ Phase 1 — OAuth Account Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A workspace user connects their own QuickTeam+ account with one click and no token copying, and can disconnect it — via a first-party authorization-code flow between the two apps.

**Architecture:** QT+ (`qt`, Firebase `quickteam-portal-prod`) becomes a minimal first-party OAuth **provider**: a consent page mints a one-time `code`, and a server-to-server exchange trades that code for an opaque long-lived `refreshToken`. Workspace (`qt-workspace`, Firebase `quickteam-me`) is the **client**: it holds the `client_secret`, performs the exchange server-side, and stores the token encrypted at `users/{uid}/private/qtplus` where no client rule can reach it. Phase 1 delivers only the link; minting Firebase sessions from the grant is Phase 2.

**Tech Stack:** Next.js 16 App Router (both repos), Firebase Admin SDK, Firestore. Tests: `vitest` + Firestore emulator in `qt`; `node --test` (`.mjs`) in `qt-workspace`.

---

## Global Constraints

These are project-wide. Every task's requirements implicitly include this section.

**Repo differences — these two repos are NOT symmetric. Getting this wrong is the most likely way to waste a task:**

| | `qt` (QT+, provider) | `qt-workspace` (client) |
|---|---|---|
| Firebase project | `quickteam-portal-prod` | `quickteam-me` |
| Admin credential env | `FIREBASE_SERVICE_ACCOUNT` (whole JSON) | `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` |
| Admin accessor | `getAdminDb()`, `getAdminAuth()` from `@/lib/server/firebaseAdmin` | same names, **different module** |
| Test runner | `vitest` via `npm test` (wraps emulator) | `node --test`, one script per file |
| Test location | `tests/rules/*.test.js`, `tests/server/*.test.js` | `tests/*.test.mjs` |
| API/user-facing copy | **Ukrainian** | **English** |
| Error helper | none — inline `ERROR_STATUS`/`ERROR_MESSAGE` maps (see `src/app/api/join/route.js`) | `routeErrorResponse(error, { context, fallbackMessage })` from `@/lib/server/apiErrors` |
| Rate limiting | **does not exist** | `enforceRateLimit(scope, subject, limit, windowSeconds) -> bool` in `@/lib/server/firebaseAdmin` |

- **The design spec is wrong about the above.** It claims new routes inherit `getAdminDb`, `enforceRateLimit`, `routeErrorResponse` from `@/lib/server/firebaseAdmin`. In reality `routeErrorResponse` lives in `@/lib/server/apiErrors`, and `enforceRateLimit` exists **only in workspace**. Do not import either in `qt`.
- **`qt-workspace` has no `"type": "module"`.** Any logic that must be unit-tested by `node --test` has to live in a `.mjs` file and must not `import 'server-only'` (not resolvable from plain node). Precedent: `src/lib/utils/notificationNavigation.mjs`, `src/lib/server/oauthState.mjs`.
- **Fail closed on missing configuration, always.** Never fall back to a working-looking default. This is the single most repeated Phase 0 lesson (silent Admin SDK fallback, fail-open project guard, decorative OneB nonce).
- **The refresh token never reaches a browser.** Not in a response body, not in a cookie, not in a client-readable Firestore doc.
- **Every new Firestore collection gets an explicit rule and a rules test.** Default-deny is not enough documentation — `qt`'s `tasks` collection had a comment claiming clients never touch it while the rule allowed exactly that.
- **`client_id` is hardcoded first-party:** `quickteam-workspace`. No public client registration (YAGNI, per spec).
- **`redirect_uri` must be validated against an env-driven allowlist** on both the mint and the exchange, and must be identical across the two.
- Secrets are compared with `timingSafeEqual`, never `===`.

### New environment variables

Deploy ordering is a real hazard here — see "Deploy order" below.

**`qt` (QT+):**
| Var | Example | Purpose |
|---|---|---|
| `QTPLUS_WORKSPACE_CLIENT_SECRET` | 64 hex chars | shared secret for the `quickteam-workspace` client |
| `QTPLUS_WORKSPACE_REDIRECT_URIS` | `https://qt-workspace.vercel.app/api/integrations/qtplus/callback,http://localhost:3000/api/integrations/qtplus/callback` | comma-separated exact-match allowlist |

**`qt-workspace`:**
| Var | Example | Purpose |
|---|---|---|
| `NEXT_PUBLIC_QTPLUS_URL` | `https://qt-green.vercel.app` | QT+ origin. **Verify the real domain with `vercel project ls` — do not assume.** |
| `QTPLUS_CLIENT_SECRET` | same value as `QTPLUS_WORKSPACE_CLIENT_SECRET` | proves the client to QT+ |
| `QTPLUS_TOKEN_KEY` | base64 of 32 random bytes | AES-256-GCM key for the stored refresh token |

Generate secrets with:
```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"   # client secret
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))" # QTPLUS_TOKEN_KEY
```

### Deploy order (human, blocking)

1. Set the `qt` env vars, deploy `qt` **first**. Tasks 1–4 must be live before workspace's connect button ships, or connect 404s — the same trap as Phase 0's `/api/join`.
2. Set the `qt-workspace` env vars, then deploy workspace.
3. `QTPLUS_TOKEN_KEY` must exist **before** any token is stored. Rotating it later orphans every stored grant (users must reconnect); there is no re-encryption path in Phase 1.

### Deliberate deviations from the spec (do not "fix" these)

- **`state` is nonce-bound to a cookie, not HMAC-signed.** The spec says *«`state` — підписаний, звіряється в callback»*. A signature proves *we* minted the state; it does not prove *this browser* started the flow — an attacker can replay a state we legitimately signed for them. Binding the state to a single-use httpOnly cookie proves both and needs no key, no new env var, and no rotation story. This is the mechanism already proven in `oauthState.mjs` by the OneB CSRF fix. It satisfies the spec's actual requirement (*«без нього можливий CSRF-підсув чужого акаунта»*) more directly than a signature would.
- **Full redirect, not a popup.** The spec's Phase 1 diagram shows a popup. Workspace already has a proven full-redirect OAuth client (OneB, `src/app/oauth2/result/route.js`) with session handling and error redirects. Reusing that shape beats a second mechanism with `postMessage` plumbing. Same user outcome.
- **A minimal Settings → Інтеграції card ships in Phase 1** (Task 9), though the spec assigns the card to Phase 4. Without it Phase 1 has no trigger and cannot be demoed or manually verified. Phase 4 restyles it.
- **No rate limiting on the QT+ OAuth routes.** `qt` has no rate-limit primitive, and porting one is its own task. The exposure is small: `/api/oauth/token` needs `client_secret`, `/api/oauth/authorize` needs a valid Firebase ID token, and codes are 32 random bytes. Revisit in Phase 2, where the spec explicitly wants it for token minting.
- **One QT+ account may be linked from more than one workspace account.** Every link requires passing QT+'s own consent screen as that QT+ user, so this cannot be forced on anyone. Adding a uniqueness check is speculative.

---

## File Structure

**`qt` (provider):**
| File | Responsibility |
|---|---|
| `src/lib/server/oauthClients.js` | client registry: secret + redirect-uri allowlist, both env-driven, fail-closed |
| `src/lib/server/oauthGrants.js` | code mint/consume, grant mint/lookup/revoke. All Firestore access. Pure of HTTP. |
| `src/app/api/oauth/authorize/route.js` | mint a code for the signed-in QT+ user |
| `src/app/(main)/oauth/authorize/page.js` | consent screen |
| `src/app/api/oauth/token/route.js` | code → `{ qtUserId, email, refreshToken }` |
| `src/app/api/oauth/revoke/route.js` | revoke a grant |
| `firestore.rules` | explicit deny for `oauthCodes` / `oauthGrants` |
| `tests/server/oauthGrants.test.js` | grant/code lifecycle against the emulator |
| `tests/rules/oauth.test.js` | clients cannot touch the new collections |

**`qt-workspace` (client):**
| File | Responsibility |
|---|---|
| `src/lib/server/secretBox.mjs` | AES-256-GCM seal/open. Pure, `node --test`-able. |
| `src/lib/server/oauthState.mjs` | **exists** — add QT+ state helpers beside the OneB ones |
| `src/lib/server/qtplusLink.js` | read/write/delete the stored grant |
| `src/app/api/integrations/qtplus/connect/route.js` | start flow, set nonce cookie |
| `src/app/api/integrations/qtplus/callback/route.js` | verify state, exchange code, store sealed token |
| `src/app/api/integrations/qtplus/route.js` | `GET` status, `DELETE` disconnect |
| `firestore.rules` | explicit deny for `users/{uid}/private/**` |
| `tests/secret-box.test.mjs`, `tests/oauth-state.test.mjs` | crypto + state |
| `tests/firestore.rules.test.mjs` | private subcollection + org flag |
| `src/app/(app)/settings/page.js` | personal QuickTeam+ section. The org toggle already exists in Інтеграції — reuse it, do not build a second one. |

---

## Task 1: QT+ — OAuth core (clients, codes, grants) + rules

The security core. Everything else is HTTP plumbing over this.

**Files:**
- Create: `qt/src/lib/server/oauthClients.js`
- Create: `qt/src/lib/server/oauthGrants.js`
- Modify: `qt/firestore.rules`
- Test: `qt/tests/server/oauthGrants.test.js`
- Test: `qt/tests/rules/oauth.test.js`

**Interfaces:**
- Consumes: `getAdminDb()` from `@/lib/server/firebaseAdmin`.
- Produces:
  - `getOAuthClient(clientId) -> { clientId, secret, redirectUris: string[] }` (throws if unconfigured)
  - `verifyClientSecret(clientId, secret) -> boolean`
  - `isAllowedRedirectUri(client, uri) -> boolean`
  - `mintAuthCode({ db, clientId, redirectUri, qtUserId, email }) -> { code }`
  - `consumeAuthCode({ db, code, clientId, redirectUri }) -> { ok: true, qtUserId, email } | { ok: false, code: 'invalid_code' }`
  - `mintGrant({ db, clientId, qtUserId, email }) -> { refreshToken }`
  - `lookupGrant({ db, refreshToken, clientId }) -> { ok: true, qtUserId, email } | { ok: false, code: 'invalid_grant' }`
  - `revokeGrant({ db, refreshToken, clientId }) -> { ok: boolean }`

**Data model:**
```
oauthCodes/{sha256(code)}    { clientId, redirectUri, qtUserId, email, expiresAt }   // deleted on use
oauthGrants/{sha256(token)}  { clientId, qtUserId, email, createdAt, lastUsedAt, revokedAt }
```
Only hashes are stored: a Firestore dump must not yield usable credentials.

- [ ] **Step 1: Write the failing tests**

Create `qt/tests/server/oauthGrants.test.js`:

This bootstrap mirrors `qt/tests/server/joinProject.test.js` exactly — named app, emulator host set at module top, `recursiveDelete` between tests. Do not invent a different one.

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  mintAuthCode, consumeAuthCode, mintGrant, lookupGrant, revokeGrant,
} from '../../src/lib/server/oauthGrants.js';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const CLIENT = 'quickteam-workspace';
const URI = 'https://ws.test/cb';
let app;
let db;

beforeAll(() => {
  app = initializeApp({ projectId: 'quickteam-portal-test' }, 'oauth-tests');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('oauthCodes'));
  await db.recursiveDelete(db.collection('oauthGrants'));
});

describe('auth codes', () => {
  it('round-trips a code once and returns the user', async () => {
    const { code } = await mintAuthCode({ db, clientId: CLIENT, redirectUri: URI, qtUserId: 'u1', email: 'a@b.c' });
    const result = await consumeAuthCode({ db, code, clientId: CLIENT, redirectUri: URI });
    expect(result).toEqual({ ok: true, qtUserId: 'u1', email: 'a@b.c' });
  });

  it('refuses to consume the same code twice', async () => {
    const { code } = await mintAuthCode({ db, clientId: CLIENT, redirectUri: URI, qtUserId: 'u1', email: 'a@b.c' });
    await consumeAuthCode({ db, code, clientId: CLIENT, redirectUri: URI });
    const second = await consumeAuthCode({ db, code, clientId: CLIENT, redirectUri: URI });
    expect(second).toEqual({ ok: false, code: 'invalid_code' });
  });

  it('refuses a code presented with a different redirect_uri', async () => {
    const { code } = await mintAuthCode({ db, clientId: CLIENT, redirectUri: URI, qtUserId: 'u1', email: 'a@b.c' });
    const result = await consumeAuthCode({ db, code, clientId: CLIENT, redirectUri: 'https://evil.test/cb' });
    expect(result).toEqual({ ok: false, code: 'invalid_code' });
  });

  it('refuses a code presented by a different client', async () => {
    const { code } = await mintAuthCode({ db, clientId: CLIENT, redirectUri: URI, qtUserId: 'u1', email: 'a@b.c' });
    const result = await consumeAuthCode({ db, code, clientId: 'other', redirectUri: URI });
    expect(result).toEqual({ ok: false, code: 'invalid_code' });
  });

  it('refuses an expired code', async () => {
    const { code } = await mintAuthCode({
      db, clientId: CLIENT, redirectUri: URI, qtUserId: 'u1', email: 'a@b.c', ttlSeconds: -1,
    });
    const result = await consumeAuthCode({ db, code, clientId: CLIENT, redirectUri: URI });
    expect(result).toEqual({ ok: false, code: 'invalid_code' });
  });

  it('refuses an unknown code', async () => {
    expect(await consumeAuthCode({ db, code: 'nope', clientId: CLIENT, redirectUri: URI }))
      .toEqual({ ok: false, code: 'invalid_code' });
  });

  it('never stores the raw code', async () => {
    const { code } = await mintAuthCode({ db, clientId: CLIENT, redirectUri: URI, qtUserId: 'u1', email: 'a@b.c' });
    const snap = await db.collection('oauthCodes').get();
    const dump = JSON.stringify(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    expect(dump).not.toContain(code);
  });
});

describe('grants', () => {
  it('round-trips a refresh token', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'u1', email: 'a@b.c' });
    expect(await lookupGrant({ db, refreshToken, clientId: CLIENT }))
      .toEqual({ ok: true, qtUserId: 'u1', email: 'a@b.c' });
  });

  it('is reusable, unlike a code', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'u1', email: 'a@b.c' });
    await lookupGrant({ db, refreshToken, clientId: CLIENT });
    expect((await lookupGrant({ db, refreshToken, clientId: CLIENT })).ok).toBe(true);
  });

  it('stops working once revoked', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'u1', email: 'a@b.c' });
    expect(await revokeGrant({ db, refreshToken, clientId: CLIENT })).toEqual({ ok: true });
    expect(await lookupGrant({ db, refreshToken, clientId: CLIENT }))
      .toEqual({ ok: false, code: 'invalid_grant' });
  });

  it('refuses a grant presented by a different client', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'u1', email: 'a@b.c' });
    expect(await lookupGrant({ db, refreshToken, clientId: 'other' }))
      .toEqual({ ok: false, code: 'invalid_grant' });
  });

  it('never stores the raw refresh token', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'u1', email: 'a@b.c' });
    const snap = await db.collection('oauthGrants').get();
    const dump = JSON.stringify(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    expect(dump).not.toContain(refreshToken);
  });
});
```

Create `qt/tests/rules/oauth.test.js`. Note the conventions in `tests/rules/tasks.test.js`, which this copies: the **modular client SDK** (`doc`/`getDoc`/`setDoc` from `firebase/firestore`, *not* admin-style `db.collection(...)`), a local `dbFor(uid)`, `beforeEach(seedFixtures)`, `afterAll(cleanup)`, and Ukrainian test names.

```js
import { assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv, seedFixtures, cleanup, ALICE, BOB } from './helpers.js';

beforeEach(seedFixtures);
afterAll(cleanup);

async function dbFor(uid) {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore();
}

// oauthCodes/oauthGrants містять хеші живих облікових даних. Доступ до них
// має ВИКЛЮЧНО Admin SDK. Той самий клас, що й `tasks`: колекція, до якої
// клієнт не має справ узагалі.
describe('oauth: колекції недоступні з клієнта', () => {
  it('ніхто не читає oauthCodes', async () => {
    const db = await dbFor(ALICE);
    await assertFails(getDoc(doc(db, 'oauthCodes', 'x')));
    await assertFails(getDocs(collection(db, 'oauthCodes')));
  });

  it('ніхто не пише oauthCodes', async () => {
    const db = await dbFor(BOB);
    await assertFails(setDoc(doc(db, 'oauthCodes', 'x'), { qtUserId: BOB }));
  });

  it('ніхто не читає oauthGrants', async () => {
    const db = await dbFor(ALICE);
    await assertFails(getDoc(doc(db, 'oauthGrants', 'x')));
    await assertFails(getDocs(collection(db, 'oauthGrants')));
  });

  it('ніхто не пише oauthGrants — інакше можна було б підробити грант', async () => {
    const db = await dbFor(BOB);
    await assertFails(setDoc(doc(db, 'oauthGrants', 'x'), { qtUserId: BOB, revokedAt: null }));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd qt && npm run test:server -- oauthGrants
```
Expected: FAIL — `Cannot find module '../../src/lib/server/oauthGrants.js'`.

- [ ] **Step 3: Write `oauthClients.js`**

```js
import { timingSafeEqual } from 'node:crypto';

// First-party only. A public client registry is explicitly out of scope.
const CLIENT_DEFS = {
  'quickteam-workspace': {
    secretEnv: 'QTPLUS_WORKSPACE_CLIENT_SECRET',
    redirectUrisEnv: 'QTPLUS_WORKSPACE_REDIRECT_URIS',
  },
};

/**
 * Не знати конфігурацію клієнта — так само фатально, як і мати неправильну:
 * мовчазний фолбек тут відкрив би обмін коду будь-кому. Тому кидаємо.
 */
export function getOAuthClient(clientId) {
  const def = CLIENT_DEFS[clientId];
  if (!def) return null;

  const secret = process.env[def.secretEnv];
  if (!secret) {
    throw new Error(`${def.secretEnv} не задано — OAuth-клієнт "${clientId}" не налаштований. Відмовляюсь стартувати.`);
  }
  const redirectUris = (process.env[def.redirectUrisEnv] || '')
    .split(',')
    .map((uri) => uri.trim())
    .filter(Boolean);
  if (redirectUris.length === 0) {
    throw new Error(`${def.redirectUrisEnv} не задано — немає дозволених redirect_uri для "${clientId}".`);
  }
  return { clientId, secret, redirectUris };
}

export function verifyClientSecret(clientId, presented) {
  if (typeof presented !== 'string' || !presented) return false;
  const client = getOAuthClient(clientId);
  if (!client) return false;

  const a = Buffer.from(client.secret);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Exact match only. Prefix matching on redirect_uri is a classic code-theft
// hole (an attacker registers .../cb.evil.test and it "starts with" the real one).
export function isAllowedRedirectUri(client, uri) {
  return Boolean(client) && typeof uri === 'string' && client.redirectUris.includes(uri);
}
```

- [ ] **Step 4: Write `oauthGrants.js`**

```js
import { randomBytes, createHash } from 'node:crypto';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const CODE_TTL_SECONDS = 60;

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function newSecret() {
  return randomBytes(32).toString('base64url');
}

export async function mintAuthCode({ db, clientId, redirectUri, qtUserId, email, ttlSeconds = CODE_TTL_SECONDS }) {
  const code = newSecret();
  await db.collection('oauthCodes').doc(hash(code)).set({
    clientId,
    redirectUri,
    qtUserId,
    email: email || null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + ttlSeconds * 1000),
  });
  return { code };
}

/**
 * Одноразовість забезпечує транзакція: читаємо й видаляємо в одному кроці,
 * тому два паралельних обміни не можуть обидва пройти.
 */
export async function consumeAuthCode({ db, code, clientId, redirectUri }) {
  if (typeof code !== 'string' || !code) return { ok: false, code: 'invalid_code' };
  const ref = db.collection('oauthCodes').doc(hash(code));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, code: 'invalid_code' };

    const data = snap.data();
    // Видаляємо в будь-якому разі: пред'явлений код спалено, навіть якщо він
    // не підійшов — інакше лишається вікно для перебору деталей.
    tx.delete(ref);

    if (data.clientId !== clientId) return { ok: false, code: 'invalid_code' };
    if (data.redirectUri !== redirectUri) return { ok: false, code: 'invalid_code' };
    if (data.expiresAt.toMillis() <= Date.now()) return { ok: false, code: 'invalid_code' };

    return { ok: true, qtUserId: data.qtUserId, email: data.email };
  });
}

export async function mintGrant({ db, clientId, qtUserId, email }) {
  const refreshToken = newSecret();
  await db.collection('oauthGrants').doc(hash(refreshToken)).set({
    clientId,
    qtUserId,
    email: email || null,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
    revokedAt: null,
  });
  return { refreshToken };
}

export async function lookupGrant({ db, refreshToken, clientId }) {
  if (typeof refreshToken !== 'string' || !refreshToken) return { ok: false, code: 'invalid_grant' };
  const ref = db.collection('oauthGrants').doc(hash(refreshToken));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, code: 'invalid_grant' };

  const data = snap.data();
  if (data.clientId !== clientId) return { ok: false, code: 'invalid_grant' };
  if (data.revokedAt) return { ok: false, code: 'invalid_grant' };

  await ref.update({ lastUsedAt: FieldValue.serverTimestamp() });
  return { ok: true, qtUserId: data.qtUserId, email: data.email };
}

export async function revokeGrant({ db, refreshToken, clientId }) {
  if (typeof refreshToken !== 'string' || !refreshToken) return { ok: false };
  const ref = db.collection('oauthGrants').doc(hash(refreshToken));
  const snap = await ref.get();
  if (!snap.exists || snap.data().clientId !== clientId) return { ok: false };

  await ref.update({ revokedAt: FieldValue.serverTimestamp() });
  return { ok: true };
}
```

- [ ] **Step 5: Add the rules**

In `qt/firestore.rules`, inside `match /databases/{database}/documents`, next to the `tasks` block:

```js
    // ── OAuth (QuickTeam+ як провайдер для workspace) ───────────────────
    // Читаються й пишуться ВИКЛЮЧНО Admin SDK у /api/oauth/*. Жоден клієнт
    // не має тут справ: у цих колекціях лежать хеші живих облікових даних.
    match /oauthCodes/{codeHash} {
      allow read, write: if false;
    }
    match /oauthGrants/{tokenHash} {
      allow read, write: if false;
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd qt && npm test
```
Expected: PASS — the new grant/code tests and rules tests green, and all 94 pre-existing tests still green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/oauthClients.js src/lib/server/oauthGrants.js firestore.rules tests/server/oauthGrants.test.js tests/rules/oauth.test.js
git commit -m "feat(oauth): add QuickTeam+ OAuth client registry, codes and grants

Codes are single-use via a transaction and bound to client_id + redirect_uri;
grants are reusable until revoked. Only sha256 hashes are stored, so a
Firestore dump yields no usable credential.

Both collections are denied to every client in the rules, with tests — the
tasks collection already taught us that a comment claiming clients never touch
a collection is not the same as a rule enforcing it."
```

---

## Task 2: QT+ — consent screen and code minting

**Files:**
- Create: `qt/src/app/api/oauth/authorize/route.js`
- Create: `qt/src/app/(main)/oauth/authorize/page.js`

**Interfaces:**
- Consumes: `getOAuthClient`, `isAllowedRedirectUri` (Task 1); `mintAuthCode` (Task 1); `getAdminAuth`, `getAdminDb`.
- Produces: `POST /api/oauth/authorize` with `Authorization: Bearer <QT+ ID token>` and body `{ clientId, redirectUri, state }` → `{ redirectTo }`.

**Why the POST carries a Bearer token rather than relying on a cookie:** an ID token cannot be attached by a cross-site form post, so consent cannot be CSRF'd. This mirrors `/api/join`.

- [ ] **Step 1: Write the route**

`qt/src/app/api/oauth/authorize/route.js`:

```js
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import { getOAuthClient, isAllowedRedirectUri } from '@/lib/server/oauthClients';
import { mintAuthCode } from '@/lib/server/oauthGrants';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'Потрібна авторизація.' }, { status: 401 });
    }

    // getAdminAuth() поза внутрішнім try: помилка конфігурації — це 500 з
    // логом, а не "сесія недійсна" (той самий баг ловили в Task 4 Фази 0).
    const auth = getAdminAuth();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error('[api/oauth/authorize] Token verification failed:', error.message);
      return NextResponse.json({ error: 'Сесія недійсна. Увійдіть ще раз.' }, { status: 401 });
    }

    const { clientId, redirectUri, state } = await req.json().catch(() => ({}));

    const client = getOAuthClient(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Невідомий застосунок.' }, { status: 400 });
    }
    if (!isAllowedRedirectUri(client, redirectUri)) {
      // Не редіректимо на непідтверджену адресу навіть з помилкою — це вона і є атака.
      console.warn('[api/oauth/authorize] redirect_uri not allowed:', redirectUri);
      return NextResponse.json({ error: 'Недозволена адреса повернення.' }, { status: 400 });
    }
    if (typeof state !== 'string' || !state) {
      return NextResponse.json({ error: 'Відсутній state.' }, { status: 400 });
    }

    const { code } = await mintAuthCode({
      db: getAdminDb(),
      clientId,
      redirectUri,
      qtUserId: decoded.uid,
      email: decoded.email || null,
    });

    const redirectTo = new URL(redirectUri);
    redirectTo.searchParams.set('code', code);
    redirectTo.searchParams.set('state', state);
    return NextResponse.json({ redirectTo: redirectTo.toString() });
  } catch (error) {
    console.error('[api/oauth/authorize]', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the consent page**

`qt/src/app/(main)/oauth/authorize/page.js`. Read `qt/src/app/(main)/join/[id]/page.js` first and match its loading/error/auth conventions and styling; this is deliberately plain.

```jsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { auth } from '@/lib/firebase';

export default function OAuthAuthorizePage() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');

  useEffect(() => {
    if (loading || user) return;
    const next = `/oauth/authorize?${params.toString()}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, params, router]);

  const allow = async () => {
    setSubmitting(true);
    setError('');
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, redirectUri, state }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не вдалося підтвердити доступ.');
      window.location.href = data.redirectTo;
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading || !user) return <div className="p-8 text-center">Завантаження…</div>;

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">Дозволити доступ QuickTeam Workspace?</h1>
      <p className="mt-3 text-sm opacity-80">
        QuickTeam Workspace зможе працювати з вашими проєктами QuickTeam+ від вашого імені:
        читати етапи й матеріали та писати в чат. Ви ввійшли як {user.email}.
      </p>
      <p className="mt-2 text-sm opacity-80">Доступ можна відкликати будь-коли в налаштуваннях workspace.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={allow}
          disabled={submitting}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Підтвердження…' : 'Дозволити'}
        </button>
        <button
          type="button"
          onClick={() => router.replace('/')}
          disabled={submitting}
          className="rounded-lg border px-4 py-2"
        >
          Скасувати
        </button>
      </div>
    </div>
  );
}
```

> Check `useAuth()`'s real return shape in `qt/src/lib/hooks/useAuth.js` before wiring `{ user, loading }` and adapt to whatever it actually exports.

- [ ] **Step 3: Verify by hand against the emulator or dev server**

```bash
cd qt && npm run dev
```
Open `/oauth/authorize?client_id=quickteam-workspace&redirect_uri=http://localhost:3000/api/integrations/qtplus/callback&state=test123`.
Expected: signed out → bounced to `/login`; signed in → consent screen; **Дозволити** → browser lands on the workspace callback URL carrying `?code=…&state=test123` (a 404 there is fine — that route arrives in Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/oauth/authorize src/app/\(main\)/oauth
git commit -m "feat(oauth): add QuickTeam+ consent screen and code minting

Consent is authorised by a Firebase ID token rather than a cookie, so it
cannot be driven cross-site. redirect_uri is matched exactly against the
client's allowlist, and an unapproved one is refused with a JSON error rather
than a redirect — redirecting to it is the attack."
```

---

## Task 3: QT+ — token exchange

**Files:**
- Create: `qt/src/app/api/oauth/token/route.js`

**Interfaces:**
- Consumes: `verifyClientSecret`, `getOAuthClient`, `isAllowedRedirectUri`, `consumeAuthCode`, `mintGrant`.
- Produces: `POST /api/oauth/token` body `{ code, clientId, clientSecret, redirectUri }` → `{ qtUserId, email, refreshToken }`.

- [ ] **Step 1: Write the route**

```js
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { getOAuthClient, isAllowedRedirectUri, verifyClientSecret } from '@/lib/server/oauthClients';
import { consumeAuthCode, mintGrant } from '@/lib/server/oauthGrants';

export async function POST(req) {
  try {
    const { code, clientId, clientSecret, redirectUri } = await req.json().catch(() => ({}));

    // Секрет перевіряємо ПЕРШИМ: без нього ендпоінт не має нічого повідомляти
    // про існування коду.
    if (!verifyClientSecret(clientId, clientSecret)) {
      console.warn('[api/oauth/token] bad client credentials for', clientId);
      return NextResponse.json({ error: 'Невірні облікові дані застосунку.' }, { status: 401 });
    }

    const client = getOAuthClient(clientId);
    if (!isAllowedRedirectUri(client, redirectUri)) {
      return NextResponse.json({ error: 'Недозволена адреса повернення.' }, { status: 400 });
    }

    const db = getAdminDb();
    const consumed = await consumeAuthCode({ db, code, clientId, redirectUri });
    if (!consumed.ok) {
      return NextResponse.json({ error: 'Код недійсний або протух.', code: 'invalid_code' }, { status: 400 });
    }

    const { refreshToken } = await mintGrant({
      db,
      clientId,
      qtUserId: consumed.qtUserId,
      email: consumed.email,
    });

    return NextResponse.json({ qtUserId: consumed.qtUserId, email: consumed.email, refreshToken });
  } catch (error) {
    console.error('[api/oauth/token]', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the secret gate by hand**

With `npm run dev` and `QTPLUS_WORKSPACE_CLIENT_SECRET` set in `qt/.env.local`:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"quickteam-workspace","clientSecret":"wrong","code":"x","redirectUri":"http://localhost:3000/api/integrations/qtplus/callback"}'
```
Expected: `401`. With the correct secret and a bogus code: `400`. Two different failures prove the secret gate runs before the code lookup.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/oauth/token
git commit -m "feat(oauth): add QuickTeam+ token exchange

The client secret is checked before anything else, so the endpoint reveals
nothing about a code's existence to an unauthenticated caller."
```

---

## Task 4: QT+ — revoke

**Files:**
- Create: `qt/src/app/api/oauth/revoke/route.js`

**Interfaces:**
- Consumes: `verifyClientSecret`, `revokeGrant`.
- Produces: `POST /api/oauth/revoke` body `{ clientId, clientSecret, refreshToken }` → `{ ok: true }`.

- [ ] **Step 1: Write the route**

```js
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { verifyClientSecret } from '@/lib/server/oauthClients';
import { revokeGrant } from '@/lib/server/oauthGrants';

export async function POST(req) {
  try {
    const { clientId, clientSecret, refreshToken } = await req.json().catch(() => ({}));

    if (!verifyClientSecret(clientId, clientSecret)) {
      return NextResponse.json({ error: 'Невірні облікові дані застосунку.' }, { status: 401 });
    }

    await revokeGrant({ db: getAdminDb(), refreshToken, clientId });
    // Відповідь однакова і для успіху, і для невідомого токена: інакше цей
    // ендпоінт перетворюється на оракул "чи існує такий грант".
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/oauth/revoke]', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/oauth/revoke
git commit -m "feat(oauth): add QuickTeam+ grant revocation

Responds identically for a revoked and an unknown token so it cannot be used
to probe which grants exist."
```

---

## Task 5: Workspace — token sealing and QT+ state

**Files:**
- Create: `qt-workspace/src/lib/server/secretBox.mjs`
- Modify: `qt-workspace/src/lib/server/oauthState.mjs`
- Test: `qt-workspace/tests/secret-box.test.mjs`
- Modify: `qt-workspace/tests/oauth-state.test.mjs`
- Modify: `qt-workspace/package.json`

**Interfaces:**
- Produces:
  - `seal(plaintext) -> { v: 1, iv, tag, data }` and `open(box) -> string` (throws on tamper/misconfig)
  - `QTPLUS_STATE_COOKIE`, `buildQtPlusState({ redirectTo, nonce })`, `verifyQtPlusState(raw, cookieNonce) -> { redirectTo, nonce } | null`
- Reuses the generic `createStateNonce`, `nonceMatches`, `getStateCookieOptions` already in `oauthState.mjs`. **Do not write a second nonce mechanism** — that module exists because the OneB flow had a decorative one.

- [ ] **Step 1: Write the failing tests**

`qt-workspace/tests/secret-box.test.mjs`:

```mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seal, open } from '../src/lib/server/secretBox.mjs';

const KEY = randomBytes(32).toString('base64');

test('round-trips a secret', (t) => {
  process.env.QTPLUS_TOKEN_KEY = KEY;
  const box = seal('refresh-token-value');
  assert.equal(open(box), 'refresh-token-value');
});

test('ciphertext does not contain the plaintext', () => {
  process.env.QTPLUS_TOKEN_KEY = KEY;
  const box = seal('refresh-token-value');
  assert.equal(JSON.stringify(box).includes('refresh-token-value'), false);
});

test('same plaintext seals differently each time', () => {
  process.env.QTPLUS_TOKEN_KEY = KEY;
  assert.notEqual(seal('x').data, seal('x').data, 'IV must not be reused');
});

test('refuses to open a tampered ciphertext', () => {
  process.env.QTPLUS_TOKEN_KEY = KEY;
  const box = seal('refresh-token-value');
  const flipped = Buffer.from(box.data, 'base64');
  flipped[0] ^= 0xff;
  assert.throws(() => open({ ...box, data: flipped.toString('base64') }));
});

test('refuses to open with the wrong key', () => {
  process.env.QTPLUS_TOKEN_KEY = KEY;
  const box = seal('refresh-token-value');
  process.env.QTPLUS_TOKEN_KEY = randomBytes(32).toString('base64');
  assert.throws(() => open(box));
});

test('fails closed when the key is missing or the wrong size', () => {
  delete process.env.QTPLUS_TOKEN_KEY;
  assert.throws(() => seal('x'), /QTPLUS_TOKEN_KEY/);
  process.env.QTPLUS_TOKEN_KEY = randomBytes(16).toString('base64');
  assert.throws(() => seal('x'), /32/);
});
```

Append to `qt-workspace/tests/oauth-state.test.mjs`:

```mjs
import {
  QTPLUS_STATE_COOKIE, buildQtPlusState, verifyQtPlusState,
} from '../src/lib/server/oauthState.mjs';

test('QT+ state uses its own cookie, separate from OneB', () => {
  assert.equal(QTPLUS_STATE_COOKIE, 'qt_qtplus_state');
  assert.notEqual(QTPLUS_STATE_COOKIE, OAUTH_STATE_COOKIE);
});

test('QT+ state rejects a stateless or mismatched callback', () => {
  const nonce = createStateNonce();
  assert.equal(verifyQtPlusState('{"r":"/settings"}', nonce), null);
  assert.equal(verifyQtPlusState(buildQtPlusState({ redirectTo: '/', nonce }), createStateNonce()), null);
  assert.equal(verifyQtPlusState('', nonce), null);
});

test('QT+ state round-trips with its nonce', () => {
  const nonce = createStateNonce();
  const state = buildQtPlusState({ redirectTo: '/settings', nonce });
  assert.deepEqual(verifyQtPlusState(state, nonce), { redirectTo: '/settings', nonce });
});
```
> `OAUTH_STATE_COOKIE` and `createStateNonce` are already imported at the top of that file — extend the existing import rather than adding a second one.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd qt-workspace && node --test tests/secret-box.test.mjs
```
Expected: FAIL — cannot find `secretBox.mjs`.

- [ ] **Step 3: Write `secretBox.mjs`**

```mjs
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey() {
  const raw = process.env.QTPLUS_TOKEN_KEY;
  if (!raw) {
    throw new Error('QTPLUS_TOKEN_KEY is not configured — refusing to handle QuickTeam+ tokens.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`QTPLUS_TOKEN_KEY must decode to 32 bytes, got ${key.length}.`);
  }
  return key;
}

export function seal(plaintext) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function open(box) {
  if (!box || box.v !== 1) throw new Error('Unsupported sealed box.');
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(box.iv, 'base64'));
  // GCM: a wrong key or a flipped byte makes final() throw. That is the point —
  // a tampered token must be an error, never a silently different value.
  decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 4: Add the QT+ state helpers to `oauthState.mjs`**

Append:

```mjs
// QuickTeam+ link flow. Same nonce mechanism as OneB, separate cookie so the
// two flows cannot consume each other's state.
export const QTPLUS_STATE_COOKIE = 'qt_qtplus_state';

export function buildQtPlusState({ redirectTo, nonce }) {
  return JSON.stringify({ r: redirectTo, n: nonce });
}

export function verifyQtPlusState(stateRaw, cookieNonce) {
  if (typeof stateRaw !== 'string' || !stateRaw) return null;

  const candidates = [stateRaw];
  try {
    const decoded = decodeURIComponent(stateRaw);
    if (decoded !== stateRaw) candidates.push(decoded);
  } catch {}

  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;
    if (typeof parsed.n !== 'string' || !parsed.n) continue;
    if (!nonceMatches(cookieNonce, parsed.n)) return null;
    return { redirectTo: parsed.r, nonce: parsed.n };
  }
  return null;
}
```

- [ ] **Step 5: Register the test script**

In `qt-workspace/package.json`, after `"test:oauth-state"`:
```json
    "test:secret-box": "node --test tests/secret-box.test.mjs",
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run test:secret-box && npm run test:oauth-state
```
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/secretBox.mjs src/lib/server/oauthState.mjs tests/secret-box.test.mjs tests/oauth-state.test.mjs package.json
git commit -m "feat(qtplus): add AES-256-GCM token sealing and QuickTeam+ OAuth state

Reuses the nonce mechanism added for the OneB CSRF fix rather than growing a
second one, with a separate cookie so the two flows cannot consume each
other's state. Sealing fails closed when QTPLUS_TOKEN_KEY is absent or the
wrong size, and GCM makes a tampered token an error rather than a silently
different value."
```

---

## Task 6: Workspace — connect and callback

**Files:**
- Create: `qt-workspace/src/lib/server/qtplusLink.js`
- Create: `qt-workspace/src/app/api/integrations/qtplus/connect/route.js`
- Create: `qt-workspace/src/app/api/integrations/qtplus/callback/route.js`

**Interfaces:**
- Consumes: `seal` (Task 5); `createStateNonce`, `getStateCookieOptions`, `buildQtPlusState`, `verifyQtPlusState`, `QTPLUS_STATE_COOKIE` (Task 5); `getAdminAuth`, `getAdminDb`; `getSafeAuthRedirect`; QT+'s `POST /api/oauth/token` (Task 3).
- Produces:
  - `readLink(uid) -> { qtUserId, email, connectedAt } | null` (never returns the token)
  - `writeLink(uid, { qtUserId, email, refreshToken })`
  - `deleteLink(uid) -> { refreshToken } | null` (returns the token once, for revocation)
  - `getSessionUid(request) -> string | null`

**Storage:** `users/{uid}/private/qtplus` — `{ qtUserId, email, clientId, connectedAt, refreshTokenBox }`. Locked shut by rules in Task 8.

- [ ] **Step 1: Write `qtplusLink.js`**

```js
import 'server-only';

import { admin, getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import { seal, open } from '@/lib/server/secretBox.mjs';

export const QTPLUS_CLIENT_ID = 'quickteam-workspace';

function linkRef(uid) {
  return getAdminDb().collection('users').doc(uid).collection('private').doc('qtplus');
}

export async function getSessionUid(request) {
  const sessionCookie = request.cookies.get('qt_session')?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Deliberately never returns the token — nothing user-facing has a use for it. */
export async function readLink(uid) {
  const snap = await linkRef(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    qtUserId: data.qtUserId,
    email: data.email || null,
    connectedAt: data.connectedAt?.toDate?.()?.toISOString() || null,
  };
}

export async function writeLink(uid, { qtUserId, email, refreshToken }) {
  await linkRef(uid).set({
    qtUserId,
    email: email || null,
    clientId: QTPLUS_CLIENT_ID,
    refreshTokenBox: seal(refreshToken),
    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteLink(uid) {
  const snap = await linkRef(uid).get();
  if (!snap.exists) return null;

  let refreshToken = null;
  try {
    refreshToken = open(snap.data().refreshTokenBox);
  } catch (error) {
    // An unopenable box (key rotated, corrupt data) must not strand the user
    // with a link they cannot remove. Drop the doc; the grant is then orphaned
    // in QT+ and can only be revoked from there.
    console.error('[qtplus] could not open sealed token while disconnecting:', error.message);
  }
  await linkRef(uid).delete();
  return { refreshToken };
}
```

- [ ] **Step 2: Write the connect route**

`src/app/api/integrations/qtplus/connect/route.js`:

```js
import { NextResponse } from 'next/server';
import { getSessionUid, QTPLUS_CLIENT_ID } from '@/lib/server/qtplusLink';
import { getSafeAuthRedirect } from '@/lib/utils/authRedirect';
import {
  buildQtPlusState,
  createStateNonce,
  getStateCookieOptions,
  QTPLUS_STATE_COOKIE,
} from '@/lib/server/oauthState.mjs';

const SETTINGS = '/settings?section=qtplus';

function settingsError(origin, error) {
  const url = new URL('/settings', origin);
  url.searchParams.set('section', 'qtplus');
  url.searchParams.set('qtplusError', error);
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const { origin, searchParams } = request.nextUrl;

  const uid = await getSessionUid(request);
  if (!uid) return settingsError(origin, 'session');

  const qtPlusUrl = process.env.NEXT_PUBLIC_QTPLUS_URL;
  if (!qtPlusUrl) {
    console.error('[qtplus] NEXT_PUBLIC_QTPLUS_URL is not configured');
    return settingsError(origin, 'not_configured');
  }

  const redirectTo = getSafeAuthRedirect(searchParams.get('r'), SETTINGS);
  const nonce = createStateNonce();

  const authorizeUrl = new URL('/oauth/authorize', qtPlusUrl);
  authorizeUrl.searchParams.set('client_id', QTPLUS_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', `${origin}/api/integrations/qtplus/callback`);
  authorizeUrl.searchParams.set('state', buildQtPlusState({ redirectTo, nonce }));

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(QTPLUS_STATE_COOKIE, nonce, getStateCookieOptions());
  return response;
}
```

- [ ] **Step 3: Write the callback route**

`src/app/api/integrations/qtplus/callback/route.js`:

```js
import { NextResponse } from 'next/server';
import { getSessionUid, writeLink, QTPLUS_CLIENT_ID } from '@/lib/server/qtplusLink';
import { getSafeAuthRedirect } from '@/lib/utils/authRedirect';
import {
  getStateCookieOptions,
  QTPLUS_STATE_COOKIE,
  verifyQtPlusState,
} from '@/lib/server/oauthState.mjs';

function settingsUrl(origin, params) {
  const url = new URL('/settings', origin);
  url.searchParams.set('section', 'qtplus');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const response = await handleCallback(request);
  // Single use, cleared on every outcome — a captured callback URL is dead.
  response.cookies.set(QTPLUS_STATE_COOKIE, '', getStateCookieOptions(0));
  return response;
}

async function handleCallback(request) {
  const { origin, searchParams } = request.nextUrl;

  try {
    const state = verifyQtPlusState(
      searchParams.get('state') || '',
      request.cookies.get(QTPLUS_STATE_COOKIE)?.value || ''
    );
    if (!state) {
      console.warn('[qtplus] rejected callback: state did not match the nonce cookie');
      return settingsUrl(origin, { qtplusError: 'state' });
    }

    const code = searchParams.get('code');
    if (!code) return settingsUrl(origin, { qtplusError: 'no_code' });

    const uid = await getSessionUid(request);
    if (!uid) return settingsUrl(origin, { qtplusError: 'session' });

    const qtPlusUrl = process.env.NEXT_PUBLIC_QTPLUS_URL;
    const clientSecret = process.env.QTPLUS_CLIENT_SECRET;
    if (!qtPlusUrl || !clientSecret) {
      console.error('[qtplus] NEXT_PUBLIC_QTPLUS_URL or QTPLUS_CLIENT_SECRET is not configured');
      return settingsUrl(origin, { qtplusError: 'not_configured' });
    }

    const tokenRes = await fetch(new URL('/api/oauth/token', qtPlusUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        clientId: QTPLUS_CLIENT_ID,
        clientSecret,
        redirectUri: `${origin}/api/integrations/qtplus/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[qtplus] token exchange failed:', tokenRes.status, await tokenRes.text());
      return settingsUrl(origin, { qtplusError: 'exchange' });
    }

    const { qtUserId, email, refreshToken } = await tokenRes.json();
    if (!qtUserId || !refreshToken) {
      console.error('[qtplus] token response missing qtUserId or refreshToken');
      return settingsUrl(origin, { qtplusError: 'exchange' });
    }

    await writeLink(uid, { qtUserId, email, refreshToken });

    const target = new URL(getSafeAuthRedirect(state.redirectTo, '/settings?section=qtplus'), origin);
    target.searchParams.set('qtplus', 'connected');
    return NextResponse.redirect(target);
  } catch (error) {
    console.error('[qtplus] callback failed:', error);
    return settingsUrl(origin, { qtplusError: 'unexpected' });
  }
}
```

- [ ] **Step 4: Verify the state gate by hand**

```bash
cd qt-workspace && npm run dev
curl -s -i "http://localhost:3000/api/integrations/qtplus/callback?code=x&state=%7B%22r%22%3A%22%2F%22%7D" | grep -i "^location"
```
Expected: redirect carrying `qtplusError=state` — a stateless callback is refused before the code is ever exchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/qtplusLink.js src/app/api/integrations/qtplus
git commit -m "feat(qtplus): add connect and callback for the QuickTeam+ link

The code is exchanged server-to-server and the refresh token is sealed before
it touches Firestore, so it never exists in a browser or in a client-readable
document. The callback verifies state against a single-use nonce cookie before
doing any work."
```

---

## Task 7: Workspace — status and disconnect

**Files:**
- Create: `qt-workspace/src/app/api/integrations/qtplus/route.js`

**Interfaces:**
- Consumes: `readLink`, `deleteLink`, `getSessionUid`, `QTPLUS_CLIENT_ID`; `authenticateRequest`; `routeErrorResponse`; QT+'s `POST /api/oauth/revoke` (Task 4).
- Produces: `GET /api/integrations/qtplus` → `{ connected, qtUserId?, email?, connectedAt? }`; `DELETE` → `{ success: true }`.

Uses `authenticateRequest` (Bearer ID token), matching the sibling `api/integrations/api-keys` route — these are fetched by client code, not navigated to.

- [ ] **Step 1: Write the route**

```js
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { readLink, deleteLink, QTPLUS_CLIENT_ID } from '@/lib/server/qtplusLink';

export async function GET(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const link = await readLink(authorization.user.uid);
    return NextResponse.json(link ? { connected: true, ...link } : { connected: false });
  } catch (error) {
    return routeErrorResponse(error, { context: 'QuickTeam+ status', fallbackMessage: 'Internal Server Error' });
  }
}

export async function DELETE(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const removed = await deleteLink(authorization.user.uid);
    if (!removed) return NextResponse.json({ success: true });

    // The local link is already gone. Revoking in QT+ is best effort: if it
    // fails the user is still disconnected here, and reporting failure would
    // tell them to retry something that cannot succeed.
    const qtPlusUrl = process.env.NEXT_PUBLIC_QTPLUS_URL;
    const clientSecret = process.env.QTPLUS_CLIENT_SECRET;
    if (removed.refreshToken && qtPlusUrl && clientSecret) {
      try {
        const revokeRes = await fetch(new URL('/api/oauth/revoke', qtPlusUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: QTPLUS_CLIENT_ID, clientSecret, refreshToken: removed.refreshToken }),
        });
        if (!revokeRes.ok) {
          console.error('[qtplus] revoke failed:', revokeRes.status, await revokeRes.text());
        }
      } catch (error) {
        console.error('[qtplus] revoke request failed:', error.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, { context: 'QuickTeam+ disconnect', fallbackMessage: 'Internal Server Error' });
  }
}
```

- [ ] **Step 2: Verify auth is required**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/integrations/qtplus
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/integrations/qtplus
```
Expected: `401` for both.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/integrations/qtplus/route.js
git commit -m "feat(qtplus): add QuickTeam+ link status and disconnect

Disconnect removes the local link first and treats revocation in QT+ as best
effort — a failed revoke must not leave the user unable to disconnect."
```

---

## Task 8: Workspace — rules for the private link and the org flag

**Files:**
- Modify: `qt-workspace/firestore.rules`
- Test: `qt-workspace/tests/firestore.rules.test.mjs`

**Context — verified against the current rules, do not re-derive:**
- `users/{uid}` exposes only `match /settings/{settingsDoc}`, so `users/{uid}/private/qtplus` is already default-denied. That is not enough: making it explicit pins it with a test so a future wildcard under `users/{uid}` cannot quietly expose a live credential. `match /organizations/{orgId}/private/{privateDoc} { allow read, write: if false; }` at the bottom of the file is the exact precedent — mirror it.
- **The org flag needs no rule change and no new field.** `match /organizations/{orgId}/settings/{settingsDoc}` already grants `read: if isOrgMember(orgId)` and `write: if isOrgAdminOrOwner(orgId)`. That is precisely the semantics Phase 1 wants: every member can read the flag to know whether to offer the button, only admins can flip it. The tests below prove that rather than assuming it.

- [ ] **Step 1: Write the failing tests**

Append to `qt-workspace/tests/firestore.rules.test.mjs`. **Read the file first** and reuse its real helpers and seeded fixtures — the calls below are illustrative of intent, not of its API. If it has no admin/member fixture for an org, seed one the way the neighbouring tests do.

```mjs
test('users/{uid}/private is unreachable even for the account owner', async () => {
  const db = authed('user1');
  await assertFails(getDoc(doc(db, 'users', 'user1', 'private', 'qtplus')));
  await assertFails(setDoc(doc(db, 'users', 'user1', 'private', 'qtplus'), { qtUserId: 'x' }));
});

test('users/{uid}/private is unreachable for anyone else', async () => {
  const db = authed('user2');
  await assertFails(getDoc(doc(db, 'users', 'user1', 'private', 'qtplus')));
});

test('users/{uid}/settings still works', async () => {
  const db = authed('user1');
  await assertSucceeds(setDoc(doc(db, 'users', 'user1', 'settings', 'prefs'), { theme: 'dark' }));
});

test('a member reads the QuickTeam+ org flag but cannot flip it', async () => {
  // The personal card gates on this flag, so members must be able to read it.
  await assertSucceeds(getDoc(doc(authed('member1'), 'organizations', 'org1', 'settings', 'integrations')));
  await assertFails(
    setDoc(doc(authed('member1'), 'organizations', 'org1', 'settings', 'integrations'), { qtPortalEnabled: true })
  );
});

test('an org admin can flip the QuickTeam+ org flag', async () => {
  await assertSucceeds(
    setDoc(doc(authed('admin1'), 'organizations', 'org1', 'settings', 'integrations'),
      { qtPortalEnabled: true }, { merge: true })
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:rules:emulator
```
Expected: the `private` tests already pass on default-deny — that is fine and is the point of pinning them. The org-flag tests fail if the fixtures are missing. **Fix the fixtures, not the expectations.**

- [ ] **Step 3: Add the explicit rule**

In `qt-workspace/firestore.rules`, inside `match /users/{uid}`, after the `settings` block. This mirrors the existing `organizations/{orgId}/private` rule:

```js
      // Written only by the Admin SDK in /api/integrations/qtplus/*. Holds a
      // sealed QuickTeam+ refresh token: readable by nobody, including the
      // account's own owner. Default-deny already covers this — stated
      // explicitly so a future wildcard under users/{uid} cannot open it.
      match /private/{privateDoc} {
        allow read, write: if false;
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:rules:emulator
```
Expected: PASS, with every pre-existing rules test still green.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.mjs
git commit -m "test(rules): pin users/{uid}/private shut and prove the org flag needs admin

The sealed QuickTeam+ token is denied to every client including the account
owner. Default-deny already did this; the explicit rule and test stop a future
wildcard from opening it silently, and mirror the organizations/{id}/private
rule that already exists.

The org flag needed no rule at all — organizations/{id}/settings is already
member-read/admin-write. Tested rather than assumed."
```

---

## Task 9: Workspace — personal QuickTeam+ card in Settings

**Files:**
- Modify: `qt-workspace/src/app/(app)/settings/page.js`

**Interfaces:**
- Consumes: `GET`/`DELETE /api/integrations/qtplus` (Task 7); `GET /api/integrations/qtplus/connect` (Task 6).
- Produces: a personal `qtplus` section, deep-linkable at `/settings?section=qtplus`.

**Two facts about the existing page that change this task — verified, do not re-derive:**

1. **The org toggle already exists. Do not build one.** `NAV` already has `{ id: 'integrations', label: 'Інтеграції', group: 'Організація', adminOnly: true }`, and its section renders a **QuickTeam+ card** with a `ToggleSwitch` bound to `qtEnabled` → `saveIntegration`, persisted as `qtPortalEnabled` at `organizations/{activeOrgId}/settings/integrations` (read at ~line 689, written by `confirmSaveIntegration` at ~line 1002). That *is* the spec's org-level flag. Reuse it; the `qtEnabled` state is already loaded in this component and can gate the personal card directly. Do **not** add a `qtPlusEnabled` field.

2. **The personal card cannot live in Інтеграції.** That section is `adminOnly`, so members never see it — and members are exactly who needs a *personal* connect button. The spec puts the card there, but the spec did not know this section is admin-gated. Putting a personal action behind an admin gate would make the feature unreachable for most users, which defeats the "персональна модель" the whole design rests on.

**Therefore:** add a new **personal** nav section (group `Особисте`, no `adminOnly`) for the personal connection, and leave the org toggle where it already is. Record this deviation in `progress.md`.

- [ ] **Step 1: Read the existing patterns**

Study in `settings/page.js`: `handleConnectOneB` (session refresh before navigating), `handleDisconnectOneB`, the `LoginMethodItem` component (props: `icon, title, detail, connected, primary, loading, disabled, soon, staticMethod, onConnect, onDisconnect`), the `Section`/`Card` primitives, the `section` deep-link effect, and the `authError`/`auth` toast effect. Mirror them. The card is intentionally plain — Phase 4 restyles it.

- [ ] **Step 2: Register the nav section**

In `NAV`, in the `Особисте` group, after `auth-methods`:

```jsx
  { id: 'qtplus',        label: 'QuickTeam+',        icon: PlugZap,       group: 'Особисте' },
```
`PlugZap` is already imported for the `integrations` entry — reuse it, do not add an icon import.

- [ ] **Step 2: Add status loading and handlers**

```jsx
  const [qtPlusLink, setQtPlusLink] = useState(null);
  const [qtPlusLoading, setQtPlusLoading] = useState(false);

  const loadQtPlusStatus = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/integrations/qtplus', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('status');
      setQtPlusLink(await response.json());
    } catch (error) {
      console.error('[settings] QuickTeam+ status failed:', error);
    }
  }, []);

  useEffect(() => { loadQtPlusStatus(); }, [loadQtPlusStatus]);

  const handleConnectQtPlus = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    setQtPlusLoading(true);
    try {
      // The callback authenticates by qt_session cookie, so it must be fresh
      // before we leave the SPA — same reason handleConnectOneB does this.
      const idToken = await firebaseUser.getIdToken(true);
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!sessionResponse.ok) throw new Error('Failed to refresh server session');
      window.location.href = '/api/integrations/qtplus/connect';
    } catch (error) {
      console.error('[settings] QuickTeam+ connect failed:', error);
      showToast('Не вдалося почати підключення QuickTeam+', 'error');
      setQtPlusLoading(false);
    }
  };

  const handleDisconnectQtPlus = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    setQtPlusLoading(true);
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const response = await fetch('/api/integrations/qtplus', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('disconnect');
      setQtPlusLink({ connected: false });
      showToast('QuickTeam+ відключено');
    } catch (error) {
      console.error('[settings] QuickTeam+ disconnect failed:', error);
      showToast('Не вдалося відключити QuickTeam+', 'error');
    } finally {
      setQtPlusLoading(false);
    }
  };
```

- [ ] **Step 4: Extend the callback toast effect**

Where `authSuccess`/`authError` are handled, add:

```jsx
      const qtplus = params.get('qtplus');
      const qtplusError = params.get('qtplusError');
      if (qtplus === 'connected') {
        queueMicrotask(() => showToast('QuickTeam+ підключено'));
        loadQtPlusStatus();
      }
      if (qtplusError) {
        const message = qtplusError === 'state'
          ? 'Термін дії посилання минув або воно відкрите не в тому браузері. Спробуйте ще раз'
          : qtplusError === 'session'
            ? 'Не вдалося підтвердити сесію. Увійдіть ще раз і повторіть підключення'
            : qtplusError === 'not_configured'
              ? 'Інтеграцію QuickTeam+ не налаштовано на сервері'
              : 'Не вдалося підключити QuickTeam+';
        queueMicrotask(() => showToast(message, 'error'));
      }
```

- [ ] **Step 5: Render the section**

Add a `case 'qtplus':` beside the other section cases in the same `switch`. `qtEnabled` is the existing org-flag state — this is the gate, and it is why no new flag is needed.

```jsx
      case 'qtplus':
        return (
          <Section title="QuickTeam+" desc="Підключи свій акаунт QuickTeam+, щоб бачити проєкти клієнтського порталу у workspace">
            <Card variant="white" padding="lg" className="!border-none">
              {!qtEnabled ? (
                <p className="text-[13px] text-muted py-2">
                  Інтеграцію з QuickTeam+ вимкнено для цієї організації. Зверніться до адміністратора.
                </p>
              ) : (
                <LoginMethodItem
                  icon={<Image src="/quickteam.png" alt="" width={20} height={20} className="object-contain" />}
                  title="QuickTeam+"
                  detail={qtPlusLink?.connected
                    ? (qtPlusLink.email || 'Акаунт підключено')
                    : 'Підключіть свій акаунт QuickTeam+'}
                  connected={Boolean(qtPlusLink?.connected)}
                  loading={qtPlusLoading}
                  disabled={qtPlusLoading}
                  onConnect={handleConnectQtPlus}
                  onDisconnect={handleDisconnectQtPlus}
                />
              )}
            </Card>
          </Section>
        );
```
`Image`, `Section`, `Card` and `LoginMethodItem` are all already imported/defined in this file. Verify `Section`'s real props (`title`, `desc`, `rightAction`) against its definition before relying on them.

- [ ] **Step 6: Verify**

```bash
npm run lint && npm run build
```
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/settings/page.js"
git commit -m "feat(qtplus): add the personal QuickTeam+ settings card

Gated on the org flag that Інтеграції already toggles, so no second flag and
no second toggle.

The card is a personal section rather than part of Інтеграції as the design
sketched: that section is adminOnly, and a personal connect button behind an
admin gate is unreachable for the members who need it."
```

---

## Manual verification (human, after Task 9)

No agent can drive this: it needs two real accounts across two deployed apps. Phase 0's rules deploy is precedent — the whole flow had never actually run.

1. As an owner, confirm the QuickTeam+ toggle is **on** in Settings → Інтеграції (this is the pre-existing `qtPortalEnabled` flag).
2. Go to Settings → **QuickTeam+** (personal section) and click **Підключити**. Expect QT+'s consent screen; if signed out of QT+, expect the login bounce first and the consent screen after.
3. Click **Дозволити**. Expect a return to Settings with `QuickTeam+ підключено` and the QT+ account's email shown.
4. In Firestore (`quickteam-me`), open `users/{uid}/private/qtplus`. **`refreshTokenBox` must be unreadable ciphertext and there must be no plaintext token field.**
5. In Firestore (`quickteam-portal-prod`), open `oauthGrants`. Exactly one new doc, `revokedAt: null`, and **the doc id must not be the token**.
6. Click **Відключити**. Expect the local doc gone and the QT+ grant's `revokedAt` set.
7. Open the callback URL from step 3 again (browser history). Expect `qtplusError=state` — the code and nonce are both spent.
8. As a non-admin member: Settings → QuickTeam+ **is** offered (it is personal), while Settings → Інтеграції is not (it is admin-only). Connecting as that member must link *their* QT+ account, not the admin's.
9. Turn the org toggle **off** as an owner, then reload as the member: the personal section must show "Інтеграцію … вимкнено" and offer no connect button. Existing links are kept, not deleted.

---

## Notes for the executor

- **Task 1 is the security core.** If a reviewer is going to catch something, it is here. Do not let its tests be shaped to fit the implementation.
- Phase 0's record: **every single task's first review found a real bug**, and in three cases the plan itself was wrong. Treat this plan as a strong hypothesis, not scripture. If the code contradicts it, the code wins — say so and record it in `qt/.superpowers/sdd/progress.md`.
- Two `getAdminApp()`s exist with different bugs. `qt`'s is hardened; **workspace's still adopts a foreign default app and falls through to a credential-less init**. Do not copy workspace's as a pattern; it is an open ticket.
- Phase 2 will need `lookupGrant` and a scoped `createCustomToken`. Task 1 already exposes `lookupGrant` for exactly that. Do not build it now.
