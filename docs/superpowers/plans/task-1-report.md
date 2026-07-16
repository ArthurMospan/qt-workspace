# Task 1 Report — Тестова інфраструктура + тести, що фіксують дірки

Repo: `c:\Users\Arthu\QuickTeam\qt`
Branch: `security/phase0-firestore-rules`
Commit: `477780b0abd1cb2a9a0ff0a8906bbb483170aa4a`

## Files created / modified

- **Modified** `package.json` — added `test`, `test:rules`, `test:server` scripts (via `firebase emulators:exec --only firestore --project quickteam-portal-test "vitest run ..."`). Also picked up devDependency entries from `npm install`.
- **Modified** `package-lock.json` — lockfile update from the install below.
- **Modified** `firebase.json` — added `emulators.firestore.port: 8080`, `emulators.ui.enabled: false`, `emulators.singleProjectMode: true` (rules path unchanged).
- **Created** `vitest.config.js` — node environment, `tests/**/*.test.js` include, `fileParallelism: false`.
- **Created** `tests/rules/helpers.js` — `getTestEnv()`, `cleanup()`, `seedFixtures()`, constants `ALICE`, `BOB`, `PROJECT_ID`, `STAGE_ID`. Written verbatim from the plan.
- **Created** `tests/rules/projects.test.js` — tests for `projects` read/update and `projects/messages` read, for Alice (team member) vs Bob (outsider) vs unauthenticated. Written verbatim from the plan.

Not touched: `.gitignore` (had a pre-existing unstaged local change adding `.superpowers/`, unrelated to this task — left alone and NOT included in the commit), `firestore-debug.log` (emulator artifact, left untracked, not committed).

## Dependencies installed

```
npm install --save-dev vitest@4.1.10 @firebase/rules-unit-testing@5.0.1 firebase-tools@15.23.0
```
Result: added 520 packages, changed 10. Some npm deprecation warnings (json-ptr, glob) and 23 audit findings (2 low / 16 moderate / 5 high) — pre-existing transitive noise from firebase-tools, not addressed here (out of scope for Task 1).

Java 21 (OpenJDK, Microsoft build) was already present, so the Firestore emulator started without extra setup.

## Exact `npm run test:rules` output

```
> qt-me-next@0.1.0 test:rules
> firebase emulators:exec --only firestore --project quickteam-portal-test "vitest run tests/rules"

i  emulators: Starting emulators: firestore
i  firestore: Firestore Emulator logging to firestore-debug.log
+  firestore: Firestore Emulator was started in standard edition.
+  firestore: Firestore Emulator UI websocket is running on 9150.
i  Running script: vitest run tests/rules

 RUN  v4.1.10 C:/Users/Arthu/QuickTeam/qt

 ❯ tests/rules/projects.test.js (7 tests | 3 failed) 2246ms
     × чужий залогінений юзер НЕ читає проєкт 114ms
     × чужий юзер НЕ може дописати себе в team 142ms
     × чужий юзер НЕ читає повідомлення 52ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/rules/projects.test.js > projects: читання > чужий залогінений юзер НЕ читає проєкт
Error: Expected request to fail, but it succeeded.
 ❯ node_modules/@firebase/rules-unit-testing/src/util.ts:137:8
 ❯ tests/rules/projects.test.js:22:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  tests/rules/projects.test.js > projects: self-add у команду > чужий юзер НЕ може дописати себе в team
Error: Expected request to fail, but it succeeded.
 ❯ node_modules/@firebase/rules-unit-testing/src/util.ts:137:8
 ❯ tests/rules/projects.test.js:35:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  tests/rules/projects.test.js > projects/messages > чужий юзер НЕ читає повідомлення
Error: Expected request to fail, but it succeeded.
 ❯ node_modules/@firebase/rules-unit-testing/src/util.ts:137:8
 ❯ tests/rules/projects.test.js:56:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
   Start at  14:13:58
   Duration  3.01s (transform 28ms, setup 0ms, import 349ms, tests 2.25s, environment 0ms)

!  Script exited unsuccessfully (code 1)
i  emulators: Shutting down emulators.
i  firestore: Stopping Firestore Emulator
! Firestore Emulator has exited upon receiving signal: SIGINT
i  hub: Stopping emulator hub
i  logging: Stopping Logging Emulator

Error: Script "vitest run tests/rules" exited with code 1
```

## Which tests passed vs failed, and why

7 tests total in `tests/rules/projects.test.js`:

| Test | Result | Why |
|---|---|---|
| `projects: читання > член команди читає проєкт` (Alice) | PASS | Alice is in `team`, current wide-open rules allow it regardless. |
| `projects: читання > чужий залогінений юзер НЕ читає проєкт` (Bob, `assertFails`) | **FAIL** | Current rule is `allow read: if request.auth != null` — any authenticated user can read any project. Bob's read *succeeds*, so `assertFails` throws "Expected request to fail, but it succeeded." This is the documented hole. |
| `projects: читання > незалогінений НЕ читає проєкт` | PASS | Rule does require `request.auth != null`, so an unauthenticated read is correctly denied already. |
| `projects: self-add у команду > чужий юзер НЕ може дописати себе в team` (Bob, `assertFails`) | **FAIL** | Current update rule allows `request.auth.uid in request.resource.data.team` — i.e., anyone can add themselves. Bob's `arrayUnion` self-add succeeds, so the assertion fails. Second documented hole. |
| `projects: self-add у команду > член команди може оновити проєкт` (Alice) | PASS | Alice is already team member; update allowed under current and future rules. |
| `projects/messages > член команди читає повідомлення` (Alice) | PASS | Current `allow read: if request.auth != null` on messages permits it. |
| `projects/messages > чужий юзер НЕ читає повідомлення` (Bob, `assertFails`) | **FAIL** | Same open-read hole extended to the `messages` subcollection — Bob can read any project's chat. Third documented hole. |

Result: **3 failed, 4 passed** — exactly the expected RED state from the plan (Task 1 Step 7). No `firestore.rules` changes were made; the holes remain open on purpose, to be closed in Task 5.

## Concerns

- None blocking. Minor notes:
  - `npm audit` reports 23 vulnerabilities (mostly moderate, some high) pulled in transitively by `firebase-tools`/`vitest` devDependencies. Not remediated — out of scope for Task 1, and these are dev-only dependencies not shipped to production.
  - `firestore-debug.log` is generated by the emulator run and left untracked/uncommitted (not in `.gitignore` yet); harmless, but a future task could add it to `.gitignore` for cleanliness.
  - A pre-existing unstaged change to `.gitignore` (adding `.superpowers/`) was present in the working tree before this task started; it was deliberately left alone and excluded from this commit since it's unrelated to Task 1.
  - Per plan instructions, only the `### Task 1` section was implemented — no `firestore.rules` changes, no Task 2+ files.
