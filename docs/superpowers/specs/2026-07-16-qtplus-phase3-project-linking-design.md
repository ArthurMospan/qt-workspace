# QuickTeam+ Phase 3 — Project Linking + Picker (design)

**Status:** design approved 2026-07-16 (user delegated open decisions), pending spec review.
**Scope:** ONE sub-project. Reading/rendering QuickTeam+ stages, materials, chat and any
real-time listeners are **Phase 4** — a separate spec→plan→implement cycle, explicitly out
of scope here.

## Goal

Let an owner/admin link **one** workspace project to **one** QuickTeam+ project, by picking
from the connected user's available QuickTeam+ projects, and persist that link in the
workspace project document. The link surfaces as a new **"QuickTeam+" tab** on the workspace
project page.

The deliverable is proven when: an owner/admin opens the tab, picks a QuickTeam+ project,
and the tab then shows "Привʼязано до: <назва>"; a regular team member sees the same linked
state read-only; unlink returns the tab to the picker (and hides the tab for members).

**Phase 3 is workspace-only.** The provider (`qt`) is not touched. Firestore rules are not
changed. There is no deploy-order hazard (unlike Phases 0 and 1).

## Context this builds on (Phase 2, already shipped + verified in prod — reuse, do not rewrite)

- **Portal session:** `src/lib/portal/firebase.js` (`getPortalAuth()`, `getPortalDb()` — a
  second named Firebase app `qtplus-portal` for `quickteam-portal-prod`, public config baked
  in) and `usePortalSession()` → `{ portalUser, loading, error }` where
  `error ∈ { null, 'not_connected', 'grant_invalid', 'upstream' }`.
- **Available-projects read:** `usePortalProjects(portalUser)` already runs
  `getDocs(query(collection(portalDb,'projects'), where('team','array-contains', portalUser.uid)))`
  and today returns `{ count, loading, error }`. QuickTeam+'s own Firestore rules authorize
  this read by team membership.
- **Session route:** `GET /api/integrations/qtplus/session` mints the short-lived custom
  token. Nothing about it changes here.
- **Settings card:** `settings/page.js` `case 'qtplus'` renders the connect/disconnect item
  and, when connected, the `QtPlusProjectsProbe` line "Доступно N проєктів QuickTeam+".

### QuickTeam+ project shape (portal, `quickteam-portal-prod`)

`projects/{id}` documents carry `{ name, description, deadline, team[], teamRoles{}, ownerId,
… }`. `name` is what the picker displays; `id` is what we store. (Source: `qt/src/lib/hooks/useProjects.js`.)

### Workspace project shape + rules (`quickteam-me`)

- `projects/{id}` is `organizationId`-scoped; read real-time by `useProjects(userId, activeOrgId)`
  → surfaced through `AppContext` as `projects`. Fields include `name, organizationId,
  visibility ('internal'|'shared'), status, team[], teamRoles{}, ownerId, createdAt`.
- **Update rule (`firestore.rules:152-156`) — the key fact enabling this design:**
  ```
  allow update: if request.resource.data.organizationId == resource.data.organizationId && (
    (isOrgAdminOrOwner(orgId) && request.resource.data.status == resource.data.status) ||
    (isOrgMember(orgId)  && affectedKeys().hasOnly(['updatedAt', 'issueCounter']))
  );
  ```
  An org **admin/owner** may already write **arbitrary fields** on their project as long as
  `organizationId` and `status` are unchanged; a plain **member** may not. Writing
  `qtplusLink` via `updateDoc` (touching only `qtplusLink` + `updatedAt`) satisfies this rule
  unchanged. **No rules change is required, and the permission model (owner/admin link;
  member read-only) is already enforced by Firestore, not merely by the UI.**

## Architecture decision

The link is a **field on the workspace project document**, written **client-side** by an
owner/admin via `updateDoc`. No workspace API route, no qt route, no rules change.

