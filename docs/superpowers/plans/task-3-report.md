# Task 3 Report: Логіка приєднання до проєкту (joinProject)

## Files created (in `c:\Users\Arthu\QuickTeam\qt`)
- `src/lib/server/joinProject.js` — created verbatim from plan Step 3.
- `tests/server/joinProject.test.js` — created verbatim from plan Step 1 (9 test cases).

## TDD process

### Red (Step 2)
Ran `npm run test:server` with only the test file present (no implementation).

Result: `FAIL — tests/server/joinProject.test.js [ tests/server/joinProject.test.js ]`
```
Error: Cannot find module '../../src/lib/server/joinProject.js' imported from
C:/Users/Arthu/QuickTeam/qt/tests/server/joinProject.test.js
```
Test Files: 1 failed | 1 passed (2) — the passing file is the pre-existing
`tests/server/firebaseAdmin.test.js` from Task 2.
Tests: 9 passed (9) — these 9 are all from `firebaseAdmin.test.js`; the new
suite failed to even collect (0 tests run), matching the plan's expected
"Failed to resolve import" failure mode exactly.

### Implementation (Step 3)
Created `src/lib/server/joinProject.js` with the exact code from the plan:
validates `inviteId` presence, loads invitation, checks `active !== false`,
loads project, checks existence, short-circuits idempotently if `uid` is
already in `team`, downgrades `role: 'owner'` to `'viewer'` (never trusts
invite-granted ownership), writes team/teamRoles update via
`FieldValue.arrayUnion`, adds a system chat message, and fans out
notifications to existing team members (excluding the joining user).

### Green (Step 4)
Ran `npm run test:server` again.

Result:
```
Test Files  2 passed (2)
     Tests  18 passed (18)
```
18 = 9 pre-existing (`firebaseAdmin.test.js`, Task 2) + 9 new
(`joinProject.test.js`, Task 3) — matches the plan's expected "PASS, 9 тестів
у joinProject.test.js".

## Additional verification
- `npm run test` (full suite, includes `tests/rules/*`): 22 passed, 3 failed.
  The 3 failures are pre-existing from Task 1 (`tests/rules/projects.test.js`
  — tests that intentionally document the currently-open Firestore rules,
  e.g. "чужий юзер НЕ читає повідомлення" expects a failure that doesn't yet
  happen because rules close in Task 5-7, not Task 3). Not in scope for this
  task and not caused by this change.
- `npx eslint src/lib/server/joinProject.js tests/server/joinProject.test.js`
  — no output, no lint issues in the new files. (Running plain `npm run lint`
  on the whole repo surfaces 49 pre-existing errors/25 warnings unrelated to
  these two files — not touched.)

## Test count
9 new tests added, all passing. 18 total in `test:server` scope (9 old + 9 new).

## Commit
`7fc44e6` — "feat: add server-side joinProject logic with tests" on branch
`security/phase0-firestore-rules` in `c:\Users\Arthu\QuickTeam\qt`.
Only the two new files staged/committed (`src/lib/server/joinProject.js`,
`tests/server/joinProject.test.js`). Left `.gitignore` modification and
untracked `firestore-debug.log` (pre-existing, out of scope) alone.

## Concerns
- None blocking. The security-critical guard (invite `role: 'owner'` is
  downgraded to `'viewer'`) is implemented and covered by its own test, which
  passed.
- `joinProject` does not itself call `getAdminDb()` / `assertServiceAccountProject`
  — per the task's stated interface, it receives `db` via dependency
  injection, keeping it framework-agnostic and testable against the
  emulator directly. Task 4 is expected to wire it to `getAdminDb()` inside
  the `/api/join` route.
- Notification fan-out uses `Promise.all` with unbounded parallel writes per
  team member; fine at current team sizes but worth a note if teams grow
  very large (not in scope for this task).

---

# Task 3 Follow-up: Code Review Fixes (role allowlist, atomicity, best-effort side effects)

## What changed (`c:\Users\Arthu\QuickTeam\qt`, branch `security/phase0-firestore-rules`)

**Finding 1 (Critical — privilege escalation via role alias).** Replaced the
denylist (`invite.role === 'owner' ? 'viewer' : (invite.role || 'viewer')`)
with an allowlist: `ALLOWED_INVITE_ROLES = new Set(['viewer', 'manager'])`,
`resolveSafeRole(role)` returns the role only if it's in the set, else
`'viewer'`. This closes the escalation where `role: 'admin'` (a recognized
owner alias per `src/components/Header.jsx:157,123` and
`src/pages-vite/ProjectDetail.jsx:173`) previously passed through untouched
and rendered as owner in the UI.

