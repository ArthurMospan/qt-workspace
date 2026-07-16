# QuickTeam+ Phase 2 — Scoped Data Access (design)

**Status:** design approved 2026-07-16, pending spec review.
**Scope:** ONE sub-project. Phases 3 (project linking + picker) and 4 (project tab,
stages, materials, chat, real-time) are separate spec→plan→implement cycles and
are explicitly out of scope here.

## Goal

Give qt-workspace the ability to read a connected user's QuickTeam+ data
(projects, stages) **as that user**, reusing QuickTeam+'s own Firestore rules as
the authorization layer. Phase 1 already stores a sealed, reusable refresh-token
grant per user. Phase 2 turns that grant into live read access.

There is no project tab or board yet. The deliverable is proven by a minimal
read surfaced in the existing QuickTeam+ settings card: "Доступно N проєктів
QuickTeam+". Everything richer is Phase 4.

## Context this builds on (already shipped, verified)

- **Phase 1** connects an account: `users/{uid}/private/qtplus` holds
  `{ qtUserId, email, refreshTokenBox (AES-256-GCM), clientId }`, denied to every
  client by rules. Helpers in `qt-workspace/src/lib/server/qtplusLink.js`.
- **`lookupGrant({ db, refreshToken, clientId })`** in
  `qt/src/lib/server/oauthGrants.js` is ready and tested: validates the grant,
  returns `{ ok, qtUserId, email }`, updates `lastUsedAt`, and does **not** delete
  the grant (grants are reusable — the token endpoint's single-use rule applies to
  auth *codes*, not grants).
- QuickTeam+ data lives in Firebase project `quickteam-portal-prod`; qt-workspace
  runs against a different project (`quickteam-me`).
- QuickTeam+ rules gate every read on team membership, e.g.
  `projects/{id}`: `allow read: if request.auth.uid in resource.data.team`;
  `stages`/`materials`/`messages` via `isTeamMember(projectId)`.
- `qtUserId` in the grant **is** the `quickteam-portal-prod` Firebase Auth uid, so
  a custom token minted for `qtUserId` satisfies `auth.uid in project.team`
  unchanged.

## Architecture decision

Workspace reads QuickTeam+ data via a **Firebase custom token** minted by qt for
`qtUserId`, not via a proxy REST API on qt.

Why custom token:
- QuickTeam+'s existing Firestore rules become the authorization layer — no
  re-implementation of "who may see which project" on the qt side.
- The signed-in portal client is exactly what Phase 4 needs for real-time
  stages/materials/chat listeners, so this module is reused, not thrown away.
- The prior design intent; `lookupGrant()` was built for this.

Trade-off accepted: the portal Firebase **public** config must be available to
workspace, and revocation is not instant (see Known limitation).

## Components

### A. qt — `POST /api/oauth/session` (new)

Server-to-server. Mirrors `/api/oauth/token`'s security posture.

- Body: `{ clientId, clientSecret, refreshToken }`.
- **Verify `clientSecret` FIRST** (`verifyClientSecret`) — an unauthenticated
  caller learns nothing, not even whether a grant exists. Wrong/missing secret →
  `401 { error }`, same as `/token`.
- `lookupGrant({ db, refreshToken, clientId })`. Not ok → `400 { code: 'invalid_grant' }`.
- `admin.auth().createCustomToken(qtUserId)` → `200 { customToken, qtUserId, email }`.
- The grant is **not** consumed; repeated calls are expected and fine.
- Uses qt's existing admin (`FIREBASE_SERVICE_ACCOUNT`) — the service-account key
  signs the custom token. No new qt env var; reuses `QTPLUS_WORKSPACE_CLIENT_SECRET`.

### B. workspace — `GET /api/integrations/qtplus/session` (new)

- Authenticated by the `qt_session` cookie (`getSessionUid`), same as the other
  qtplus routes.
- No session cookie → `401`.
- Read the user's sealed grant via `qtplusLink.js`. No link → `404`
  (`{ code: 'not_connected' }`) so the card can show "not connected".
- Open the sealed refresh token, POST it to qt `/api/oauth/session` with
  `QTPLUS_CLIENT_SECRET`.
- qt 401 → `502`/`500` surfaced as a generic error; qt 400 invalid_grant →
  `409 { code: 'grant_invalid' }` (the stored link is stale — user must reconnect).
- Success → `200 { customToken }`. The custom token is **never persisted** in
  workspace; it is short-lived and re-fetched each time.

### C. workspace — portal Firebase client app + session hook

