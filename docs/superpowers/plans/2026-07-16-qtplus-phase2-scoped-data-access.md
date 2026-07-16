# QuickTeam+ Phase 2 — Scoped Data Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let qt-workspace read a connected user's QuickTeam+ projects/stages **as that user**, by exchanging the stored grant for a Firebase custom token minted by qt.

**Architecture:** qt gains a secret-gated `POST /api/oauth/session` that turns a reusable grant into a Firebase custom token for `qtUserId`. qt-workspace relays the sealed grant to that endpoint server-side, hands the resulting custom token to the browser, signs into the QuickTeam+ Firebase project (`quickteam-portal-prod`) with it, and reads projects under QuickTeam+'s own Firestore rules. Proof is a single "Доступно N проєктів QuickTeam+" line in the existing settings card.

**Tech Stack:** Next.js 16 App Router, firebase-admin (qt + workspace), firebase client SDK (workspace, second named app), vitest + firestore emulator (qt tests), `node --test` `.mjs` (workspace tests).

**Design doc:** `docs/superpowers/specs/2026-07-16-qtplus-phase2-scoped-data-access-design.md`

## Global Constraints

- Two repos: `qt` (provider, Firebase project `quickteam-portal-prod`) and `qt-workspace` (client, Firebase project `quickteam-me`). Paths below are relative to each repo's root; each task names its repo.
- The wire `client_id` is the literal `quickteam-workspace` (exported as `QTPLUS_CLIENT_ID` in workspace). Never rename it.
- qt route security posture, copied from `/api/oauth/token` and `/api/oauth/revoke`: **verify `clientSecret` FIRST**, before any grant lookup. Wrong/unknown client or wrong secret → `401 { error: 'Невірні облікові дані застосунку.' }`.
- Grants are **reusable**: `lookupGrant` does not delete the grant. The new endpoint must not consume it.
- The custom token and the plaintext refresh token are never persisted in workspace. The refresh token never reaches the browser.
- workspace test files are `.mjs` under `tests/`, run with `node --test`, and must **not** import `server-only` (unresolvable in plain node). qt tests are `.js` under `tests/server/`, run via `firebase emulators:exec ... "vitest run tests/server"`.
- User-visible copy is Ukrainian, matching the existing card.
- No new secret is introduced. qt reuses `QTPLUS_WORKSPACE_CLIENT_SECRET`; workspace reuses `QTPLUS_CLIENT_SECRET` and adds only **public** `NEXT_PUBLIC_QTPLUS_FB_*` config.

---

### Task 1: qt — `POST /api/oauth/session` (grant → custom token)

**Repo:** `qt`

**Files:**
- Create: `src/app/api/oauth/session/route.js`
- Test: `tests/server/oauthSessionRoute.test.js`

**Interfaces:**
- Consumes: `verifyClientSecret(clientId, presented)` from `src/lib/server/oauthClients.js`; `lookupGrant({ db, refreshToken, clientId }) → { ok, qtUserId, email } | { ok:false, code }` from `src/lib/server/oauthGrants.js`; `getAdminDb()`, `getAdminAuth()` from `src/lib/server/firebaseAdmin.js`.
- Produces: `POST` handler. On success `200 { customToken, qtUserId, email }`; bad secret/unknown client `401`; invalid/revoked grant `400 { code: 'invalid_grant' }`; unexpected `500`.

- [ ] **Step 1: Write the failing test**

Create `tests/server/oauthSessionRoute.test.js`. Mirrors `oauthTokenRoute.test.js`'s bootstrap; stubs only `getAdminAuth` so signing does not require a private key (the emulator does not sign custom tokens), while `getAdminDb` stays real for the grant lookup.

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'quickteam-portal-test';
process.env.QTPLUS_WORKSPACE_CLIENT_SECRET = 'test-secret-value';
process.env.QTPLUS_WORKSPACE_REDIRECT_URIS = 'https://ws.test/cb';

