# Final review fixes — report

Repo: `c:\Users\Arthu\QuickTeam\qt`, branch `security/phase0-firestore-rules`.
Commits (in order): `14de1f0`, `97367e1`, `fa32b64`.
Final suites: `npm run test:rules` → 68/68 passed. `npm run test:server` → 26/26 passed.

---

## Finding 1 — owner could self-remove and brick the project

**Root cause (deeper than stated):** it's not just `isSelfRemoval()`. The
`update` rule's first OR-branch ("owner can do anything":
`request.auth.uid == resource.data.get('ownerId','')`) already grants the
owner unrestricted writes, so it grants the self-removal *before*
`isSelfRemoval()` is ever evaluated. Narrowing `isSelfRemoval()` alone
would not have fixed it.

**Test (red):** `tests/rules/projects.test.js` — `власник НЕ може вийти з
проєкту сам`, using ALICE (real owner via `ownerId`) attempting
`team: arrayRemove(ALICE)`. Red output:
```
Error: Expected request to fail, but it succeeded.
```
Confirmed for the stated reason (owner branch bypasses `isSelfRemoval()`).

**Fix:** added `isOwnerLeaving()` to `firestore.rules`, gated as
`!isOwnerLeaving()` ahead of all three OR-branches in the `update` rule
(not inside `isSelfRemoval()`), so it can't be bypassed by the "owner does
anything" branch. `allow delete` (project deletion, the sanctioned exit)
is untouched. Removing *other* members and role changes still work — see
`власник і далі може видалити ІНШОГО учасника з проєкту` (new, green).

**UI:** `src/components/Modals/FunctionalModals.jsx`
(`TeamMemberEditModal`) — added `isRealOwner` (based on `project.ownerId`,
not the `'owner'` role label, which can diverge if roles are reassigned).
The "Leave project" button is now hidden for the real owner and replaced
with an explanatory block pointing at project deletion; `handleLeaveProject`
also short-circuits on `isRealOwner` as a second guard. Also added a
defensive early-throw in `ProjectDetail.jsx`'s `removeMember()` — without
it, an owner-leave attempt would write the system chat message and
notifications *before* failing on the final rules-blocked team update,
leaving a phantom "left the project" message.

**Green:** rules suite 68/68 (see full run below).

---

## Finding 2 — `create` didn't constrain `team[]` (phishing vector)

**Test (red):** `НЕ створює проєкт одразу з чужим учасником у team
(фішинг-вектор)` — BOB creates with `team: [BOB, ALICE]`. Red output:
```
Error: Expected request to fail, but it succeeded.
```

**Fix:** `create` now requires `team == [request.auth.uid]` and a
single-entry `teamRoles` of `{ uid: 'owner' }` — exactly the shape
`useProjects.js addProject()` writes. Real joins go through `/api/join`
(Admin SDK), unaffected. Verified with `форма запису addProject() (team з
одного автора) і далі працює` (green) and the pre-existing `легітимне
створення проєкту працює` test (still green).

**Green:** rules suite 68/68.

---

## Finding 3 — Admin SDK could silently run without a credential

**Test (red):** `tests/server/firebaseAdmin.test.js` — new test deletes
both `FIREBASE_SERVICE_ACCOUNT` and `FIRESTORE_EMULATOR_HOST`. Red output:
```
AssertionError: expected [Function] to throw an error
- Expected: null
+ Received: undefined
```

**Fix:** `src/lib/server/firebaseAdmin.js` `getAdminApp()` now throws
(Ukrainian message naming `FIREBASE_SERVICE_ACCOUNT`, matching the file's
existing error style) if `loadCredential()` returns null and
`process.env.FIRESTORE_EMULATOR_HOST` is unset. Emulator/local-dev path
(no credential + `FIRESTORE_EMULATOR_HOST` set) confirmed still works —
new test `НЕ кидає помилку... коли задано FIRESTORE_EMULATOR_HOST`.

**Green:** server suite 26/26 (was 24, +2 new tests).

---

## Finding 4 — leave-sequence test didn't replay the real write sequence

**Investigation finding, no red possible from the rules content itself:**
the `notifications` collection's `create` rule is (and remains)
`allow create: if request.auth != null;` — unconditional on team
membership. So simply *adding* the missing `notifications` write to the
sequence test passes immediately; there's no rule bug to turn red/green on.

To confirm the added coverage is actually meaningful (not decorative), I
ran a throwaway experiment: temporarily made the `notifications` create
rule require team membership (`request.auth.uid in
get(.../projects/$(projectId)).data.team`), then temporarily reordered the
test to do self-removal *before* the notifications write (replaying the
exact "ordering regression" class this whole describe block exists to
prevent — the one already shipped once on this branch). That reordered
version failed with `PERMISSION_DENIED` at the `create`, proving the new
assertion actually exercises the rule and would have caught this class of
bug. Both the rule and the test were then restored to the real fix/state
(not committed) — confirmed via `git diff` that the working tree matches
the intended final version before committing.

**Fix:** rewrote the test in `projects.test.js` to include the
`notifications` write (`notifyTeam`/`pushNotification` payload shape from
`src/lib/services/notificationService.js`: `userId, type, text, projectId,
projectName, stageId: null, actorName, read: false, createdAt`), in the
real order (system message → lastActivity update → notifications ×2 →
final team-removal), with CAROL (non-owner) as the leaver per Finding 1.

**Green:** rules suite 68/68.

---

## Concerns found while reading, not acted on (out of scope / flagging only)

- `notifications` collection `create` rule remains fully open
  (`if request.auth != null`) — anyone authenticated can create a
  notification doc for any `userId`, including non-team-members. Not part
  of the four findings and explicitly told not to weaken/add restrictions
  beyond what was asked; flagging for a future pass.
- `handleSaveRole` in `FunctionalModals.jsx` still uses the role-label-based
  `ownerCount <= 1` check to block an owner demoting themselves. That's a
  different action (not "leave") and out of scope here, but it has the
  same "role label vs. real `ownerId`" fragility as the bug in Finding 1 —
  if the owner's `teamRoles` entry is ever not `'owner'`, that guard
  wouldn't catch a self-demotion of the true owner either. Not touched
  since it's not one of the four findings and rules already prevent
  `ownerId` reassignment separately.