- `src/lib/portal/firebase.js`: initializes a **second** Firebase client app
  (named, e.g. `"qtplus-portal"`, via `initializeApp(config, name)`) with the
  portal project's **public** config from `NEXT_PUBLIC_QTPLUS_FB_*` env vars.
  Exports the portal `auth` and `db`. Guarded so it is inert when the config env
  vars are absent (mirrors how the whole section hides without
  `NEXT_PUBLIC_QTPLUS_URL`).
- `usePortalSession()` hook: fetches the custom token from route (B),
  `signInWithCustomToken(portalAuth, customToken)`, exposes
  `{ portalUser, loading, error }`. Signs into the portal app instance only —
  never touches the primary workspace auth.

### D. workspace — proof read in the settings card

- `usePortalProjects()`: once `portalUser` exists, one-shot
  `getDocs(query(collection(portalDb,'projects'), where('team','array-contains', qtUserId)))`.
- The existing QuickTeam+ card (`settings/page.js`, `case 'qtplus'`) renders one
  line: "Доступно N проєктів QuickTeam+" (or a spinner / error state). No board,
  no navigation, no per-project UI.

## Data flow

```
QuickTeam+ card (browser, workspace)
  └─ GET /api/integrations/qtplus/session   (qt_session cookie)
        └─ read sealed grant (users/{uid}/private/qtplus)
        └─ POST qt /api/oauth/session { clientSecret, refreshToken }
              └─ verifyClientSecret → lookupGrant → createCustomToken(qtUserId)
              └─ 200 { customToken, qtUserId, email }
        └─ 200 { customToken }
  └─ signInWithCustomToken(portalApp, customToken)
        └─ getDocs(projects where team array-contains qtUserId)
              ← QuickTeam+ rules authorize by team membership
  → "Доступно N проєктів QuickTeam+"
```

## New environment variables

Workspace only. All **public** (portal client config — not secrets), but
`NEXT_PUBLIC_` values are **inlined at build time → require a redeploy**, not just
a restart:

- `NEXT_PUBLIC_QTPLUS_FB_API_KEY`
- `NEXT_PUBLIC_QTPLUS_FB_AUTH_DOMAIN`
- `NEXT_PUBLIC_QTPLUS_FB_PROJECT_ID`
- `NEXT_PUBLIC_QTPLUS_FB_APP_ID`

No new secret. qt needs nothing new.

## Security

- The new qt endpoint gates on `clientSecret` before any grant lookup — identical
  to `/api/oauth/token`; an unauthenticated caller cannot probe grant existence.
- The custom token travels to the browser. It grants only `qtUserId`'s own portal
  access, is short-lived, and is minted fresh per request; it is never stored on
  either side.
- The sealed refresh token never leaves the workspace server; only the derived
  custom token reaches the client.
- Reads are authorized entirely by QuickTeam+'s deployed Firestore rules; workspace
  invents no new access logic.

## Known limitation (deliberately deferred)

After `signInWithCustomToken`, the portal session's ID token is valid ~1h and the
portal Firebase client auto-refreshes it. Revoking the grant (Disconnect) blocks
**new** sessions but does not instantly terminate an already-active portal session.
Acceptable for a test deployment. Hard revocation (portal-side session invalidation
or disabling the reused refresh token) is a later-phase concern, not Phase 2.

## Testing

- **qt** (`POST /api/oauth/session`, against the emulator):
  - valid grant → a custom token is returned;
  - wrong `clientSecret` → 401;
  - unknown / revoked grant → 400 `invalid_grant`;
  - the grant is **not deleted** by the exchange (a second call still succeeds).
  - **Signing caveat:** `admin.auth().createCustomToken()` is signed with the
    service-account private key; the Firebase Auth emulator does **not** sign it.
    So the test must either (a) provide a throwaway service-account private key in
    the test env so real signing happens, or (b) stub `createCustomToken` and
    assert it is called exactly once with `qtUserId` while the grant/secret/HTTP
    branches run for real. The plan picks one — likely (b), to keep the grant and
    secret assertions honest without shipping a key into the test stack. The
    grant-lookup, secret-gate, and not-consumed properties are the ones that must
    be tested for real; the signing call itself is Firebase's, not ours.
- **workspace** (`GET /api/integrations/qtplus/session`, node test, qt fetch mocked):
  - no session cookie → 401;
  - connected user, qt returns a token → 200 passes the token through;
  - no stored link → 404 `not_connected`;
  - qt returns 400 invalid_grant → 409 `grant_invalid`.
- **Portal client hook + real read:** browser E2E by the user — an agent cannot
  pass the portal login. Everything up to the browser leg is machine-verified.

## Out of scope (explicit)

Project tab, stages/materials/chat views, real-time listeners, linking a specific
workspace project to a QuickTeam+ project, and the project picker. Those are
Phases 3 and 4, each its own cycle.