Why this over a workspace `POST /api/…/link` route:
- The Firestore rule above already authorizes exactly the right callers, so a route would
  re-implement authorization the rules already do.
- No server-side validation of the picked id is needed: it is harmless to store an arbitrary
  id because **every** later read of the linked QuickTeam+ data (Phase 4) is itself authorized
  by QuickTeam+'s rules per viewer. A route buys nothing and adds server-only glue.
- Keeps Phase 3 to a single repo and a minimal surface.

Trade-off accepted: the write is client-side, so the *testable* surface is the pure
view-model helper (autotested) plus the browser E2E (human) — there is no route to unit-test.
This matches the stated testing philosophy: tests where they are honest.

## Data model — `projects/{id}.qtplusLink`

A nested map, written by owner/admin:

```
qtplusLink: {
  projectId:   string,     // QuickTeam+ project id (quickteam-portal-prod)
  projectName: string,     // denormalized name snapshot — display without a portal session
  linkedBy:    string,     // workspace uid that created the link
  linkedAt:    Timestamp,  // serverTimestamp()
}
```

Unlink = `updateDoc(ref, { qtplusLink: deleteField(), updatedAt: serverTimestamp() })`.

**Why store `projectName`:** a teammate viewing the tab may have no personal QuickTeam+
connection, or may not be a team member of that QuickTeam+ project, yet must still see
"Привʼязано до: <назва>". Without a snapshot the workspace could not render the name for such
a viewer. The snapshot can go stale if the QuickTeam+ project is renamed; we refresh it
opportunistically whenever a connected owner/admin re-picks (the fresh name is in the picker
list at that moment). Acceptable staleness for a test deployment.

## Components

### A. `usePortalProjects` — return the list, not just the count (modify)

`src/lib/portal/usePortalProjects.js`. Extend the return shape from `{ count, loading, error }`
to `{ projects, count, loading, error }`, where `projects` is the raw mapped array
`[{ id, name }]` from the `getDocs` snapshot and `count === projects.length`. The existing
`QtPlusProjectsProbe` in the settings card reads only `count`, so it is unaffected
(backward-compatible). Sorting / normalization is **not** done here — it lives in the pure
helper (Component C) so it can be tested.

### B. `useQtPlusEnabled(orgId)` — org toggle listener (new)

`src/lib/hooks/useQtPlusEnabled.js`. A small real-time listener on
`organizations/{orgId}/settings/integrations`, returning
`enabled = snap.exists() && snap.data().qtPortalEnabled !== false`. This mirrors the exact
semantics the settings page uses (`settings/page.js:799-802`), so the project tab's gating
always agrees with the settings card's "Інтеграцію вимкнено для організації" state. Returns
`{ enabled, loading }`; `enabled` is `false` while loading or when `orgId` is absent.

### C. `qtplusLinkModel.mjs` — pure view-model helpers (new, AUTOTESTED)

`src/lib/portal/qtplusLinkModel.mjs`. No `server-only` import → runnable under plain
`node --test`. Pure functions, the honest test surface of Phase 3:

- `toPortalProjectOptions(rawProjects) → [{ id, name }]`
  - name fallback to `'Без назви'` when missing/blank;
  - de-duplicated by `id` (first occurrence wins);
  - sorted by `name` case-insensitively (`localeCompare`, locale `'uk'`);
  - nullish / empty input → `[]`.
