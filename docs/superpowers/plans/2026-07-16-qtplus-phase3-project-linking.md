# QuickTeam+ Phase 3 — Project Linking + Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner/admin link one workspace project to one QuickTeam+ project via a picker of their available QuickTeam+ projects, persisting the link on the workspace project document, surfaced as a new "QuickTeam+" tab.

**Architecture:** Workspace-only. The available-projects list comes from the reused Phase 2 portal session (`usePortalSession` + `usePortalProjects` reading `quickteam-portal-prod` under QuickTeam+'s rules). The link is a `qtplusLink` map written client-side to `projects/{id}` via `updateDoc` by an owner/admin — the workspace Firestore rule already authorizes this, so there is no rules change, no qt change, and no deploy-order hazard.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase client SDK (workspace `quickteam-me` + the named `qtplus-portal` app from Phase 2), `node --test` `.mjs` for the pure helper, ESLint flat config + `next build` for client code.

**Design doc:** `docs/superpowers/specs/2026-07-16-qtplus-phase3-project-linking-design.md`

## Global Constraints

- **Single repo:** all paths are in `qt-workspace`. The provider `qt` is **not** touched. Firestore rules are **not** changed.
- **Data field:** the link is the map `qtplusLink: { projectId, projectName, linkedBy, linkedAt }` on `projects/{id}`. Unlink = `qtplusLink: deleteField()`. Both writes also set `updatedAt: serverTimestamp()` and touch nothing else, so the workspace rule's admin/owner branch (`firestore.rules:152-156`, requires `status` and `organizationId` unchanged) is satisfied — **no rules change**.
- **Who writes:** owner/admin only (`can(orgRole, 'edit:project_settings')`). Enforced by Firestore rules; the UI gate is defensive.
- **Tab gate (verbatim):** `showQtPlusTab = QTPLUS_CONFIGURED && ((canManageQtPlus && qtEnabled) || qtplusLinked)`, where `QTPLUS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_QTPLUS_URL)`. **Members never read `organizations/{orgId}/settings/integrations`** — their tab visibility keys off `project.qtplusLink` only (project doc, member-readable via `firestore.rules:150`). `qtEnabled` gates the owner/admin branch only.
- **User-visible copy is Ukrainian**, matching existing UI.
- **Reuse, do not rewrite Phase 2:** `getPortalAuth`/`getPortalDb` (`src/lib/portal/firebase.js`), `usePortalSession()` → `{ portalUser, loading, error }` with `error ∈ { null,'not_connected','grant_invalid','upstream' }`.
- **Testing split:** the pure view-model helper is autotested (`node --test`, `.mjs`, **no `server-only` import**). Client hooks/component/page wiring are verified by `npx eslint` (per file) + `npm run build` (integration, Tasks 6 & 7) + human browser E2E.
- **Lint rule `react-hooks/set-state-in-effect` is enforced** (build does not run lint, so it can slip — Phase 2 hit this). Never call `setState` synchronously in an effect body; use `queueMicrotask(() => setState(...))` (the repo's established pattern, e.g. `useProjects.js`) or set state inside an async IIFE / event handler.
- **Picker** = existing `@/components/ui/Select` (`onChange(value)`, `options: [{ value, label }]`). **Tab icon** = lucide `Plug`.

---

### Task 1: Pure view-model helper `qtplusLinkModel.mjs` (autotested)

**Repo:** `qt-workspace`

**Files:**
- Create: `src/lib/portal/qtplusLinkModel.mjs`
- Test: `tests/qtplus-link-model.test.mjs`
- Modify: `package.json` (add a test script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toPortalProjectOptions(rawProjects) → [{ id, name }]` — name fallback `'Без назви'`, de-duped by `id` (first wins), sorted by name (`localeCompare`, `'uk'`, `sensitivity:'base'`); nullish/non-array → `[]`.
  - `resolveLinkView({ link, options, otherLinkedIds, optionsLoaded }) → { linked, linkedId, linkedName, selectedId, staleAccess, options: [{ id, name, linkedElsewhere }] }`.

- [ ] **Step 1: Write the failing test**

Create `tests/qtplus-link-model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPortalProjectOptions, resolveLinkView } from '../src/lib/portal/qtplusLinkModel.mjs';

test('toPortalProjectOptions: sorts by name (uk, case-insensitive)', () => {
  const out = toPortalProjectOptions([
    { id: 'b', name: 'Яблуко' },
    { id: 'a', name: 'абрикос' },
    { id: 'c', name: 'Банан' },
  ]);
  assert.deepEqual(out.map((o) => o.id), ['a', 'c', 'b']); // абрикос, Банан, Яблуко
});

test('toPortalProjectOptions: blank/missing name -> "Без назви"', () => {
  const out = toPortalProjectOptions([{ id: 'x' }, { id: 'y', name: '' }, { id: 'z', name: '  ' }]);
  assert.deepEqual(out.map((o) => o.name), ['Без назви', 'Без назви', 'Без назви']);
});

test('toPortalProjectOptions: de-dupes by id, first wins', () => {
  const out = toPortalProjectOptions([
    { id: 'a', name: 'First' },
    { id: 'a', name: 'Second' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'First');
});

test('toPortalProjectOptions: nullish/empty -> []', () => {
  assert.deepEqual(toPortalProjectOptions(null), []);
  assert.deepEqual(toPortalProjectOptions(undefined), []);
  assert.deepEqual(toPortalProjectOptions([]), []);
});

test('resolveLinkView: unlinked', () => {
  const view = resolveLinkView({
    link: null, options: [{ id: 'a', name: 'A' }], otherLinkedIds: [], optionsLoaded: true,
  });
  assert.equal(view.linked, false);
  assert.equal(view.linkedId, null);
  assert.equal(view.linkedName, null);
  assert.equal(view.selectedId, null);
  assert.equal(view.staleAccess, false);
  assert.deepEqual(view.options, [{ id: 'a', name: 'A', linkedElsewhere: false }]);
});

test('resolveLinkView: linked -> name from snapshot, selectedId echoes linkedId', () => {
  const view = resolveLinkView({
    link: { projectId: 'p1', projectName: 'Acme' },
    options: [{ id: 'p1', name: 'Acme (fresh)' }],
    otherLinkedIds: [], optionsLoaded: true,
  });
  assert.equal(view.linked, true);
  assert.equal(view.linkedId, 'p1');
  assert.equal(view.linkedName, 'Acme'); // snapshot wins over fresh option name
  assert.equal(view.selectedId, 'p1');
  assert.equal(view.staleAccess, false);
});

test('resolveLinkView: linkedName falls back to option name when snapshot missing', () => {
  const view = resolveLinkView({
    link: { projectId: 'p1' }, options: [{ id: 'p1', name: 'Acme fresh' }],
    otherLinkedIds: [], optionsLoaded: true,
  });
  assert.equal(view.linkedName, 'Acme fresh');
});

test('resolveLinkView: linkedElsewhere marks ids linked to other workspace projects', () => {
  const view = resolveLinkView({
    link: null, options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    otherLinkedIds: ['b'], optionsLoaded: true,
  });
  assert.equal(view.options.find((o) => o.id === 'a').linkedElsewhere, false);
  assert.equal(view.options.find((o) => o.id === 'b').linkedElsewhere, true);
});

test('resolveLinkView: staleAccess true when linked id absent from loaded options', () => {
  const view = resolveLinkView({
    link: { projectId: 'gone', projectName: 'Gone' }, options: [{ id: 'a', name: 'A' }],
    otherLinkedIds: [], optionsLoaded: true,
  });
  assert.equal(view.staleAccess, true);
  assert.equal(view.linkedName, 'Gone'); // snapshot still renders
});

test('resolveLinkView: staleAccess false while options not loaded', () => {
  const view = resolveLinkView({
    link: { projectId: 'gone', projectName: 'Gone' }, options: [],
    otherLinkedIds: [], optionsLoaded: false,
  });
  assert.equal(view.staleAccess, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd qt-workspace && node --test tests/qtplus-link-model.test.mjs`
Expected: FAIL — cannot find module `../src/lib/portal/qtplusLinkModel.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/portal/qtplusLinkModel.mjs`:

```js
/**
 * Pure, dependency-free view-model helpers for the QuickTeam+ project-link tab.
 * No `server-only` and no Firebase import, so they run under plain `node --test`.
 */

const NO_NAME = 'Без назви';

function cleanName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || NO_NAME;
}

/**
 * Normalize raw QuickTeam+ project docs into picker options: [{ id, name }],
 * name-fallback applied, de-duped by id (first wins), sorted by name
 * (Ukrainian, case-insensitive). Nullish / non-array -> [].
 */
export function toPortalProjectOptions(rawProjects) {
  if (!Array.isArray(rawProjects)) return [];
  const byId = new Map();
  for (const p of rawProjects) {
    if (!p || !p.id || byId.has(p.id)) continue;
    byId.set(p.id, { id: p.id, name: cleanName(p.name) });
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' }),
  );
}

/**
 * Derive the tab's view model from the stored link + available options.
 * `optionsLoaded` distinguishes "the linked project is not in your list" (no
 * access) from "the list has not loaded yet".
 */
export function resolveLinkView({ link, options = [], otherLinkedIds = [], optionsLoaded = false }) {
  const linkedId = link?.projectId || null;
  const linked = Boolean(linkedId);
  const otherSet = new Set(otherLinkedIds || []);
  const annotatedOptions = options.map((o) => ({ ...o, linkedElsewhere: otherSet.has(o.id) }));
  const match = linked ? options.find((o) => o.id === linkedId) : null;
  const linkedName = linked ? (link.projectName || match?.name || null) : null;
  const staleAccess = Boolean(linked && optionsLoaded && !match);
  return { linked, linkedId, linkedName, selectedId: linkedId, staleAccess, options: annotatedOptions };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd qt-workspace && node --test tests/qtplus-link-model.test.mjs`
Expected: PASS — 10 tests.

- [ ] **Step 5: Add the test script**

In `qt-workspace/package.json` `scripts`, after `"test:qtplus-exchange": ...`, add:

```json
    "test:qtplus-link-model": "node --test tests/qtplus-link-model.test.mjs",
```

- [ ] **Step 6: Commit**

```bash
cd qt-workspace
git add src/lib/portal/qtplusLinkModel.mjs tests/qtplus-link-model.test.mjs package.json
git commit -m "feat(qtplus): pure project-link view-model helper (Phase 3)"
```

---

### Task 2: Extend `usePortalProjects` to return the list

**Repo:** `qt-workspace`

**Files:**
- Modify: `src/lib/portal/usePortalProjects.js`

**Interfaces:**
- Consumes: `getPortalDb()` from `src/lib/portal/firebase.js`.
- Produces: `usePortalProjects(portalUser) → { projects, count, loading, error }` where `projects` is `[{ id, name }]` (or `null` before load) and `count = projects?.length ?? null`. **Backward-compatible:** the settings-card probe reads only `count`.

> **Testing note:** client hook (Firebase SDK). Verified by `npx eslint` here and by `npm run build` in Task 6. The list shape it produces is what Task 1's `toPortalProjectOptions` normalizes.

- [ ] **Step 1: Replace the hook body**

Replace the entire contents of `src/lib/portal/usePortalProjects.js` with:

```js
'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getPortalDb } from '@/lib/portal/firebase';

/**
 * The connected user's QuickTeam+ projects. QT+ rules authorize the read by team
 * membership. Returns the raw list [{ id, name }] (for the project-link picker)
 * and its count (used by the settings-card probe). `projects` is null until the
 * first successful read.
 */
export function usePortalProjects(portalUser) {
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!portalUser) return;
    const db = getPortalDb();
    if (!db) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(
          query(collection(db, 'projects'), where('team', 'array-contains', portalUser.uid)),
        );
        if (!cancelled) {
          setProjects(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
          setLoading(false);
        }
      } catch (err) {
        console.error('[qtplus] portal projects read failed:', err);
        if (!cancelled) { setError('read_failed'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [portalUser]);

  return { projects, count: projects?.length ?? null, loading, error };
}
```

(The only behavioral change vs. Phase 2: it also returns `projects`. `count` is now derived; it is `null` before load and on error, exactly as before. `setLoading(true)` stays inside the async IIFE — never synchronous in the effect body — matching the Phase 2 fix.)

- [ ] **Step 2: Lint the file**

Run: `cd qt-workspace && npx eslint src/lib/portal/usePortalProjects.js`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/lib/portal/usePortalProjects.js
git commit -m "feat(qtplus): usePortalProjects returns the project list, not just count (Phase 3)"
```

---

### Task 3: `useQtPlusEnabled(orgId)` — org toggle listener

**Repo:** `qt-workspace`

**Files:**
- Create: `src/lib/hooks/useQtPlusEnabled.js`

**Interfaces:**
- Consumes: `db` from `@/lib/firebase`.
- Produces: `useQtPlusEnabled(orgId) → { enabled, loading }`. `enabled = snap.exists() && snap.data().qtPortalEnabled !== false`; `false` while loading, when `orgId` is absent, or on a read error (fail-closed).

> **Testing note:** client hook. Verified by `npx eslint` + Task 6 build. Read only by the owner/admin branch of the tab gate (owner/admin read of `settings/integrations` is a proven path — Phase 2's connect flow required it).

- [ ] **Step 1: Create the hook**

Create `src/lib/hooks/useQtPlusEnabled.js`:

```js
'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Real-time org-level QuickTeam+ integration toggle, read from
 * organizations/{orgId}/settings/integrations. Mirrors the settings page
 * (settings/page.js:799-802,1233): enabled = doc exists && qtPortalEnabled !== false.
 * Fails closed (enabled=false) while loading, without an orgId, or on a read error.
 * Only the tab's owner/admin branch consumes this; members never read this doc.
 */
export function useQtPlusEnabled(orgId) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      queueMicrotask(() => { setEnabled(false); setLoading(false); });
      return;
    }
    const ref = doc(db, 'organizations', orgId, 'settings', 'integrations');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setEnabled(snap.exists() && snap.data().qtPortalEnabled !== false);
        setLoading(false);
      },
      (err) => {
        console.warn('[qtplus] org integration flag read failed:', err.message);
        setEnabled(false);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [orgId]);

  return { enabled, loading };
}
```

(The only synchronous state update in the effect body — the `!orgId` branch — is wrapped in `queueMicrotask`; the `onSnapshot` callbacks are asynchronous, so `react-hooks/set-state-in-effect` is satisfied.)

- [ ] **Step 2: Lint the file**

Run: `cd qt-workspace && npx eslint src/lib/hooks/useQtPlusEnabled.js`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/lib/hooks/useQtPlusEnabled.js
git commit -m "feat(qtplus): useQtPlusEnabled org-toggle listener (Phase 3)"
```

---

### Task 4: Client write helpers `qtplusProjectLink.js`

**Repo:** `qt-workspace`

**Files:**
- Create: `src/lib/portal/qtplusProjectLink.js`

**Interfaces:**
- Consumes: `db` from `@/lib/firebase`.
- Produces:
  - `linkQtPlusProject(projectId, portalProject, linkedByUid) → Promise<void>` where `portalProject` is `{ id, name }`.
  - `unlinkQtPlusProject(projectId) → Promise<void>`.

> **Testing note:** thin Firestore-SDK writes; not node-testable. Verified by `npx eslint` + Task 6 build + human E2E. Both writes touch only `qtplusLink` + `updatedAt`, satisfying the admin/owner rule branch.

- [ ] **Step 1: Create the module**

Create `src/lib/portal/qtplusProjectLink.js`:

```js
'use client';
import { doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Persist the QuickTeam+ link on a workspace project. Owner/admin only — the
 * workspace projects update rule authorizes it (status & organizationId
 * unchanged); the UI gate is defensive. Writes only qtplusLink + updatedAt.
 */
export async function linkQtPlusProject(projectId, portalProject, linkedByUid) {
  await updateDoc(doc(db, 'projects', projectId), {
    qtplusLink: {
      projectId: portalProject.id,
      projectName: portalProject.name || '',
      linkedBy: linkedByUid || null,
      linkedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}

/** Remove the QuickTeam+ link from a workspace project. */
export async function unlinkQtPlusProject(projectId) {
  await updateDoc(doc(db, 'projects', projectId), {
    qtplusLink: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 2: Lint the file**

Run: `cd qt-workspace && npx eslint src/lib/portal/qtplusProjectLink.js`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/lib/portal/qtplusProjectLink.js
git commit -m "feat(qtplus): client link/unlink write helpers for project doc (Phase 3)"
```

---

### Task 5: `QtPlusProjectTab.jsx` — the tab content

**Repo:** `qt-workspace`

**Files:**
- Create: `src/components/workspace/QtPlusProjectTab.jsx`

**Interfaces:**
- Consumes: `usePortalSession()` (Phase 2); `usePortalProjects()` (Task 2); `toPortalProjectOptions`, `resolveLinkView` (Task 1); `linkQtPlusProject`, `unlinkQtPlusProject` (Task 4); `can` from `@/lib/utils/can`; `Select` from `@/components/ui/Select`; `Button` from `@/components/ui/Button`; `useWorkspaceStore` (for `showToast`).
- Produces: `default export function QtPlusProjectTab({ project, orgRole, currentUser, allProjects })`. Renders the picker / linked / read-only / connect-prompt / error states.

> **Testing note:** client component. Verified by `npx eslint` here and `npm run build` in Task 6 (it is first imported there). All state changes are in event handlers or `useMemo` — no effects — so `set-state-in-effect` cannot trigger.

- [ ] **Step 1: Create the component**

Create `src/components/workspace/QtPlusProjectTab.jsx`:

```jsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plug, ExternalLink } from 'lucide-react';
import { can } from '@/lib/utils/can';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { usePortalSession } from '@/lib/portal/usePortalSession';
import { usePortalProjects } from '@/lib/portal/usePortalProjects';
import { toPortalProjectOptions, resolveLinkView } from '@/lib/portal/qtplusLinkModel.mjs';
import { linkQtPlusProject, unlinkQtPlusProject } from '@/lib/portal/qtplusProjectLink';

function LinkedRow({ name, stale, readOnly }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Plug size={15} className="text-muted shrink-0" />
        <span className="text-[13px] text-ink font-medium">
          Привʼязано до: <span className="font-semibold">«{name || 'Без назви'}»</span>
        </span>
        {readOnly && <span className="text-[12px] text-muted">(лише для читання)</span>}
      </div>
      {stale && (
        <p className="text-[12px] text-muted pl-[23px]">
          Цей проєкт QuickTeam+ зараз недоступний для вашого акаунта.
        </p>
      )}
    </div>
  );
}

export default function QtPlusProjectTab({ project, orgRole, currentUser, allProjects }) {
  const canManage = can(orgRole, 'edit:project_settings');
  const showToast = useWorkspaceStore((s) => s.showToast);

  const { portalUser, loading: sessionLoading, error: sessionError } = usePortalSession();
  const { projects: portalProjects, loading: projectsLoading } = usePortalProjects(portalUser);

  const [pendingId, setPendingId] = useState('');
  const [saving, setSaving] = useState(false);

  const link = project?.qtplusLink || null;
  const optionsLoaded = Boolean(portalUser) && !projectsLoading && Array.isArray(portalProjects);

  const options = useMemo(() => toPortalProjectOptions(portalProjects), [portalProjects]);
  const otherLinkedIds = useMemo(
    () => (allProjects || [])
      .filter((p) => p.id !== project?.id && p.qtplusLink?.projectId)
      .map((p) => p.qtplusLink.projectId),
    [allProjects, project?.id],
  );
  const view = useMemo(
    () => resolveLinkView({ link, options, otherLinkedIds, optionsLoaded }),
    [link, options, otherLinkedIds, optionsLoaded],
  );

  const selectValue = pendingId || view.selectedId || '';
  const selectOptions = view.options.map((o) => ({
    value: o.id,
    label: o.linkedElsewhere ? `${o.name} (вже привʼязано)` : o.name,
  }));

  const doLink = async () => {
    const chosen = options.find((o) => o.id === selectValue);
    if (!chosen) return;
    setSaving(true);
    try {
      await linkQtPlusProject(project.id, chosen, currentUser?.uid || null);
      setPendingId('');
      showToast('Проєкт QuickTeam+ привʼязано');
    } catch (err) {
      console.error('[qtplus] link failed:', err);
      showToast('Не вдалося привʼязати проєкт', 'error');
    }
    setSaving(false);
  };

  const doUnlink = async () => {
    setSaving(true);
    try {
      await unlinkQtPlusProject(project.id);
      setPendingId('');
      showToast('Проєкт QuickTeam+ відвʼязано');
    } catch (err) {
      console.error('[qtplus] unlink failed:', err);
      showToast('Не вдалося відвʼязати проєкт', 'error');
    }
    setSaving(false);
  };

  // ── Member (read-only). Members only reach this tab when linked; guard anyway. ──
  if (!canManage) {
    if (!view.linked) return null;
    return (
      <div className="flex-1 min-h-[240px] py-6">
        <LinkedRow name={view.linkedName} readOnly />
      </div>
    );
  }

  // ── Owner/admin ──
  return (
    <div className="flex-1 min-h-[240px] py-6 max-w-[560px] flex flex-col gap-4">
      {view.linked && <LinkedRow name={view.linkedName} stale={view.staleAccess} />}

      {view.linked ? (
        <div className="flex flex-col gap-3">
          {portalUser && options.length > 0 && (
            <>
              <p className="text-[13px] text-muted">Змінити привʼязку:</p>
              <div className="flex items-center gap-2">
                <Select
                  value={selectValue}
                  onChange={setPendingId}
                  options={selectOptions}
                  placeholder="Оберіть проєкт QuickTeam+"
                />
                <Button
                  style="secondary"
                  size="lg"
                  onClick={doLink}
                  disabled={saving || !selectValue || selectValue === view.linkedId}
                >
                  Змінити
                </Button>
              </div>
            </>
          )}
          <div>
            <Button style="ghost" size="lg" onClick={doUnlink} disabled={saving}>
              Відвʼязати
            </Button>
          </div>
        </div>
      ) : sessionLoading || projectsLoading ? (
        <p className="text-[13px] text-muted">Перевіряємо доступ до QuickTeam+…</p>
      ) : (!portalUser || sessionError === 'not_connected') ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted">
            Підключіть свій акаунт QuickTeam+, щоб привʼязати проєкт.
          </p>
          <Link
            href="/settings?section=qtplus"
            className="inline-flex items-center gap-1 text-[13px] text-[#6366f1] font-semibold hover:underline"
          >
            Перейти до Налаштувань <ExternalLink size={12} />
          </Link>
        </div>
      ) : sessionError === 'grant_invalid' ? (
        <p className="text-[13px] text-red-500">
          Підключення застаріло — підключіть QuickTeam+ заново в Налаштуваннях.
        </p>
      ) : sessionError ? (
        <p className="text-[13px] text-muted">Не вдалося зʼєднатися з QuickTeam+. Спробуйте пізніше.</p>
      ) : options.length === 0 ? (
        <p className="text-[13px] text-muted">У вашому акаунті QuickTeam+ немає доступних проєктів.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Оберіть проєкт QuickTeam+, щоб привʼязати його до цього проєкту.
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={selectValue}
              onChange={setPendingId}
              options={selectOptions}
              placeholder="Оберіть проєкт QuickTeam+"
            />
            <Button style="primary" size="lg" onClick={doLink} disabled={saving || !selectValue}>
              Привʼязати
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint the file**

Run: `cd qt-workspace && npx eslint src/components/workspace/QtPlusProjectTab.jsx`
Expected: clean (in particular, no `react-hooks/*` errors — there are no effects, and hooks are called unconditionally before the early `return null`).

> Note: the `if (!canManage) return null` early return sits **after** all hook calls (`usePortalSession`, `usePortalProjects`, the three `useMemo`s, both `useState`s), so the Rules of Hooks hold. Do not move it above the hooks.

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/components/workspace/QtPlusProjectTab.jsx
git commit -m "feat(qtplus): QuickTeam+ project-link tab (picker + linked/read-only states) (Phase 3)"
```

---

### Task 6: Wire the tab into the project page

**Repo:** `qt-workspace`

**Files:**
- Modify: `src/app/(app)/[projectId]/page.js`

**Interfaces:**
- Consumes: `useQtPlusEnabled` (Task 3); `QtPlusProjectTab` (Task 5); `can` (already imported); `projects`, `currentUser`, `orgRole` from `useAppContext` (already destructured).
- Produces: a conditional `qtplus` tab + its content pane. No new exports.

> **Testing note:** this is the integration point; it is the first place `QtPlusProjectTab` (and thus Tasks 1-5) is imported, so `npm run build` here validates the whole feature's import graph. Verified by `npx eslint` + `npm run build` + human E2E.

- [ ] **Step 1: Add imports**

In `src/app/(app)/[projectId]/page.js`, add `Plug` to the existing lucide import (line ~18):

```js
import { LayoutGrid, BarChart2, Plus, Users, MessageSquare, Settings2, Filter, Layers, Plug } from 'lucide-react';
```

Add two imports near the other hook/component imports (after `import { can } from '@/lib/utils/can';`, line ~22):

```js
import { useQtPlusEnabled } from '@/lib/hooks/useQtPlusEnabled';
import QtPlusProjectTab from '@/components/workspace/QtPlusProjectTab';
```

- [ ] **Step 2: Add the configured-flag module const**

Directly below the `TABS` definition (after line ~28), add:

```js
const QTPLUS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_QTPLUS_URL);
```

- [ ] **Step 3: Compute the gate + tabs array inside the component**

First ensure `useMemo` is imported — change the top React import (line ~4) to:

```js
import { use, useState, useCallback, useEffect, useMemo } from 'react';
```

**Placement (avoids a temporal-dead-zone error):** the fallback `useEffect` below reads `activeTab`/`setActiveTab`, which are declared by `const [activeTab, setActiveTab] = useState('board')` around line 50 and several board-filter `useState`s follow it. Insert this block **after the last board/analytics filter `useState` (the `analyticsTypeFilter` line, ~line 72) and before the existing localStorage `useEffect` (~line 74)** — a point where `project`, `orgRole`, `projectId`, and `activeTab` are all already declared:

```js
  const { enabled: qtEnabled } = useQtPlusEnabled(project?.organizationId);
  const qtplusLinked = Boolean(project?.qtplusLink?.projectId);
  const canManageQtPlus = can(orgRole, 'edit:project_settings');
  const showQtPlusTab = QTPLUS_CONFIGURED && ((canManageQtPlus && qtEnabled) || qtplusLinked);

  const tabs = useMemo(() => {
    const base = TABS(projectId);
    return showQtPlusTab ? [...base, { id: 'qtplus', label: 'QuickTeam+', icon: Plug }] : base;
  }, [projectId, showQtPlusTab]);

  // If the qtplus tab was active and just became hidden (e.g. unlinked), fall back.
  useEffect(() => {
    if (activeTab === 'qtplus' && !showQtPlusTab) {
      queueMicrotask(() => setActiveTab('board'));
    }
  }, [activeTab, showQtPlusTab]);
```

- [ ] **Step 4: Pass the computed tabs to PageHeader**

Change the `PageHeader` prop (line ~192) from `tabs={TABS(projectId)}` to:

```js
        tabs={tabs}
```

- [ ] **Step 5: Render the tab content**

After the `activeTab === 'team'` content block (ends line ~387, `</ProjectTeamTab>` closing `)}`), add:

```jsx
      {activeTab === 'qtplus' && showQtPlusTab && (
        <QtPlusProjectTab
          project={project}
          orgRole={orgRole}
          currentUser={currentUser}
          allProjects={projects}
        />
      )}
```

- [ ] **Step 6: Lint the file**

Run: `cd qt-workspace && npx eslint "src/app/(app)/[projectId]/page.js"`
Expected: clean (no `react-hooks/set-state-in-effect`, no `react-hooks/exhaustive-deps` error on the new hooks/memo).

- [ ] **Step 7: Build (integration gate for the whole feature)**

Run: `cd qt-workspace && npm run build`
Expected: PASS — compiles; the new route imports (`QtPlusProjectTab` → `qtplusLinkModel.mjs`, `usePortalProjects`, `qtplusProjectLink`, `usePortalSession`) all resolve.

- [ ] **Step 8: Commit**

```bash
cd qt-workspace
git add "src/app/(app)/[projectId]/page.js"
git commit -m "feat(qtplus): add QuickTeam+ tab to the project page, gated by role/link (Phase 3)"
```

---

### Task 7: Full verification pass

**Repo:** `qt-workspace`

- [ ] **Step 1: Pure-helper test + prior logic tests green**

Run: `cd qt-workspace && npm run test:qtplus-link-model && npm run test:qtplus-exchange && npm run test:oauth-state && npm run test:secret-box`
Expected: PASS — new helper 10 tests, plus the prior Phase 1/2 logic suites still green.

- [ ] **Step 2: Build + lint clean**

Run: `cd qt-workspace && npm run build && npm run lint`
Expected: PASS — build completes; lint reports no errors on the changed/new files.

- [ ] **Step 3: Confirm no rules change and no qt change slipped in**

Run: `cd qt-workspace && git diff --name-only b477a54..HEAD -- firestore.rules` (expect empty output) and `cd ../qt && git status --short` (expect no Phase 3 changes in the provider repo).
Expected: no `firestore.rules` in the changed set; `qt` untouched.

---

## Human steps (after merge — cannot be done by an agent)

1. **No env changes.** Phase 2's public portal config is already baked into `src/lib/portal/firebase.js`; `NEXT_PUBLIC_QTPLUS_URL` is already set in prod. Nothing new.
2. **Browser E2E** (see the design doc's Testing section for the full script):
   - As a connected owner/admin: open a project → **QuickTeam+** tab → pick a project → "Привʼязано до «…»". (Also confirms the owner/admin `settings/integrations` read works.)
   - As a regular member: open the same project → read-only linked tab appears (keys off `project.qtplusLink`).
   - Unlink → picker returns for owner/admin; the member's tab disappears.
   - Toggle the org QuickTeam+ integration off (Settings → Інтеграції): the tab disappears on **unlinked** projects; a **linked** project keeps a read-only tab until unlinked (documented behavior).

---

## Self-review

**Spec coverage:**
- Data model `qtplusLink` map → Task 4 (writes) + consumed in Tasks 5/6. ✓
- Component A (`usePortalProjects` returns list) → Task 2. ✓
- Component B (`useQtPlusEnabled`) → Task 3. ✓
- Component C (pure `qtplusLinkModel.mjs`) → Task 1 (autotested). ✓
- Component D (`QtPlusProjectTab`, all states) → Task 5. ✓
- Component E (write helpers) → Task 4. ✓
- Component F (page wiring + gate + tabs array + legacy link untouched) → Task 6. ✓
- Robust gate (member path off org-settings read) → Global Constraints + Task 6 Step 3. ✓
- Testing split (pure autotest; client build+lint+E2E) → Task 1 vs Tasks 2-7 + Human steps. ✓
- No rules change / no qt change → Task 7 Step 3 guard. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every command lists expected output.

**Type consistency:** `toPortalProjectOptions(rawProjects)→[{id,name}]` and `resolveLinkView({link,options,otherLinkedIds,optionsLoaded})→{linked,linkedId,linkedName,selectedId,staleAccess,options}` are identical across Task 1 (def+tests), Task 5 (use). `usePortalProjects→{projects,count,loading,error}` matches Task 2 (def) and Task 5 (use). `useQtPlusEnabled(orgId)→{enabled,loading}` matches Task 3 (def) and Task 6 (use). `linkQtPlusProject(projectId,{id,name},uid)` / `unlinkQtPlusProject(projectId)` match Task 4 (def) and Task 5 (use). The `qtplusLink` shape written in Task 4 (`{projectId,projectName,linkedBy,linkedAt}`) matches what Task 1 reads (`link.projectId`, `link.projectName`) and Task 6 gates on (`project.qtplusLink?.projectId`).
