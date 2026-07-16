# Task 7 report — Заблокувати `tasks` і закрити інвайти

Repo: `c:\Users\Arthu\QuickTeam\qt`, branch `security/phase0-firestore-rules`.

## Final rules (invitations + tasks blocks)

```
    // ─── Invitations ─────────────────────────────────────────
    // Клієнтський read лишається (не тільки getDoc, а й list-запит
    // where(projectId==) + where(role==) + where(active==true) з
    // InviteUserModal.getInviteToken(), щоб не плодити дублікати інвайтів) —
    // /api/join його вже не потребує (Admin SDK), а модалка запрошень так.
    match /invitations/{inviteId} {
      allow read:   if isTeamMember(resource.data.projectId);
      allow create: if isTeamMember(request.resource.data.projectId)
                    && request.resource.data.createdBy == request.auth.uid;
      allow update: if isTeamMember(resource.data.projectId)
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['active']);
    }

    // ─── Workspace Tasks ──────────────────────────────────────
    // Колекція іншого застосунку — QuickTeam Workspace (внутрішній
    // таск-менеджер, окрема Firebase-база quickteam-me). Портал до неї
    // не звертається й не повинен: попередній allow read: if request.auth
    // != null давав будь-якому залогіненому клієнту порталу читати задачі
    // ВСІХ організацій workspace. Тепер — глухо закрито для всіх.
    match /tasks/{taskId} {
      allow read, write: if false;

      match /taskComments/{commentId} {
        allow read, write: if false;
      }
    }
```

(`projectTeam`, `isTeamMember`, `stageProjectId` are the existing Task 5/6 helpers — reused, not duplicated. `projects`/`stages`/`materials` blocks untouched.)

Added one extra assertion beyond the plan's literal `invitations` create rule text: `createdBy == request.auth.uid`, matching the plan's own proposed rule (Step 3) which already included this clause — a test (`член команди НЕ може створити інвайт від чужого імені`) covers it.

## Red output (before rule change, `npm run test:rules`)

```
 ❯ tests/rules/invitations.test.js (10 tests | 5 failed) 784ms
     × чужий юзер НЕ читає інвайт
     × чужий юзер НЕ створює інвайт у чужий проєкт
     × член команди НЕ може створити інвайт від чужого імені (createdBy != uid)
     × чужий юзер НЕ деактивує інвайт
     × чужий юзер НЕ отримує жодного інвайту тим самим запитом
 ❯ tests/rules/tasks.test.js (3 tests | 3 failed) 351ms
     × чужий юзер НЕ читає задачі
     × власник проєкту теж НЕ читає задачі
     × ніхто не пише задачі

 Test Files  2 failed | 2 passed (4)
      Tests  8 failed | 45 passed (53)
```

All 8 failures are `assertFails` expectations that "succeeded" instead — i.e. the holes are real: any authenticated user could read `tasks`, read any invitation, create an invitation for someone else's project, forge `createdBy`, and deactivate someone else's invitation. The 45 passing tests were the pre-existing `projects`/`stages` suites plus the `assertSucceeds` cases in the new files (legitimate team-member paths already worked because the old rules were permissive, not because anything was implemented yet).

## Green output (after rule change)

`npm run test:rules`:
```
 Test Files  4 passed (4)
      Tests  53 passed (53)
```

`npm run test:server`:
```
 Test Files  2 passed (2)
      Tests  24 passed (24)
```

Full suite green: 53 rules tests (projects, stages, tasks, invitations) + 24 server tests (firebaseAdmin, joinProject). No Task 5/6 rule was weakened — `projects`, `stages`, `materials` blocks are byte-for-byte unchanged in this diff.

## Step 5 — grep for `tasks` in client code

```
grep -rn "collection(db, 'tasks')\|'tasks'" src/ --include=*.js --include=*.jsx | grep -v node_modules
→ (empty)

grep -rniE "\btasks\b" src/ --include=*.js --include=*.jsx | grep -v node_modules
→ (empty)
```

Nothing in `src/` references a `tasks` collection at all, client or otherwise. This repo (`qt`, QuickTeam+ portal) is a different app from QuickTeam Workspace (`qt-workspace`) — it never had a legitimate reason to touch `tasks`; the open rule was pure leftover/copy-paste exposure.

