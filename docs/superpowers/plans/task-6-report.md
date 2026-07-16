# Task 6 Report: Закрити правила стейджів і матеріалів

**Repo:** `c:\Users\Arthu\QuickTeam\qt`
**Branch:** `security/phase0-firestore-rules`
**Commit:** `42a6e16` — "fix(security): restrict stages and materials to project team"

## Final rules (relevant excerpt from `firestore.rules`)

```js
function isTeamMember(projectId) {
  return request.auth != null && request.auth.uid in projectTeam(projectId);
}
function stageProjectId(stageId) {
  return get(/databases/$(database)/documents/stages/$(stageId)).data.projectId;
}
...
// ─── Stages ──────────────────────────────────────────────
// Стейджі — плаский top-level колекшн із полем projectId; членство
// визначається через проєкт-батько, звідси й isTeamMember(...).
match /stages/{stageId} {
  allow read:   if isTeamMember(resource.data.projectId);
  allow create: if isTeamMember(request.resource.data.projectId);
  allow update: if isTeamMember(resource.data.projectId);
  allow delete: if isTeamMember(resource.data.projectId);

  // ─── Materials (subcollection) ─────────────────────────
  // Кожна перевірка = 2 get(): stages/{stageId} → projectId → projects/{projectId}.
  // Це НЕ «10 get() на документ» — на запит/мультидок-запит (onSnapshot
  // над колекцією, як у useMaterials.js) діє бюджет 20 get() СУМАРНО,
  // а не по 10 на кожен повернутий документ. Безпечно це робить те, що
  // Firestore дедуплікує/кешує get() за ОДНАКОВИМ шляхом документа в
  // межах одного запиту: незалежно від кількості матеріалів у стейджі
  // get(stages/{stageId}) і get(projects/{projectId}) виконуються по
  // одному разу на весь запит, а не по разу на документ. Емпірично
  // перевірено на N=30 матеріалів в одному стейджі (getDocs-запит і
  // writeBatch на 30 документів) — tests/rules/stages.test.js,
  // describe «бюджет get() правил при реалістичній кількості документів».
  match /materials/{materialId} {
    allow read, write: if isTeamMember(stageProjectId(stageId));
  }

  // ─── Messages / Chat (subcollection) ───────────────────
  match /messages/{messageId} {
    allow read:   if isTeamMember(stageProjectId(stageId));
    allow create: if isTeamMember(stageProjectId(stageId))
                  && request.resource.data.senderId == request.auth.uid;
    allow update: if isTeamMember(stageProjectId(stageId));
    allow delete: if false; // Messages are immutable
  }
}
```

