# Task 2 Report: Admin SDK з guard на project_id

## Files created

- `c:\Users\Arthu\QuickTeam\qt\tests\server\firebaseAdmin.test.js` — unit tests for `assertServiceAccountProject`, verbatim from the plan (Task 2, Step 1).
- `c:\Users\Arthu\QuickTeam\qt\src\lib\server\firebaseAdmin.js` — Admin SDK initializer exporting `assertServiceAccountProject`, `loadCredential` (internal), `getAdminApp`, `getAdminDb`, `getAdminAuth`, verbatim from the plan (Task 2, Step 3).

No other files were modified. Did not touch `serviceAccountKey.json`, `clear.js`, or `src/app/api/chat/route.js` — reserved for a later task per instructions.

## Pre-flight check

Confirmed Task 1 was already committed on this branch (`477780b test: add rules test harness...`) before starting — `package.json` scripts, `firebase.json`, `vitest.config.js`, and `tests/rules/{helpers.js,projects.test.js}` all pre-existed. `src/lib/server/` and `tests/server/` did not exist yet (both empty after `mkdir`), confirming Task 2 hadn't been started. `firebase-admin@^13.8.0` was already a dependency, so no install step was needed.

## Red step

Command: `npx vitest run tests/server/firebaseAdmin.test.js`

Output (failed exactly as predicted by the plan — module not found):

```
 FAIL  tests/server/firebaseAdmin.test.js [ tests/server/firebaseAdmin.test.js ]
Error: Cannot find module '../../src/lib/server/firebaseAdmin.js' imported from C:/Users/Arthu/QuickTeam/qt/tests/server/firebaseAdmin.test.js

 Test Files  1 failed (1)
      Tests  no tests
```

## Green step

After creating `src/lib/server/firebaseAdmin.js` (verbatim from plan):

Command: `npx vitest run tests/server/firebaseAdmin.test.js`

Output:

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

All 3 tests pass: accepts key from correct project, rejects `quickteam-me` key (error message matches `/quickteam-me.*quickteam-portal-prod/s`), rejects key missing `project_id` (error message matches `/project_id/`).

Also ran `npx eslint src/lib/server/firebaseAdmin.js tests/server/firebaseAdmin.test.js` — no lint errors.

## Commit