Separately verified `src/app/api/chat/route.js` (flagged in the task brief as a possible false alarm): it only initializes `firebase-admin` (`initializeApp`/`getFirestore` from `firebase-admin/app` and `firebase-admin/firestore`) and never queries a `tasks` collection — Admin SDK, bypasses rules, and doesn't touch `tasks` regardless. Confirmed by reading the file (lines 1–40); its `getDb()` loads `serviceAccountKey.json` via `eval('require')` with a project-id-only fallback, which Task 8 (out of scope here) is slated to replace with `getAdminDb()`.

Conclusion: `allow read, write: if false` on `tasks` cannot break anything in this portal.

## Real invitations list-query — does it pass?

Yes. Added `describe('invitations: LIST-запит із InviteUserModal (projectId + role + active)')` in `tests/rules/invitations.test.js` reproducing the exact query shape from `src/components/Modals/FunctionalModals.jsx` (`InviteUserModal.getInviteToken()`, ~lines 118–124):

```js
query(
  collection(db, 'invitations'),
  where('projectId', '==', PROJECT_ID),
  where('role', '==', 'viewer'),
  where('active', '==', true)
)
```

- Team owner (ALICE) running this query: `assertSucceeds`, result includes `inv1`.
- Plain team member, non-owner (CAROL, viewer role): `assertSucceeds`, result includes `inv1` — confirms the rule isn't accidentally owner-only.
- Non-member (BOB): `assertFails` on the whole query (Firestore evaluates the read rule per returned document; since `resource.data.projectId` on the only matching doc resolves to a project BOB isn't on, the query is rejected).

This confirms the fix doesn't repeat the Task 5 mistake of testing an isolated `getDoc` while the real list-query path silently breaks.

## Commit

`ef145fb` — "fix(security): block workspace tasks from portal, scope invitations to team"
Files: `firestore.rules` (modified), `tests/rules/tasks.test.js` (new), `tests/rules/invitations.test.js` (new).
`.gitignore` (pre-existing uncommitted change adding `.superpowers/`, present before this task started) and `firestore-debug.log` (emulator log, untracked) were deliberately left out of the commit — unrelated to this task.

`npm run lint` was run; it reports 49 pre-existing errors/25 warnings in unrelated files (React Compiler memoization/immutability issues in components untouched by this task, e.g. a `currentUser.status = text` mutation and a `useMemo` dependency mismatch elsewhere). None are in `firestore.rules` or the new test files, and none were introduced by this change.

## Concerns

- None blocking. The `invitations` fix intentionally goes one clause further than the plan's literal Step 3 snippet by enforcing `createdBy == request.auth.uid` on create — this matches the plan's own text (which includes exactly that clause) and closes an impersonation gap the bare `isTeamMember` check alone would leave open; flagging in case reviewers expect a strict diff against the plan's snippet only.
- Per Global Constraints and the task brief, rules were **not** deployed (`firebase deploy` was never run). Everything above ran only against the local Firebase emulator (`quickteam-portal-test` project id, per `tests/rules/helpers.js` / `firebase.json`).

---

# Addendum — invitation ROLE privilege escalation (Critical finding, follow-up)

Same repo/branch. The `invitations` create rule above (committed as `ef145fb`) checked `isTeamMember` + `createdBy == uid` but never constrained `role`. Any team member — including a viewer, who can't even open the invite UI (`src/components/Header.jsx:162` `canInvite = isOwner || isManager`) — could `addDoc()` an invitation with `role:'manager'` directly via the client SDK and hand it to anyone, who'd redeem it via `joinProject.js` (which legitimately allows `'manager'` as an invite role) and become a manager (`canEdit`).

## New rule

```
    function projectRole(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId)).data;
      return project.get('teamRoles', {})
               .get(request.auth.uid, project.get('ownerId', '') == request.auth.uid ? 'owner' : '');
    }
    ...
    match /invitations/{inviteId} {
      allow read:   if isTeamMember(resource.data.projectId);
      allow create: if isTeamMember(request.resource.data.projectId)
                    && request.resource.data.createdBy == request.auth.uid
                    && projectRole(request.resource.data.projectId) in ['owner', 'manager']
                    && request.resource.data.role in ['viewer', 'manager'];
      allow update: if isTeamMember(resource.data.projectId)
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['active']);
    }
```

`projectRole()` reuses the existing `get()`-dedup guarantee (same doc path already fetched by `isTeamMember`/`projectTeam` within the request) and mirrors the client's own precedence in `Header.jsx:154`: `project.teamRoles?.[uid] || (uid === project.ownerId ? 'owner' : 'viewer')` — teamRoles entry wins if present, ownerId is the fallback for legacy docs.

## Red output (new escalation tests against the OLD rule, `npm run test:rules`)

```
 ❯ tests/rules/invitations.test.js (20 tests | 5 failed) 3287ms
     × viewer (Carol) НЕ створює інвайт взагалі (навіть на роль viewer)
     × viewer (Carol) НЕ створює інвайт із роллю manager — ключова ескалація
     × НІХТО не створює інвайт із роллю owner — навіть сам власник
     × НІХТО не створює інвайт із роллю owner (manager теж не може)
     × звичайний член команди (не власник) НЕ створює інвайт

 Test Files  1 failed | 3 passed (4)
      Tests  5 failed | 58 passed (63)
```

All 5 are `assertFails` expectations that "succeeded" — the key one being **"viewer (Carol) НЕ створює інвайт із роллю manager — ключова ескалація"**: Carol, a viewer, successfully created a `role:'manager'` invitation against the pre-fix rule. That's the proof the vulnerability is real. The other 58 tests (existing suites + fixture-affected re-runs) already passed unchanged, confirming the new `DAVE` (manager) persona and `PROJECT_ID_OWNER_LEGACY` fixture didn't disturb prior behavior.

## Green output (after the fix)

`npm run test:rules`:
```
 Test Files  4 passed (4)
      Tests  63 passed (63)
```

`npm run test:server`:
```
 Test Files  2 passed (2)
      Tests  24 passed (24)
```

Combined `npm run test`: 6 files, 87 tests, all passed. `git diff firestore.rules` confirms only the new `projectRole()` helper and the `invitations` `create` rule changed — `projects`, `stages`, `materials`, `tasks` blocks are byte-for-byte unchanged.

## Fixtures added (`tests/rules/helpers.js`)

- `DAVE` persona added to `PROJECT_ID`'s `team`/`teamRoles` as `'manager'`.
- `PROJECT_ID_OWNER_LEGACY` ('p-owner-legacy'): has `ownerId: ALICE` but the `teamRoles` field is **entirely absent** from the document (distinct from `PROJECT_ID_LEGACY`, which has no `ownerId` but does have `teamRoles` — left untouched, other tests depend on it).

## What I learned about safe nested map access in rules

- `resource.data.get('teamRoles', {})` returns a `MapValue`, and calling `.get(uid, default)` on *that* returned map works exactly like the top-level safe accessor — confirmed empirically against the emulator, not assumed. Neither a fully-absent `teamRoles` field nor a present-but-keyless map throws; both fall through to the default cleanly. This makes `project.get('teamRoles', {}).get(uid, fallback)` a safe one-liner for "role lookup with a computed fallback," avoiding a separate `'teamRoles' in project` existence check.
- The fallback default itself can be an inline ternary expression (`project.get('ownerId', '') == request.auth.uid ? 'owner' : ''`) — CEL evaluates it lazily only when the key is actually missing, so it's not a wasted read/eval when `teamRoles` already has the entry.
- Precedence decision: `teamRoles` entry wins over `ownerId` when both exist and disagree (matches the client's own `Header.jsx:154` precedence), with `ownerId` only as the fallback for legacy docs. This was verified directly by the `PROJECT_ID_OWNER_LEGACY` test pair (owner-by-`ownerId` can invite; plain team member without a `teamRoles` entry cannot).

## Commit

`6fc2555` — "fix(security): restrict invitation role escalation via teamRoles-derived permission"
Files: `firestore.rules`, `tests/rules/helpers.js`, `tests/rules/invitations.test.js` (all modified, not new — built on top of `ef145fb`'s `invitations.test.js`).

## Concerns

- None blocking. Rules were not deployed (emulator only, `quickteam-portal-test`). No existing rule was weakened — the diff is additive (one new helper function, three new `&&` clauses on `invitations` `create`).