// createCustomToken needs the service-account private key; the emulator will not
// sign. Stub getAdminAuth so the grant/secret/not-consumed branches run for real
// and the signing call itself (Firebase's code, not ours) is asserted, not run.
vi.mock('../../src/lib/server/firebaseAdmin.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAdminAuth: () => ({ createCustomToken: async (uid) => `custom-token-for:${uid}` }),
  };
});

const CLIENT = 'quickteam-workspace';

let POST;
let mintGrant;
let lookupGrant;
let app;
let db;

beforeAll(async () => {
  ({ POST } = await import('../../src/app/api/oauth/session/route.js'));
  ({ mintGrant, lookupGrant } = await import('../../src/lib/server/oauthGrants.js'));
  app = initializeApp({ projectId: 'quickteam-portal-test' }, 'oauth-session-route-tests');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('oauthGrants'));
});

function post(body) {
  return POST(new Request('http://qt.test/api/oauth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/oauth/session', () => {
  it('обмінює грант на custom token для qtUserId', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'uid-7', email: 'q@plus.test' });

    const res = await post({ clientId: CLIENT, clientSecret: 'test-secret-value', refreshToken });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customToken).toBe('custom-token-for:uid-7');
    expect(body.qtUserId).toBe('uid-7');
    expect(body.email).toBe('q@plus.test');
  });

  it('грант НЕ спалюється — повторний обмін теж працює', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'uid-7', email: null });
    expect((await post({ clientId: CLIENT, clientSecret: 'test-secret-value', refreshToken })).status).toBe(200);
    expect((await post({ clientId: CLIENT, clientSecret: 'test-secret-value', refreshToken })).status).toBe(200);
    // Grant still valid directly.
    expect((await lookupGrant({ db, refreshToken, clientId: CLIENT })).ok).toBe(true);
  });

  it('невірний секрет -> 401', async () => {
    const { refreshToken } = await mintGrant({ db, clientId: CLIENT, qtUserId: 'uid-7', email: null });
    expect((await post({ clientId: CLIENT, clientSecret: 'wrong', refreshToken })).status).toBe(401);
  });

  it('невідомий грант -> 400 invalid_grant', async () => {
    const res = await post({ clientId: CLIENT, clientSecret: 'test-secret-value', refreshToken: 'nope' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('invalid_grant');
  });

  it('невідомий клієнт -> 401', async () => {
    const res = await post({ clientId: 'nope', clientSecret: 'test-secret-value', refreshToken: 'x' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd qt && npm run test:server -- oauthSessionRoute`
Expected: FAIL — cannot resolve `src/app/api/oauth/session/route.js` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/oauth/session/route.js`:

```js
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/server/firebaseAdmin';
import { verifyClientSecret } from '@/lib/server/oauthClients';
import { lookupGrant } from '@/lib/server/oauthGrants';

/**
 * Обмін багаторазового гранта на короткоживучий Firebase custom token для
 * qtUserId. Виключно сервер-до-сервера: секрет ніколи не буває в браузері.
 * Грант НЕ споживається — картку можна відкривати скільки завгодно.
 */
export async function POST(req) {
  try {
    const { clientId, clientSecret, refreshToken } = await req.json().catch(() => ({}));

    // Секрет ПЕРШИМ: неавтентифікованому викликачу не повідомляємо навіть того,
    // чи існує грант.
    if (!verifyClientSecret(clientId, clientSecret)) {
      console.warn('[api/oauth/session] bad client credentials for', clientId);
      return NextResponse.json({ error: 'Невірні облікові дані застосунку.' }, { status: 401 });
    }

    const grant = await lookupGrant({ db: getAdminDb(), refreshToken, clientId });
    if (!grant.ok) {
      return NextResponse.json({ error: 'Грант недійсний.', code: 'invalid_grant' }, { status: 400 });
    }

    const customToken = await getAdminAuth().createCustomToken(grant.qtUserId);
    return NextResponse.json({ customToken, qtUserId: grant.qtUserId, email: grant.email });
  } catch (error) {
    console.error('[api/oauth/session]', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера.' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd qt && npm run test:server -- oauthSessionRoute`
Expected: PASS — all 5 cases green.

- [ ] **Step 5: Run the full qt server suite (no regressions)**

Run: `cd qt && npm run test:server`
Expected: PASS — previously-green server tests still pass.

- [ ] **Step 6: Commit**

```bash
cd qt
git add src/app/api/oauth/session/route.js tests/server/oauthSessionRoute.test.js
git commit -m "feat(oauth): mint a scoped custom token from a grant (Phase 2)"
```

---

### Task 2: workspace — grant→token exchange helper (pure, testable)

**Repo:** `qt-workspace`

**Files:**
- Create: `src/lib/portal/exchangeGrantForToken.mjs`
- Test: `tests/qtplus-exchange.test.mjs`
- Modify: `package.json` (add a test script)

**Interfaces:**
- Consumes: nothing from earlier tasks; talks to qt's `POST /api/oauth/session` (Task 1) over HTTP, injected as `fetchImpl` for tests.
- Produces: `exchangeGrantForToken({ qtPlusUrl, clientId, clientSecret, refreshToken, fetchImpl }) → Promise<{ ok:true, customToken, qtUserId, email } | { ok:false, code:'not_configured'|'grant_invalid'|'upstream' }>`.

- [ ] **Step 1: Write the failing test**

Create `tests/qtplus-exchange.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exchangeGrantForToken } from '../src/lib/portal/exchangeGrantForToken.mjs';

const base = {
  qtPlusUrl: 'https://qt.test',
  clientId: 'quickteam-workspace',
  clientSecret: 's3cret',
  refreshToken: 'grant-abc',
};

function fetchReturning(status, jsonBody) {
  return async () => new Response(JSON.stringify(jsonBody), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('missing config -> not_configured, no fetch', async () => {
  let called = false;
  const res = await exchangeGrantForToken({
    ...base, qtPlusUrl: '', fetchImpl: async () => { called = true; return new Response('{}'); },
  });
  assert.deepEqual(res, { ok: false, code: 'not_configured' });
  assert.equal(called, false);
});

test('200 -> passes token through', async () => {
  const res = await exchangeGrantForToken({
    ...base,
    fetchImpl: fetchReturning(200, { customToken: 'ct-1', qtUserId: 'uid-7', email: 'q@plus.test' }),
  });
  assert.deepEqual(res, { ok: true, customToken: 'ct-1', qtUserId: 'uid-7', email: 'q@plus.test' });
});

test('400 invalid_grant -> grant_invalid', async () => {
  const res = await exchangeGrantForToken({
    ...base, fetchImpl: fetchReturning(400, { code: 'invalid_grant' }),
  });
  assert.deepEqual(res, { ok: false, code: 'grant_invalid' });
});

test('401 -> upstream', async () => {
  const res = await exchangeGrantForToken({ ...base, fetchImpl: fetchReturning(401, { error: 'x' }) });
  assert.deepEqual(res, { ok: false, code: 'upstream' });
});

test('network throw -> upstream', async () => {
  const res = await exchangeGrantForToken({
    ...base, fetchImpl: async () => { throw new Error('boom'); },
  });
  assert.deepEqual(res, { ok: false, code: 'upstream' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd qt-workspace && node --test tests/qtplus-exchange.test.mjs`
Expected: FAIL — cannot find module `../src/lib/portal/exchangeGrantForToken.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/portal/exchangeGrantForToken.mjs`:

```js
/**
 * Pure server-side relay: grant -> qt /api/oauth/session -> custom token.
 * No `server-only` import so it is testable under plain `node --test`; the
 * route wrapper (Task 3) is what pulls in the admin SDK.
 */
export async function exchangeGrantForToken({
  qtPlusUrl, clientId, clientSecret, refreshToken, fetchImpl = globalThis.fetch,
}) {
  if (!qtPlusUrl || !clientSecret) return { ok: false, code: 'not_configured' };

  let res;
  try {
    res = await fetchImpl(new URL('/api/oauth/session', qtPlusUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, refreshToken }),
    });
  } catch (error) {
    console.error('[qtplus] session exchange request failed:', error.message);
    return { ok: false, code: 'upstream' };
  }

  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'invalid_grant') return { ok: false, code: 'grant_invalid' };
    return { ok: false, code: 'upstream' };
  }
  if (!res.ok) {
    console.error('[qtplus] session exchange failed:', res.status);
    return { ok: false, code: 'upstream' };
  }

  const { customToken, qtUserId, email } = await res.json().catch(() => ({}));
  if (!customToken) return { ok: false, code: 'upstream' };
  return { ok: true, customToken, qtUserId, email: email || null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd qt-workspace && node --test tests/qtplus-exchange.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Add the test script**

In `qt-workspace/package.json` `scripts`, after `"test:oauth-state"`, add:

```json
    "test:qtplus-exchange": "node --test tests/qtplus-exchange.test.mjs",
```

- [ ] **Step 6: Commit**

```bash
cd qt-workspace
git add src/lib/portal/exchangeGrantForToken.mjs tests/qtplus-exchange.test.mjs package.json
git commit -m "feat(qtplus): pure grant->custom-token exchange helper (Phase 2)"
```

---

### Task 3: workspace — sealed-token reader + session route

**Repo:** `qt-workspace`

**Files:**
- Modify: `src/lib/server/qtplusLink.js` (add `readSealedRefreshToken`)
- Create: `src/app/api/integrations/qtplus/session/route.js`

**Interfaces:**
- Consumes: `authenticateRequest(request) → { user:{uid} } | { error, status }` from `src/lib/server/firebaseAdmin.js`; `open(box)` from `src/lib/server/secretBox.mjs`; `exchangeGrantForToken(...)` from Task 2; `QTPLUS_CLIENT_ID` from `qtplusLink.js`.
- Produces: `readSealedRefreshToken(uid) → Promise<string|null>`. `GET` handler → `200 { customToken }`; unauth `401`; no link `404 { code:'not_connected' }`; stale grant `409 { code:'grant_invalid' }`; upstream/config `502 { code:'upstream' }`.

> **Testing note:** `qtplusLink.js` imports `server-only` and the admin SDK, and the route is server-only glue, so neither is exercised by `node --test` (the pure logic they wire together is already covered in Task 2). This task is verified by `npm run build` succeeding and by the browser E2E in the human-steps section. This matches how Phase 1's routes were verified in this repo.

- [ ] **Step 1: Add `readSealedRefreshToken` to `qtplusLink.js`**

After `readLink` in `src/lib/server/qtplusLink.js`, add:

```js
/**
 * Server-only: opens the sealed refresh token for relaying to QT+. Returns the
 * plaintext token or null. Deliberately separate from readLink, which never
 * exposes the token to anything user-facing.
 */
export async function readSealedRefreshToken(uid) {
  const snap = await linkRef(uid).get();
  if (!snap.exists) return null;
  try {
    return open(snap.data().refreshTokenBox);
  } catch (error) {
    console.error('[qtplus] could not open sealed token:', error.message);
    return null;
  }
}
```

(`open` is already imported at the top of the file: `import { seal, open } from '@/lib/server/secretBox.mjs';`.)

- [ ] **Step 2: Create the session route**

Create `src/app/api/integrations/qtplus/session/route.js`:

```js
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { readSealedRefreshToken, QTPLUS_CLIENT_ID } from '@/lib/server/qtplusLink';
import { exchangeGrantForToken } from '@/lib/portal/exchangeGrantForToken.mjs';

export async function GET(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const refreshToken = await readSealedRefreshToken(authorization.user.uid);
    if (!refreshToken) {
      return NextResponse.json({ code: 'not_connected' }, { status: 404 });
    }

    const result = await exchangeGrantForToken({
      qtPlusUrl: process.env.NEXT_PUBLIC_QTPLUS_URL,
      clientId: QTPLUS_CLIENT_ID,
      clientSecret: process.env.QTPLUS_CLIENT_SECRET,
      refreshToken,
    });

    if (result.ok) return NextResponse.json({ customToken: result.customToken });
    if (result.code === 'grant_invalid') {
      // The stored link no longer maps to a live grant — the user must reconnect.
      return NextResponse.json({ code: 'grant_invalid' }, { status: 409 });
    }
    return NextResponse.json({ code: 'upstream' }, { status: 502 });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'QuickTeam+ session',
      fallbackMessage: 'Internal Server Error',
    });
  }
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd qt-workspace && npm run build`
Expected: PASS — build completes; no import/type errors in the new route.

- [ ] **Step 4: Commit**

```bash
cd qt-workspace
git add src/lib/server/qtplusLink.js src/app/api/integrations/qtplus/session/route.js
git commit -m "feat(qtplus): server route relaying grant to a portal custom token (Phase 2)"
```

---

### Task 4: workspace — portal Firebase app + `usePortalSession`

**Repo:** `qt-workspace`

**Files:**
- Create: `src/lib/portal/firebase.js`
- Create: `src/lib/portal/usePortalSession.js`

**Interfaces:**
- Consumes: session route from Task 3 (`GET /api/integrations/qtplus/session`); `auth` (primary workspace auth) from `@/lib/firebase` for the caller's id token.
- Produces: `getPortalAuth() → Auth | null`, `getPortalDb() → Firestore | null` (null when portal config env is absent); `usePortalSession() → { portalUser, loading, error }` where `error ∈ { null, 'not_connected', 'grant_invalid', 'upstream' }`.

> **Testing note:** client-only React + Firebase SDK; not exercised by `node --test`. Verified by `npm run build` and browser E2E. Every piece is guarded so that when `NEXT_PUBLIC_QTPLUS_FB_PROJECT_ID` is unset the module is inert and the hook resolves to `{ portalUser: null, loading: false, error: null }` — the section already hides in that case.

- [ ] **Step 1: Portal Firebase app module**

Create `src/lib/portal/firebase.js`:

```js
'use client';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// PUBLIC config for the QuickTeam+ project (quickteam-portal-prod). Not secrets;
// they ship to the browser like any Firebase web config. NEXT_PUBLIC_ => inlined
// at build time, so adding them in Vercel needs a redeploy.
const config = {
  apiKey: process.env.NEXT_PUBLIC_QTPLUS_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_QTPLUS_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_QTPLUS_FB_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_QTPLUS_FB_APP_ID,
};

const PORTAL_APP = 'qtplus-portal';

function portalApp() {
  if (!config.projectId) return null; // integration not configured -> inert
  const existing = getApps().find((a) => a.name === PORTAL_APP);
  return existing || initializeApp(config, PORTAL_APP);
}

export function getPortalAuth() {
  const app = portalApp();
  return app ? getAuth(app) : null;
}

export function getPortalDb() {
  const app = portalApp();
  return app ? getFirestore(app) : null;
}
```

- [ ] **Step 2: `usePortalSession` hook**

Create `src/lib/portal/usePortalSession.js`:

```js
'use client';
import { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getPortalAuth } from '@/lib/portal/firebase';

/**
 * Signs into the QuickTeam+ (portal) Firebase project as the connected user,
 * using a short-lived custom token fetched from our own session route. Touches
 * only the portal auth instance — never the primary workspace auth.
 */
export function usePortalSession() {
  const [portalUser, setPortalUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const portalAuth = getPortalAuth();
    if (!portalAuth) { setLoading(false); return; } // integration not configured

    (async () => {
      try {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) { if (!cancelled) setLoading(false); return; }

        const idToken = await firebaseUser.getIdToken();
        const res = await fetch('/api/integrations/qtplus/session', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.status === 404) { if (!cancelled) { setLoading(false); setError('not_connected'); } return; }
        if (res.status === 409) { if (!cancelled) { setLoading(false); setError('grant_invalid'); } return; }
        if (!res.ok) { if (!cancelled) { setLoading(false); setError('upstream'); } return; }

        const { customToken } = await res.json();
        const cred = await signInWithCustomToken(portalAuth, customToken);
        if (!cancelled) { setPortalUser(cred.user); setLoading(false); }
      } catch (err) {
        console.error('[qtplus] portal session failed:', err);
        if (!cancelled) { setError('upstream'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { portalUser, loading, error };
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd qt-workspace && npm run build`
Expected: PASS — build completes with the two new client modules.

- [ ] **Step 4: Commit**

```bash
cd qt-workspace
git add src/lib/portal/firebase.js src/lib/portal/usePortalSession.js
git commit -m "feat(qtplus): portal Firebase app + custom-token sign-in hook (Phase 2)"
```

---

### Task 5: workspace — `usePortalProjects` proof line in the settings card

**Repo:** `qt-workspace`

**Files:**
- Create: `src/lib/portal/usePortalProjects.js`
- Modify: `src/app/(app)/settings/page.js` (the `case 'qtplus'` render block, around lines 1594-1660)

**Interfaces:**
- Consumes: `usePortalSession()` from Task 4; `getPortalDb()` from Task 4.
- Produces: `usePortalProjects(portalUser) → { count, loading, error }`. Renders one line in the connected state of the QuickTeam+ card.

> **Testing note:** client-only; verified by `npm run build` and the browser E2E in the human-steps section.

- [ ] **Step 1: `usePortalProjects` hook**

Create `src/lib/portal/usePortalProjects.js`:

```js
'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getPortalDb } from '@/lib/portal/firebase';

/**
 * One-shot count of the connected user's QuickTeam+ projects — the Phase 2 proof
 * that data actually flows. QT+ rules authorize the read by team membership.
 */
export function usePortalProjects(portalUser) {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!portalUser) return;
    const db = getPortalDb();
    if (!db) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'projects'), where('team', 'array-contains', portalUser.uid)),
        );
        if (!cancelled) { setCount(snap.size); setLoading(false); }
      } catch (err) {
        console.error('[qtplus] portal projects read failed:', err);
        if (!cancelled) { setError('read_failed'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [portalUser]);

  return { count, loading, error };
}
```

- [ ] **Step 2: Wire the proof line into the card**

At the top of `src/app/(app)/settings/page.js`, add near the other `@/lib/portal` / hook imports:

```js
import { usePortalSession } from '@/lib/portal/usePortalSession';
import { usePortalProjects } from '@/lib/portal/usePortalProjects';
```

Add a small child component near the bottom of the file (before the default export), so the hooks run only when the card is shown:

```jsx
function QtPlusProjectsProbe() {
  const { portalUser, loading: sessionLoading, error: sessionError } = usePortalSession();
  const { count, loading: projectsLoading } = usePortalProjects(portalUser);

  if (sessionLoading || projectsLoading) {
    return <p className="text-[13px] text-muted">Перевіряємо доступ до QuickTeam+…</p>;
  }
  if (sessionError === 'grant_invalid') {
    return <p className="text-[13px] text-red-500">Підключення застаріло — підключіть QuickTeam+ заново.</p>;
  }
  if (sessionError || count === null) return null; // not connected / not configured -> show nothing extra
  return <p className="text-[13px] text-muted">Доступно {count} проєктів QuickTeam+.</p>;
}
```

In the `case 'qtplus':` block (`src/app/(app)/settings/page.js`, ~lines 1594-1622), inside the `qtEnabled` branch, render `<QtPlusProjectsProbe />` immediately **after** the `<LoginMethodItem ... />` and gate it on the connected state, so it appears only once an account is linked. The edited branch becomes:

```jsx
              ) : (
                <>
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
                  {qtPlusLink?.connected && (
                    <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                      <QtPlusProjectsProbe />
                    </div>
                  )}
                </>
              )}
```

- [ ] **Step 3: Verify the build and lint**

Run: `cd qt-workspace && npm run build && npm run lint`
Expected: PASS — build completes; lint clean on the changed files.

- [ ] **Step 4: Commit**

```bash
cd qt-workspace
git add src/lib/portal/usePortalProjects.js "src/app/(app)/settings/page.js"
git commit -m "feat(qtplus): show connected user's QuickTeam+ project count (Phase 2 proof)"
```

---

### Task 6: Full verification pass (both repos)

**Repo:** both

- [ ] **Step 1: qt full suite**

Run: `cd qt && npm test`
Expected: PASS — all rules + server tests, including the new `oauthSessionRoute` cases.

- [ ] **Step 2: workspace logic tests + build**

Run: `cd qt-workspace && npm run test:qtplus-exchange && npm run test:oauth-state && npm run test:secret-box && npm run build`
Expected: PASS — new exchange test green, prior logic tests green, build clean.

- [ ] **Step 3: No accidental token logging**

Run: `cd qt-workspace && grep -rn "customToken" src | grep -i "console\."` and `cd qt && grep -rn "createCustomToken\|customToken" src | grep -i "console\."`
Expected: no matches — the custom token is never logged.

---

## Human steps (after the code is merged — cannot be done by an agent)

1. **qt env:** nothing new. `QTPLUS_WORKSPACE_CLIENT_SECRET` already set.
2. **workspace env (Vercel → qt-workspace → Settings → Environment Variables, Production + Preview):** add the **public** QuickTeam+ web config from Firebase Console (`quickteam-portal-prod` → Project settings → Web app):
   - `NEXT_PUBLIC_QTPLUS_FB_API_KEY`
   - `NEXT_PUBLIC_QTPLUS_FB_AUTH_DOMAIN`
   - `NEXT_PUBLIC_QTPLUS_FB_PROJECT_ID`
   - `NEXT_PUBLIC_QTPLUS_FB_APP_ID`
3. **Redeploy qt-workspace** (NEXT_PUBLIC_ is inlined at build time — a plain env change is not enough).
4. **Enable custom-token sign-in:** confirm Email/Password or Anonymous is not required — `signInWithCustomToken` only needs the project's default Auth to be enabled (it is, since QT+ users already sign in there). No console toggle expected; if sign-in errors with `auth/operation-not-allowed`, that is the signal to check the portal Auth providers.
5. **Browser E2E:** open workspace **Налаштування → QuickTeam+** as a connected user. Expect "Доступно N проєктів QuickTeam+" matching how many QuickTeam+ projects that account is a team member of. Disconnect → the line disappears. Reconnect → it returns.

---

## Self-review

**Spec coverage:**
- Component A (qt `/api/oauth/session`) → Task 1. ✓
- Component B (workspace session route) → Tasks 2 (pure helper) + 3 (route). ✓
- Component C (portal Firebase app + `usePortalSession`) → Task 4. ✓
- Component D (proof read in card) → Task 5. ✓
- New env vars → Human steps 2-3. ✓
- Security (secret-first, token not persisted/logged, refresh token never to browser) → Task 1 secret-first, Task 3 relays server-side only, Task 6 Step 3 logging check. ✓
- Known limitation (revocation not instant) → carried from spec; no code owns it in Phase 2, by design. ✓
- Testing plan (qt emulator with signing stub; workspace pure helper; E2E for client) → Tasks 1, 2, and the per-task testing notes. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every command has expected output.

**Type consistency:** `exchangeGrantForToken` return shape `{ ok, customToken, qtUserId, email }` / `{ ok:false, code }` is identical in Task 2 (definition), Task 3 (consumption), and its test. `readSealedRefreshToken(uid) → string|null` matches its single caller in Task 3. `usePortalSession() → { portalUser, loading, error }` matches Task 5's consumption. `getPortalDb()` / `getPortalAuth()` names match between Task 4 (definition) and Tasks 4-5 (use). `createCustomToken(qtUserId)` in Task 1 matches the stub in its test.