- SHA: `dd6c87b`
- Message: `feat: add admin SDK init with project-id guard`
- Files in commit: `src/lib/server/firebaseAdmin.js`, `tests/server/firebaseAdmin.test.js` (exactly the two files specified in the plan's Step 5 — nothing else).

## Concerns

- None regarding the code itself — implemented verbatim as specified, red step reproduced the exact predicted error, green step passed cleanly.
- Pre-existing, unrelated working-tree noise in the `qt` repo (not touched, not committed): `.gitignore` has an uncommitted modification adding `.superpowers/` (predates this task), and an untracked `firestore-debug.log` stray file from a prior emulator run (also predates this task, likely from Task 1's `npm run test:rules`). Neither was created or modified by this task; flagging only so a later "clean working tree" check isn't surprised by them.
- This unit test only exercises `assertServiceAccountProject` in isolation (as the plan specifies — "pure unit tests, no emulator"). `getAdminApp`/`getAdminDb`/`getAdminAuth` are not exercised by any test yet; the plan defers that coverage to Task 3's `joinProject.test.js` which uses its own admin instance against the emulator. Not a defect, just noting the guard function is the only piece under direct test here, matching the plan's stated scope.

---

## Follow-up: security review fixes (fail-open bypasses)

A subsequent security review found the guard above **fails open in exactly the scenario it exists for**. Two Critical findings, fixed on the same branch (`security/phase0-firestore-rules`), plus one Important test-gap finding.

### What was broken

1. **Finding 1 (Critical).** `assertServiceAccountProject` guarded the mismatch check behind `if (expectedProjectId && ...)`. When `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is unset/empty — exactly the case for `clear.js`, which runs under plain `node` and never loads Next.js env vars — the check silently no-opped and a `quickteam-me` key would pass.
2. **Finding 2 (Critical).** `getAdminApp()` did `const existing = getApps(); if (existing.length) return existing[0];` — i.e. it adopted *any* already-initialized Firebase app in the process, bypassing `loadCredential()`/the guard entirely. Confirmed this is not hypothetical: `src/app/api/chat/route.js` calls `initializeApp({ credential: cert(serviceAccountKey.json) })` on the default app with zero validation — if that module runs first in the process, every later `getAdminDb()`/`getAdminAuth()` call would silently inherit its unvalidated app.

### What was changed

`c:\Users\Arthu\QuickTeam\qt\src\lib\server\firebaseAdmin.js`:
- `assertServiceAccountProject(parsed, expectedProjectId)`: now checks `!expectedProjectId` **first** and throws (Ukrainian message referencing `NEXT_PUBLIC_FIREBASE_PROJECT_ID`) before checking `parsed.project_id`, so an empty/undefined expected id is fatal regardless of the credential's contents. The `project_id` present-and-matches checks are otherwise preserved as before (still throw on missing `project_id` in the key, still throw on mismatch).
- `getAdminApp()`: apps are now initialized under an explicit name, `ADMIN_APP_NAME = 'qt-portal'`, and `getApps().find(app => app.name === ADMIN_APP_NAME)` replaces `getApps()[0]` — a foreign app initialized elsewhere in the process (e.g. by `chat/route.js`) can never be adopted. Added a module-level `adminApp` memoization variable so repeated calls don't re-scan/re-initialize once the named app exists. The `!EXPECTED_PROJECT_ID` check now also gates the no-credential ADC/emulator fallback path (previously that branch could run even with an empty expected project id, since it never touched `assertServiceAccountProject` at all).
- No changes to `getAdminDb`, `getAdminAuth`, error message language/style, or the exported `assertServiceAccountProject(parsed, expectedProjectId)` signature — direct-call tests with an explicit second argument still work.

Did **not** touch `serviceAccountKey.json`, `clear.js`, or `src/app/api/chat/route.js`, per instructions — reserved for a later task after deploy.

### Test gap closed (Finding 3)

`c:\Users\Arthu\QuickTeam\qt\tests\server\firebaseAdmin.test.js` — kept the original 3 `assertServiceAccountProject` tests unchanged, added 6 more:
- `assertServiceAccountProject`: "відхиляє порожній expectedProjectId навіть якщо ключ валідний" and "...undefined expectedProjectId..." — call the exported function directly with `''`/`undefined` as the second argument and a *valid-looking* `quickteam-me` key, asserting it still throws (catches Finding 1's exact bypass).
- `getAdminApp` (new `describe` block, using `vi.resetModules()` + `vi.doMock('firebase-admin/app', ...)` + dynamic `import()` per test so each test gets a fresh module instance and env):
  - "НЕ підхоплює вже ініціалізований застосунок з іншим іменем (обхід через getApps()[0])" — mocks `getApps()` to return a foreign `{ name: '[DEFAULT]', ... }` app and asserts `getAdminApp()` returns a *different*, named app, that `initializeApp` was actually called (not skipped), and that a second call is memoized (`initializeApp` still called only once). This is the direct regression test for Finding 2.
  - "кидає помилку, якщо NEXT_PUBLIC_FIREBASE_PROJECT_ID не задано (навіть без FIREBASE_SERVICE_ACCOUNT — ADC-фолбек теж захищено)" — no env at all, asserts throw and that `initializeApp` is never called; this is the `clear.js`-shaped scenario reproduced end-to-end through `getAdminApp()`, not just the isolated guard function.
  - "кидає помилку при невалідному JSON у FIREBASE_SERVICE_ACCOUNT" — malformed JSON in the env var throws with the expected Ukrainian message, `initializeApp` never called.
  - "відхиляє ключ від чужого проєкту навіть коли getApps() спочатку порожній" — end-to-end mismatch check through `getAdminApp()`/`loadCredential()`, not just the unit-level guard.

### Red step (proves the tests catch the bypasses on the CURRENT buggy code)

Command: `npx vitest run tests/server/firebaseAdmin.test.js` (run against the code as described in "What was broken", before any fix)

```
 RUN  v4.1.10 C:/Users/Arthu/QuickTeam/qt

 ❯ tests/server/firebaseAdmin.test.js (9 tests | 4 failed) 36ms
     × відхиляє порожній expectedProjectId навіть якщо ключ валідний 5ms
     × відхиляє undefined expectedProjectId навіть якщо ключ валідний 1ms
     × НЕ підхоплює вже ініціалізований застосунок з іншим іменем (обхід через getApps()[0]) 9ms
     × кидає помилку, якщо NEXT_PUBLIC_FIREBASE_PROJECT_ID не задано (навіть без FIREBASE_SERVICE_ACCOUNT — ADC-фолбек теж захищено) 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  ... > відхиляє порожній expectedProjectId навіть якщо ключ валідний
AssertionError: expected [Function] to throw an error
 FAIL  ... > відхиляє undefined expectedProjectId навіть якщо ключ валідний
AssertionError: expected [Function] to throw an error
 FAIL  ... > НЕ підхоплює вже ініціалізований застосунок з іншим іменем (обхід через getApps()[0])
AssertionError: expected { name: '[DEFAULT]', …(1) } not to be { name: '[DEFAULT]', …(1) } // Object.is equality
 FAIL  ... > кидає помилку, якщо NEXT_PUBLIC_FIREBASE_PROJECT_ID не задано (навіть без FIREBASE_SERVICE_ACCOUNT — ADC-фолбек теж захищено)
AssertionError: expected [Function] to throw an error

 Test Files  1 failed (1)
      Tests  4 failed | 5 passed (9)
```

The 4 failures are precisely the two Finding-1 tests and two of the Finding-2/gating tests — i.e. the new tests genuinely exercise the bypasses rather than passing vacuously. The other 5 (original 3 + the 2 "end-to-end mismatch/malformed-JSON" tests, which didn't depend on the buggy branches) already passed.

### Green step (after applying the fix)

Command: `npx vitest run tests/server/firebaseAdmin.test.js --reporter=verbose`

```
 RUN  v4.1.10 C:/Users/Arthu/QuickTeam/qt

 ✓ tests/server/firebaseAdmin.test.js > assertServiceAccountProject > пропускає ключ від правильного проєкту 2ms
 ✓ tests/server/firebaseAdmin.test.js > assertServiceAccountProject > відхиляє ключ від бази workspace 0ms
 ✓ tests/server/firebaseAdmin.test.js > assertServiceAccountProject > відхиляє ключ без project_id 0ms
 ✓ tests/server/firebaseAdmin.test.js > assertServiceAccountProject > відхиляє порожній expectedProjectId навіть якщо ключ валідний 0ms
 ✓ tests/server/firebaseAdmin.test.js > assertServiceAccountProject > відхиляє undefined expectedProjectId навіть якщо ключ валідний 0ms
 ✓ tests/server/firebaseAdmin.test.js > getAdminApp > НЕ підхоплює вже ініціалізований застосунок з іншим іменем (обхід через getApps()[0]) 7ms
 ✓ tests/server/firebaseAdmin.test.js > getAdminApp > кидає помилку, якщо NEXT_PUBLIC_FIREBASE_PROJECT_ID не задано (навіть без FIREBASE_SERVICE_ACCOUNT — ADC-фолбек теж захищено) 6ms
 ✓ tests/server/firebaseAdmin.test.js > getAdminApp > кидає помилку при невалідному JSON у FIREBASE_SERVICE_ACCOUNT 5ms
 ✓ tests/server/firebaseAdmin.test.js > getAdminApp > відхиляє ключ від чужого проєкту навіть коли getApps() спочатку порожній 5ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

### Files touched

- `c:\Users\Arthu\QuickTeam\qt\src\lib\server\firebaseAdmin.js` (fix)
- `c:\Users\Arthu\QuickTeam\qt\tests\server\firebaseAdmin.test.js` (new tests)

### Commit

- SHA: `bffa1078572b4e93d4820d4d5dbc370030720b59`
- Message: `fix: close fail-open bypasses in Firebase Admin project guard`
- Files in commit: exactly the two files above. Left the pre-existing, unrelated uncommitted `.gitignore` modification (`.superpowers/` entry, predates this task) and untracked `firestore-debug.log` alone, as noted in the original report above.

### Concerns

- `clear.js` and `src/app/api/chat/route.js` still construct their own unvalidated Firebase Admin apps directly (not via `getAdminApp()`) — per instructions this task did not touch them, but they remain live risk until the deferred later task removes/rewires them. The fix here hardens `firebaseAdmin.js` itself and closes the in-process poisoning vector for anything that *does* go through `getAdminApp()`, but does not retroactively protect `clear.js`'s own direct `admin.initializeApp()` call.
- No other callers of `getAdminApp`/`getAdminDb`/`getAdminAuth` exist yet in `src/` (grepped — only `firebaseAdmin.js` itself references these names), so this change has no other call-site impact to verify.