No changes were made to the `projects`, `invitations`, or `tasks` blocks (Task 5's rules and field restrictions — `touchesMembership()`, `isSelfRemoval()`, the `.get('ownerId','')` legacy-doc guard — are untouched, reused as-is via `isTeamMember`/`projectTeam`).

## Red output (proving the hole, before rules changes)

`tests/rules/stages.test.js` written first per plan Step 1, run against the still-open rules:

```
❯ tests/rules/stages.test.js (6 tests | 3 failed)
  × чужий юзер НЕ читає стейдж
  × чужий юзер НЕ змінює стейдж
  × чужий юзер НЕ читає матеріал

FAIL tests/rules/stages.test.js > stages > чужий юзер НЕ читає стейдж
Error: Expected request to fail, but it succeeded.
FAIL tests/rules/stages.test.js > stages > чужий юзер НЕ змінює стейдж
Error: Expected request to fail, but it succeeded.
FAIL tests/rules/stages.test.js > stages/materials > чужий юзер НЕ читає матеріал
Error: Expected request to fail, but it succeeded.

Test Files  1 failed | 1 passed (2)
Tests  3 failed | 30 passed (33)
```

This confirms Bob (authenticated, not on the team) could read/write any stage and any material before this change.

## Green output — `npm run test:rules`

After adding `stageProjectId()` and rewriting the `stages` block:

```
Test Files  2 passed (2)
Tests  37 passed (37)
```

(33 → 37: the original 6 required tests from the plan, plus 4 additional tests I added — see "Real app flows" below.)

## Green output — `npm run test:server`

```
Test Files  2 passed (2)
Tests  24 passed (24)
```

Unaffected — `joinProject`/`firebaseAdmin` tests don't touch stages/materials.

## Full suite — `npm test`

```
Test Files  4 passed (4)
Tests  61 passed (61)
```

## Real app flows verified (not assumed)

Per the warning about Task 5's mistake, I grepped `useStages.js`, `useMaterials.js`, `useProjects.js`, and `MaterialsGrid.jsx`/`FunctionalModals.jsx` for actual write sequences, then wrote rules tests that reproduce them (not isolated single-document writes):

1. **Stage creation ordering** (`useProjects.js: addProject()`). The project is created with `await addDoc(...)` and its `projectRef.id` is used, then stages are created in a sequential `for` loop with `await addDoc(collection(db,'stages'), {...projectId: projectRef.id})` — never batched/parallel. I added a test (`stages: створення (реальний потік addProject → addStage)`) that does exactly this sequence through the actual rules (create project as owner, then create a stage pointing at it) and confirms success. A second test confirms Bob **cannot** create a stage whose `projectId` points at Alice's project (fails `isTeamMember(request.resource.data.projectId)` since he's not in that project's `team`). Both passed.

2. **Materials get() budget + batched writes** (`useMaterials.js: reorderMaterials()`, used from `MaterialsGrid.jsx`). Each material read/write requires 2 `get()` calls (`stages/{stageId}` → `projects/{projectId}`). **Correction (see "N=30 get() budget verification" below): the original justification here — "well under the 10-per-document limit" — was wrong/incomplete.** Firestore's `get()` budget for a single-document request is 10, but `useMaterials.js` subscribes with a *query* (`onSnapshot` over the whole `materials` collection ordered by `order`), which is a multi-document request subject to a **20-get() budget applied once per request, not per returned document**. With dozens of materials in a stage and 2 `get()`s resolved per document, a naive (non-deduplicating) evaluator would blow through 20 total `get()`s once a stage holds more than ~10 materials — which is a completely normal stage size — and the whole listener would fail with `permission-denied`. The rule is only safe because Firestore deduplicates/caches `get()` calls to the *same document path* within one request, so `get(stages/{stageId})` and `get(projects/{projectId})` are each paid for once per request regardless of how many materials are returned. This was verified empirically, not assumed (see the dedicated section below). `reorderMaterials` uses `writeBatch` to update multiple material docs sharing the same `stageId` in one commit. I added a test (`stages/materials: пакетний запис (writeBatch, як у useMaterials.reorderMaterials)`) seeding a second material and running a real `writeBatch` with two `update()` calls: succeeds for Alice (team member), fails for Bob.

3. Also checked `FunctionalModals.jsx: handleDeleteProject()`, which deletes a project's materials → messages → stage → project in that order (project doc deleted last). Since `isTeamMember` resolves through the still-existing project doc at each step until the final delete, this ordering is safe under the new rules — no test added for this since it's a straightforward corollary of the stage/material rules already covered, but I traced it manually to be sure deletion order doesn't strand a step against a now-orphaned project reference.

No client code writes to `stages/{stageId}/messages` currently (only `api/chat/route.js` reads it via Admin SDK, and `FunctionalModals.jsx` deletes it during project deletion) — tightening that subcollection's rules to mirror the `projects/messages` pattern (per plan Step 3) carries no regression risk today.

## Concerns

- None blocking. The `stages/messages` subcollection appears to be dead/unused from the client (no `addDoc` call found anywhere in `src/`), so its rules are speculative but harmless and match the plan's exact text.
- Did not touch `projects`, `invitations`, or `tasks` rules — those remain Task 7's responsibility.
- Rules were **not** deployed (`firebase deploy` not run), per instructions — commit is local only, on `security/phase0-firestore-rules`.

---

## Addendum: N=30 get() budget verification (empirical, not reasoning)

The claim above — that materials rules are "safe under the 10-per-document limit" — was misleading. `useMaterials.js` never issues single-document reads for materials; it subscribes with `query(collection(db,'stages',stageId,'materials'), orderBy('order','asc'))` via `onSnapshot`, i.e. a multi-document request. Firestore's documented budget for that request shape is **20 get() calls total**, not 10 per document. With the rule's 2 nested `get()`s per document (`stages/{stageId}` → `projects/{projectId}`), the only thing standing between this rule and a hard failure on any stage with more than ~10 materials is whether Firestore deduplicates identical `get()` paths within a single request. The prior report did not test this — the existing test only used N=2 materials, which cannot distinguish "safe because deduped" from "safe only by accident of a tiny fixture."

Added to `tests/rules/stages.test.js`, describe block `stages/materials: бюджет get() правил при реалістичній кількості документів (N=30)`:
- Seeds 30 materials (`bulk-0`..`bulk-29`) under `STAGE_ID` via `withSecurityRulesDisabled`, in addition to the existing `m1` fixture (31 documents total under the stage).
- Runs the **exact query shape** `useMaterials.js` uses — `query(collection(db,'stages',STAGE_ID,'materials'), orderBy('order','asc'))` — via `getDocs` as `CAROL` (team member, non-owner): asserted to **succeed**, and returns all 31 documents.
- Runs the same query as `BOB` (authenticated, not on the team): asserted to **fail**.
- Runs a `writeBatch` with 30 `update()` calls (one per seeded material), mirroring `useMaterials.js: reorderMaterials()`, as `ALICE` (team member): asserted to **succeed**.

**Result: PASS.** Full `test:rules` run: `Test Files 2 passed (2)`, `Tests 40 passed (40)` (up from 37, +3 new tests, 0 regressions). `test:server` still green: `Test Files 2 passed (2)`, `Tests 24 passed (24)`.

**Empirical answer:** at N=30 materials in one stage, the query-shaped `onSnapshot`/`getDocs` read and the 30-document `writeBatch` both succeed for a team member and both correctly deny a non-member. Firestore deduplicates/caches `get()` calls to the *same document path* within a single request — `get(stages/{stageId})` and `get(projects/{projectId})` are each charged once per request, not once per returned document — so the 2-nested-get() materials rule stays well under the 20-get()-per-query budget regardless of how many materials a stage holds. The rule is safe at scale for the reason stated here, not for the "10-per-document" reason originally written in the code comment and in this report; both have been corrected (`firestore.rules` comment above the `materials` match block, and the paragraph in item 2 above).

---

**Status:** DONE
**Commit:** `42a6e16` (original rule change) — this addendum's test/comment changes are new uncommitted work in the same branch as of this verification pass.
**Test summary:** red confirmed hole (3/33 failing) → green after rules change (37/37 rules, 24/24 server, 61/61 full suite) → **N=30 get()-budget check added: 40/40 rules, 24/24 server, still green**
**Concerns:** none blocking; `stages/messages` subcollection is currently unused by client code so its new restrictions are unverified against a real flow (matches plan text as-is). The "10-per-document" justification for materials' safety was wrong/incomplete and has been corrected in both the rules comment and this report — the real mechanism is same-document get() deduplication within the 20-get()-per-query budget, confirmed empirically at N=30.