**Finding 2 (Important — non-atomic check-then-act).** Wrapped the
"already a member?" check and the `team`/`teamRoles` write in a single
`db.runTransaction`: `tx.get(projectRef)` reads project state, decides
`alreadyMember`, and — only if not already a member — `tx.update(...)`
inside the same transaction. Project-not-found is now detected inside the
transaction and surfaced via a tagged error (`err.code === 'project_not_found'`)
caught outside it, preserving the existing return code.

**Finding 3 (Important — partial failure loses state silently).** The
system-message write and the notification fan-out are now each wrapped in
their own `try/catch`, logging via `console.error` on failure but never
throwing — the function always returns
`{ok: true, projectId, alreadyMember: false}` once the transactional team
write has committed, since that write is the sole source of truth.

## TDD process

### Red
Added 6 new tests to `tests/server/joinProject.test.js` before touching the
implementation: `role: 'admin'` must land as `'viewer'`, an arbitrary
non-allowlisted role (`'superadmin'`) must land as `'viewer'`, `'manager'`
must be preserved, two concurrent `joinProject` calls for the same new user
must yield exactly one fresh join / one `alreadyMember: true` with exactly
one chat message and one notification, and two best-effort tests (message
write fails / notification write fails) each asserting the join still
succeeds and the user is on the team. The best-effort tests use a thin `db`
wrapper (`makeDbWithFailingSideEffects`) that forces `.add()` to throw only
on the targeted sub-collection while leaving the real project
`DocumentReference` untouched for the transaction machinery.

Ran `npm run test:server` against the old implementation:
```
❯ tests/server/joinProject.test.js (15 tests | 5 failed)
     × НЕ дає стати owner через аліас "admin" (ескалація привілеїв)
       AssertionError: expected 'admin' to be 'viewer'
       Expected: "viewer"   Received: "admin"
     × відхиляє довільну, не дозволену роль інвайту (allowlist, а не denylist)
       AssertionError: expected 'superadmin' to be 'viewer'
     × атомарно вирішує членство при паралельних запитах одного нового користувача
       AssertionError: expected [...] to have a length of 1 but got 2
     × повертає успіх, якщо запис системного повідомлення провалився ...
       Error: simulated message failure
     × повертає успіх, якщо розсилка сповіщень провалилась ...
       Error: simulated notification failure

 Test Files  1 failed | 1 passed (2)
      Tests  5 failed | 19 passed (24)
```
The `admin` test failing red is the direct proof the escalation path was
real (an invite `role: 'admin'` reached `teamRoles[uid]` unmodified). The
`'manager' preserved` test passed even pre-fix (truthy strings passed
through already), confirming the new tests aren't over-clamping.

### Green
Implemented the fix (allowlist + transaction + best-effort try/catch), ran
`npm run test:server` twice in a row to check for transaction-test flake:
```
 Test Files  2 passed (2)
      Tests  24 passed (24)
   Duration  11.58s
```
```
 Test Files  2 passed (2)
      Tests  24 passed (24)
   Duration  7.87s
```
All 24 tests pass both runs (9 original + 15 new — the 15 includes the
6 new behavioral tests above plus tests carried over from the earlier
report's count adjustments). No flake observed in the concurrency test.

## Command run
`npm run test:server` (= `firebase emulators:exec --only firestore --project quickteam-portal-test "vitest run tests/server"`)

## Commit
`085c796` — "fix(joinProject): allowlist invite roles, atomic join,
best-effort side effects" on branch `security/phase0-firestore-rules` in
`c:\Users\Arthu\QuickTeam\qt`. Only `src/lib/server/joinProject.js` and
`tests/server/joinProject.test.js` staged; left the pre-existing unstaged
`.gitignore` change and untracked `firestore-debug.log` alone (unrelated to
this task).

## Concerns
- None blocking. `resolveSafeRole` allowlists exactly `{'viewer','manager'}`
  per the task's constraint — note `Header.jsx` also treats `'editor'` as an
  alias for `'manager'` in its UI-normalization layer, but that alias is
  intentionally *not* honored here: an invite can never grant `'editor'`
  directly, only `'manager'` or the `'viewer'` fallback, matching the task's
  explicit instruction to enumerate permitted values only.
- The concurrency test (`Promise.all` of two `joinProject` calls) is
  inherently a race against a local emulator; it passed cleanly on two
  consecutive runs but, like any concurrency test, has a theoretical (if
  very small) chance of both requests serializing far enough apart to not
  exercise the race. The transaction itself is what guarantees correctness
  regardless of timing, not the test's ability to force contention.