- `resolveLinkView({ link, options, otherLinkedIds, optionsLoaded }) → view`
  - `link` = `project.qtplusLink` (or null/undefined);
  - `options` = output of `toPortalProjectOptions` (current user's available QT+ projects);
  - `otherLinkedIds` = array of QT+ `projectId`s already linked to **other** workspace
    projects (from `AppContext.projects`);
  - `optionsLoaded` = whether the portal list has actually loaded (so "not in list" means
    "no access", not "not loaded yet").
  - returns:
    - `linked: boolean` (`Boolean(link?.projectId)`)
    - `linkedId: string | null`
    - `linkedName: string | null` (`link?.projectName` || matched option name || null)
    - `selectedId: string | null` (= `linkedId`; initial picker value)
    - `staleAccess: boolean` (`linked && optionsLoaded && no option matches linkedId` — the
      current user can no longer see the linked QT+ project; show a subtle hint, snapshot name
      still renders)
    - `options: [{ id, name, linkedElsewhere: boolean }]` (`linkedElsewhere` = id ∈ otherLinkedIds)

### D. `QtPlusProjectTab.jsx` — the tab content (new, client)

`src/components/workspace/QtPlusProjectTab.jsx` (alongside `ProjectTeamTab`, `AnalyticsTab`).
Props: `{ project, orgRole, currentUser }` (+ whatever the page already has). Behavior:

- `usePortalSession()` → portal session (reuse Phase 2);
- `usePortalProjects(portalUser)` → available QT+ projects;
- reads `project.qtplusLink` (already in context, real-time);
- computes `options = toPortalProjectOptions(projects)` and
  `view = resolveLinkView({ link, options, otherLinkedIds, optionsLoaded })`;
- `canManage = can(orgRole, 'edit:project_settings')` (owner/admin);
- writes via the thin client helpers (Component E).

Render states (Ukrainian copy):

```
┌ owner/admin, NOT connected to QuickTeam+ ────────────────────────┐
│  «Підключіть акаунт QuickTeam+ у Налаштуваннях, щоб привʼязати»   │
│  → link to Налаштування → QuickTeam+                             │
├ owner/admin, connected, NOT linked ──────────────────────────────┤
│  Пікер: [ Оберіть проєкт QuickTeam+  ▼ ]      [Привʼязати]        │
│  (options already linked elsewhere are marked, not blocked)      │
├ owner/admin, connected, linked ──────────────────────────────────┤
│  Привʼязано до: «Acme Website»              [Змінити] [Відвʼязати]│
│  (staleAccess → subtle «недоступний зараз для вашого акаунта»)    │
├ member (non-admin), linked ──────────────────────────────────────┤
│  Привʼязано до: «Acme Website»                  (лише для читання)│
└──────────────────────────────────────────────────────────────────┘
```

Plus loading and session-error states, reusing Phase 2's error vocabulary:
`grant_invalid` → «Підключення застаріло — підключіть QuickTeam+ заново»;
`upstream` / `read_failed` → a soft error line. Unlink does **not** require a portal session
(it is a plain field delete), so a linked owner/admin who is not currently connected can still
unlink; re-picking requires a session.

Picker widget: the existing `@/components/ui/Select` with `options`. In-list search is YAGNI
for Phase 3.

Tab icon: lucide `Plug` (tabs render a lucide component; the brand image would add glue). It
carries forward to Phase 4 when the tab becomes the portal content tab.

### E. `qtplusProjectLink.js` — thin client write helpers (new, client)

`src/lib/portal/qtplusProjectLink.js`. Not node-tested (Firebase SDK writes); verified by
build + E2E.

- `linkQtPlusProject(projectId, { id, name }, linkedByUid)` →
  `updateDoc(doc(db,'projects',projectId), { qtplusLink: { projectId:id, projectName:name,
  linkedBy:linkedByUid, linkedAt: serverTimestamp() }, updatedAt: serverTimestamp() })`.
- `unlinkQtPlusProject(projectId)` →
  `updateDoc(doc(db,'projects',projectId), { qtplusLink: deleteField(), updatedAt: serverTimestamp() })`.

### F. Project page wiring (modify)

`src/app/(app)/[projectId]/page.js`:

- module const `QTPLUS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_QTPLUS_URL)`;
- `const { enabled: qtEnabled } = useQtPlusEnabled(project?.organizationId)`;
- `const qtplusLinked = Boolean(project?.qtplusLink?.projectId)`;
- `const canManageQtPlus = can(orgRole, 'edit:project_settings')`;
- `const showQtPlusTab = QTPLUS_CONFIGURED && qtEnabled && (canManageQtPlus || qtplusLinked)`;
- conditionally append `{ id: 'qtplus', label: 'QuickTeam+', icon: Plug }` to `TABS`;
- render `<QtPlusProjectTab project={project} orgRole={orgRole} currentUser={currentUser} />`
  when `activeTab === 'qtplus'`.

## Data flow

```
Project page (workspace)
  ├─ useQtPlusEnabled(orgId)  → org toggle (settings/integrations)
  ├─ project.qtplusLink       → current link (real-time via useProjects)
  └─ QuickTeam+ tab (owner/admin, connected):
        usePortalSession()               → portal sign-in (Phase 2)
        usePortalProjects(portalUser)    → [{id,name}] available QT+ projects
        toPortalProjectOptions + resolveLinkView → view model
        pick → linkQtPlusProject()   → updateDoc projects/{id}.qtplusLink
        └─ rules: isOrgAdminOrOwner, status/orgId unchanged → allowed
  → all viewers' project doc updates in real-time; members' tab appears when linked
```

## Security / correctness

- Writing the link is authorized by the **existing** Firestore rule: only org admin/owner can
  write it; members are limited to `updatedAt`/`issueCounter`. The UI gate (`canManageQtPlus`)
  is defensive; the rule is authoritative.
- Storing an arbitrary `projectId` is harmless: the linked id is only a pointer. Every actual
  read of QuickTeam+ data (Phase 4) is authorized per viewer by QuickTeam+'s own rules
  (team membership). Phase 3 grants no data access it did not already have in Phase 2.
- No secret and no token is involved in the link itself; the portal session (Phase 2) is
  reused unchanged and only to populate the picker.

## Known limitations (deliberately deferred)

- **Name snapshot staleness:** if a QuickTeam+ project is renamed after linking, the stored
  `projectName` lags until a connected owner/admin re-picks. Acceptable; Phase 4 (live portal
  reads) can refresh names naturally.
- **No reverse uniqueness:** the same QuickTeam+ project may be linked to more than one
  workspace project. We surface this softly (`linkedElsewhere` marking) but do not forbid it.
- **`staleAccess` hint depends on the viewer:** it reflects whether *this* owner/admin can see
  the linked QT+ project, not whether it still exists globally. That distinction is fine for a
  test deployment.

## Testing

- **Pure helper (autotest, `node --test`, `.mjs`):** `qtplusLinkModel.mjs`
  - `toPortalProjectOptions`: sort order, `'Без назви'` fallback, dedup by id, empty/nullish;
  - `resolveLinkView`: unlinked; linked with `linkedName` from snapshot; `selectedId` echoes
    `linkedId`; `linkedElsewhere` marks ids in `otherLinkedIds`; `staleAccess` true only when
    `optionsLoaded` and no option matches; `staleAccess` false while options not loaded.
  - New `package.json` script `test:qtplus-link-model`.
- **Build + lint:** `npm run build` (new hook/component/page compile) and `npm run lint`
  (watch `react-hooks/set-state-in-effect` — the repo enforces it; keep `setState` inside
  async IIFEs / event handlers, per the Phase 2 lesson).
- **Browser E2E (human — no agent can drive the portal login):**
  1. As a connected owner/admin, open a project → QuickTeam+ tab → pick a project → "Привʼязано
     до <назва>" appears.
  2. A regular member of the same org sees the tab (read-only linked state) only because it is
     linked.
  3. Unlink → picker returns; the member's tab disappears.
  4. Toggle the org QuickTeam+ integration off in Settings → the tab disappears for everyone.

## Out of scope (explicit)

Rendering QuickTeam+ stages / materials / chat, real-time listeners on portal data, any tab
content beyond the picker and linked-state, editing QuickTeam+ data from the workspace, and
any change to the provider (`qt`). All Phase 4 or later.
