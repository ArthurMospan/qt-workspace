# QuickTeam+ Phase 4a — Stages + Materials (read-only) (design)

**Status:** design approved 2026-07-16 (user: "do as you recommend"), pending spec review.
**Scope:** ONE sub-project — the first slice of Phase 4. Project chat, sending/approving,
checklist/poll interactions, and stage-level chat are **later slices** (4b+), explicitly out of
scope here.

## Goal

When a workspace project is linked to a QuickTeam+ project (Phase 3), show that QuickTeam+
project's **stages** and each stage's **materials** inside the QuickTeam+ tab — **read-only**,
**real-time**. No writes to the QuickTeam+ (portal) database of any kind.

Proven when: a connected owner/admin opens a linked project's QuickTeam+ tab and sees the QT+
project's stage list (with status + overall progress); expanding a stage reveals its materials
rendered by type (files, links, checklists, polls, notes); a change made in the portal appears
live.

**Workspace-only.** No `qt` provider change, no Firestore rules change (Phase 4a only *reads*
existing portal data, authorized by QuickTeam+'s deployed rules).

## Context this builds on (already shipped — reuse, do not rewrite)

- **Phase 2** portal session: `src/lib/portal/firebase.js` (`getPortalDb()` → Firestore for the
  named `qtplus-portal` app on `quickteam-portal-prod`), `usePortalSession()` → `{ portalUser,
  loading, error }`. Reads run **as the connected user** under QuickTeam+ rules.
- **Phase 3** link + tab: `projects/{id}.qtplusLink = { projectId, projectName, … }`;
  `src/components/workspace/QtPlusProjectTab.jsx` already renders the tab with a live portal
  session and a "Привʼязано до «…»" state for the linked case. Phase 4a fills that linked state
  with the stages/materials view.

### QuickTeam+ data shapes (portal, `quickteam-portal-prod`)

- **Stages** — flat top-level `stages` collection, each with a `projectId` field:
  `{ id, label ("01. Назва"), status: 'todo' | 'in-progress' | 'done', projectId, order, createdAt }`.
  Rules: `allow read: if isTeamMember(resource.data.projectId)`.
- **Materials** — subcollection `stages/{stageId}/materials`, each `{ id, order, createdAt, type, … }`,
  polymorphic by `type`:
  - `file` / `audio` / `image`: `title`, `desc` (size/duration), `url?`, `storagePath?`, `fileType?`
  - `link`: `title`, `url`, `desc` (domain)
  - `checklist`: `title`, `items: string[]`, `checkedItems: number[]` (indices)
  - `poll`: `title`, `options: string[]`, `votes: number[]`, `votedBy: string[]`
  - `note`: `title`, `content`, `source?`
  Rules: `allow read: if isTeamMember(stageProjectId(stageId))` (2 `get()`s, deduped per query).

The QuickTeam+ id to read stages for is `project.qtplusLink.projectId` (the Phase 3 link).

## Access / visibility

The stages/materials content is authorized by QuickTeam+ rules on **team membership of the QT+
project**. A workspace viewer sees it only if they (a) have their own QuickTeam+ connection
(portal session) and (b) are a team member of the linked QT+ project — in practice, the person
who linked it, plus any teammate who is also on that portal team. Everyone else keeps the Phase 3
behaviour: the "Привʼязано до «…»" row plus the existing connect-prompt / not-connected states.
No new gating logic — the portal session state (Phase 2/3) already distinguishes these; a
`permission-denied` read simply yields an empty/blocked view, handled as an error state.

## Components (all in `qt-workspace`; all read the portal DB)

### A. `usePortalStages(qtProjectId)` — real-time stages (new)

`src/lib/portal/usePortalStages.js`. Mirrors `qt/src/lib/hooks/useStages.js` but **read-only**
and against `getPortalDb()`:
`onSnapshot(query(collection(portalDb,'stages'), where('projectId','==',qtProjectId), orderBy('order','asc')))`.
Returns `{ stages, loading, error }` (`error: 'read_failed' | null`; `permission-denied` is a
quiet, expected outcome for non-members). Inert when `qtProjectId` or `getPortalDb()` is falsy.

### B. `usePortalStageMaterials(stageId)` — real-time materials for one stage (new)

`src/lib/portal/usePortalStageMaterials.js`. `onSnapshot(query(collection(portalDb,'stages',
stageId,'materials'), orderBy('order','asc')))` → `{ materials, loading, error }`. Subscribed
**only for the expanded stage** (the view mounts it lazily), so a project with many stages does
not open dozens of listeners. Inert when `stageId`/`getPortalDb()` is falsy.

### C. `qtplusMaterialView.mjs` — pure view-model helpers (new, AUTOTESTED)

`src/lib/portal/qtplusMaterialView.mjs`. No `server-only`/Firebase import → `node --test`.

- `toMaterialView(m) → { id, type, kind, icon, title, subtitle, href, checklist, poll, note }`:
  - `kind ∈ 'file' | 'link' | 'checklist' | 'poll' | 'note' | 'unknown'` (file/audio/image → `'file'`).
  - `icon ∈ 'file' | 'image' | 'audio' | 'link' | 'checklist' | 'poll' | 'note' | 'unknown'` (name only;
    the component maps name → lucide component).
  - `title = m.title?.trim() || 'Без назви'`; `subtitle = m.desc || m.source || null`.
  - `href = m.url || null` (read-only open link; direct file download without a `url` is deferred —
    subtitle still shows the filename/size).
  - `checklist = kind==='checklist' ? { items: m.items || [], checkedItems: m.checkedItems || [] } : null`.
  - `poll = kind==='poll' ? { options: m.options || [], votes: m.votes || [], total: sum(votes) } : null`.
  - `note = kind==='note' ? { content: m.content || '', source: m.source || null } : null`.
- `stageProgress(stages) → { done, total, percent }` — `done` = count `status==='done'`; `percent`
  = `total ? round(done/total*100) : 0`.
- `stageStatusMeta(status) → { label, tone }` — UA label + a tone key:
  `todo→{'Заплановано','muted'}`, `in-progress→{'В роботі','active'}`, `done→{'Завершено','done'}`,
  else `{'—','muted'}`.

### D. `QtPlusStagesView.jsx` — the stages/materials render (new, client)

`src/components/workspace/QtPlusStagesView.jsx`. Props `{ qtProjectId }`.
- `usePortalStages(qtProjectId)` → header line "Прогрес: N% (done/total)" via `stageProgress`, then
  an **accordion** of stages (each: order/label, a `stageStatusMeta` badge). One stage open at a
  time (local `expandedStageId` state).
- When a stage is expanded, mount a small child `StageMaterials({ stageId })` that calls
  `usePortalStageMaterials(stageId)` and renders each material via `toMaterialView`:
  - `file`/`image`/`audio`/`link`: icon + title + subtitle; whole card is a link when `href` is set
    (`target="_blank" rel="noopener noreferrer"`).
  - `checklist`: title + each item with a checked/unchecked box (read-only, from `checkedItems`).
  - `poll`: title + each option with a proportion bar and its vote count (read-only).
  - `note`: title + `content` (+ `source` caption).
  - `unknown`: icon + title only (forward-compatible with future portal types).
- States: loading spinner; empty ("Ще немає етапів" / "Ще немає матеріалів"); `error` →
  "Немає доступу до цього проєкту QuickTeam+ вашим акаунтом" (covers `permission-denied`).

### E. Integration into `QtPlusProjectTab.jsx` (modify)

In the **linked** branch, after the existing "Привʼязано до «…»" row and the owner/admin
Change/Unlink controls, render `<QtPlusStagesView qtProjectId={project.qtplusLink.projectId} />`
**only when `portalUser` exists** (a live portal session). Viewers without a session keep the
Phase 3 rows unchanged. The member read-only branch renders `QtPlusStagesView` too when a session
is present. No change to the connect-prompt / picker / error branches.

## Data flow

```
QuickTeam+ tab (linked, portalUser present)
  └─ QtPlusStagesView(qtProjectId = qtplusLink.projectId)
       ├─ usePortalStages(qtProjectId)      → onSnapshot stages where projectId==… (portal DB)
       │     └─ QT+ rule: isTeamMember(projectId)
       └─ expand stage → StageMaterials(stageId)
             └─ usePortalStageMaterials(stageId) → onSnapshot stages/{id}/materials (portal DB)
                   └─ QT+ rule: isTeamMember(stageProjectId(stageId))
  → live stage list + per-stage materials, read-only
```

## Security / correctness

- Read-only: no `addDoc`/`updateDoc`/`deleteDoc` against the portal DB anywhere in Phase 4a.
- All reads authorized entirely by QuickTeam+'s deployed rules (team membership); the workspace
  invents no access logic and stores nothing new.
- `permission-denied` (viewer not on the QT+ team) is an expected, quiet state → blocked-view
  message, never a thrown error or noisy log.

## Testing

- **Pure helper (autotest, `node --test`, `.mjs`):** `qtplusMaterialView.mjs`
  - `toMaterialView`: each `type` → correct `kind`/`icon`/normalized fields; `href` from `url`;
    title fallback; checklist/poll/note shapes; unknown type → `kind:'unknown'`.
  - `stageProgress`: empty → `0%`; mixed statuses → correct `done`/`percent`.
  - `stageStatusMeta`: the three known statuses + fallback.
  - New `package.json` script `test:qtplus-material-view`.
- **Build + lint:** `npm run build` + `npm run lint` (watch `react-hooks/set-state-in-effect` —
  keep listener setup inside effects with `queueMicrotask`/async as the existing portal hooks do).
- **Browser E2E (human — no agent can drive the portal login):** on a linked project as a
  connected member of the QT+ team, the QuickTeam+ tab shows the stage list + progress; expanding a
  stage shows its materials by type; a change in the portal appears live; a viewer without QT+
  access still sees the Phase 3 rows only.

## Out of scope (explicit — later slices)

Project chat (view/send), stage-level chat, sending/approving stages, checklist toggling, poll
voting, typing indicators, the AI assistant, file re-upload/download of Cloudinary-only files, and
any write to the portal. All Phase 4b or later.
