# QuickTeam+ Phase 4a — Stages + Materials (read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a linked QuickTeam+ project's stages and each stage's materials, read-only and real-time, inside the QuickTeam+ tab.

**Architecture:** Workspace-only, read-only. New client hooks read the portal DB (`getPortalDb()`, Phase 2) via `onSnapshot` as the connected user — `usePortalStages(qtProjectId)` and `usePortalStageMaterials(stageId)` — authorized by QuickTeam+'s own team-membership rules. A pure helper normalizes materials/stage-progress (autotested); a `QtPlusStagesView` component renders an accordion of stages with per-stage materials by type; it mounts inside the Phase 3 `QtPlusProjectTab` linked state when a portal session exists. No writes to the portal, no `qt` change, no rules change.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase client SDK (named `qtplus-portal` app), `node --test` `.mjs`, ESLint + `next build`.

**Design doc:** `docs/superpowers/specs/2026-07-16-qtplus-phase4a-stages-materials-design.md`

## Global Constraints

- **Read-only:** no `addDoc`/`updateDoc`/`deleteDoc`/`setDoc`/`deleteField` against the portal DB anywhere in Phase 4a. Verified in Task 6.
- **Workspace-only:** no `qt` provider change, no `firestore.rules` change.
- **All portal reads** use `getPortalDb()` and `onSnapshot`; `permission-denied` is an **expected, quiet** outcome (viewer not on the QT+ team) → mapped to `error: 'no_access'`, not logged; other errors → `'read_failed'`, logged.
- **QT+ id to read** = `project.qtplusLink.projectId` (Phase 3 link).
- **Stages query** is `where('projectId','==',id) + orderBy('order','asc')` — identical to `qt/src/lib/hooks/useStages.js`, so the composite index already exists on `quickteam-portal-prod`; do not add an index.
- **Material types** (from QT+): `file`/`audio`/`image` → view kind `'file'`; `link`; `checklist` (`items`, `checkedItems`); `poll` (`options`, `votes`, `votedBy`); `note` (`content`, `source`). Unknown types render as kind `'unknown'`.
- **User-visible copy is Ukrainian.**
- **Lint rule `react-hooks/set-state-in-effect` is enforced**: never call `setState` synchronously in an effect body — the hooks below only set state inside `onSnapshot` callbacks (async) and inside `queueMicrotask` (the repo pattern in `useProjects.js`/`useQtPlusEnabled.js`).
- **Testing split:** pure helper autotested (`node --test`); client hooks/component/integration verified by `npx eslint` + `npm run build` + human browser E2E.
- Reuse Phase 2/3 unchanged: `getPortalDb()`, `usePortalSession()`, `QtPlusProjectTab.jsx`.

---

### Task 1: Pure view-model helper `qtplusMaterialView.mjs` (autotested)

**Files:**
- Create: `src/lib/portal/qtplusMaterialView.mjs`
- Test: `tests/qtplus-material-view.test.mjs`
- Modify: `package.json` (add test script)

**Interfaces:**
- Produces:
  - `toMaterialView(m) → { id, type, kind, icon, title, subtitle, href, checklist, poll, note }`
  - `stageProgress(stages) → { done, total, percent }`
  - `stageStatusMeta(status) → { label, tone }`

- [ ] **Step 1: Write the failing test**

Create `tests/qtplus-material-view.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMaterialView, stageProgress, stageStatusMeta } from '../src/lib/portal/qtplusMaterialView.mjs';

test('toMaterialView: file/audio/image -> kind file, icon = type', () => {
  assert.equal(toMaterialView({ type: 'file', title: 'a.pdf' }).kind, 'file');
  assert.equal(toMaterialView({ type: 'file' }).icon, 'file');
  assert.equal(toMaterialView({ type: 'audio' }).icon, 'audio');
  assert.equal(toMaterialView({ type: 'image' }).icon, 'image');
});

test('toMaterialView: link -> href from url, subtitle from desc', () => {
  const v = toMaterialView({ type: 'link', title: 'Pin', url: 'https://x.test', desc: 'x.test' });
  assert.equal(v.kind, 'link');
  assert.equal(v.href, 'https://x.test');
  assert.equal(v.subtitle, 'x.test');
});

test('toMaterialView: title fallback', () => {
  assert.equal(toMaterialView({ type: 'file', title: '   ' }).title, 'Без назви');
  assert.equal(toMaterialView({ type: 'file' }).title, 'Без назви');
});

test('toMaterialView: checklist shape', () => {
  const v = toMaterialView({ type: 'checklist', items: ['a', 'b'], checkedItems: [0] });
  assert.equal(v.kind, 'checklist');
  assert.deepEqual(v.checklist, { items: ['a', 'b'], checkedItems: [0] });
  assert.equal(v.poll, null);
});

test('toMaterialView: poll shape with total', () => {
  const v = toMaterialView({ type: 'poll', options: ['a', 'b'], votes: [3, 2] });
  assert.equal(v.kind, 'poll');
  assert.deepEqual(v.poll.options, ['a', 'b']);
  assert.equal(v.poll.total, 5);
});

test('toMaterialView: note shape, subtitle falls back to source', () => {
  const v = toMaterialView({ type: 'note', content: 'hi', source: 'Notion' });
  assert.equal(v.kind, 'note');
  assert.deepEqual(v.note, { content: 'hi', source: 'Notion' });
  assert.equal(v.subtitle, 'Notion');
});

test('toMaterialView: unknown type', () => {
  const v = toMaterialView({ type: 'whatever', title: 'x' });
  assert.equal(v.kind, 'unknown');
  assert.equal(v.icon, 'unknown');
});

test('toMaterialView: nullish input safe', () => {
  const v = toMaterialView(null);
  assert.equal(v.kind, 'unknown');
  assert.equal(v.title, 'Без назви');
});

test('stageProgress: empty -> 0%', () => {
  assert.deepEqual(stageProgress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(stageProgress(null), { done: 0, total: 0, percent: 0 });
});

test('stageProgress: mixed', () => {
  const s = [{ status: 'done' }, { status: 'done' }, { status: 'in-progress' }, { status: 'todo' }];
  assert.deepEqual(stageProgress(s), { done: 2, total: 4, percent: 50 });
});

test('stageStatusMeta: known + fallback', () => {
  assert.equal(stageStatusMeta('todo').label, 'Заплановано');
  assert.equal(stageStatusMeta('in-progress').label, 'В роботі');
  assert.equal(stageStatusMeta('done').label, 'Завершено');
  assert.equal(stageStatusMeta('weird').label, '—');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd qt-workspace && node --test tests/qtplus-material-view.test.mjs`
Expected: FAIL — cannot find module `../src/lib/portal/qtplusMaterialView.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/portal/qtplusMaterialView.mjs`:

```js
/**
 * Pure, dependency-free view-model helpers for the QuickTeam+ stages/materials
 * (Phase 4a). No `server-only`/Firebase import — runs under plain `node --test`.
 */

const FILE_ICON = { file: 'file', audio: 'audio', image: 'image' };

function sum(arr) {
  return (Array.isArray(arr) ? arr : []).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Normalize a raw QuickTeam+ material doc into a render-ready view model. */
export function toMaterialView(m) {
  const raw = m && typeof m === 'object' ? m : {};
  const type = typeof raw.type === 'string' ? raw.type : '';
  const title = (typeof raw.title === 'string' && raw.title.trim()) || 'Без назви';
  const subtitle = raw.desc || raw.source || null;
  const href = raw.url || null;

  let kind = 'unknown';
  let icon = 'unknown';
  if (type === 'link') { kind = 'link'; icon = 'link'; }
  else if (type === 'checklist') { kind = 'checklist'; icon = 'checklist'; }
  else if (type === 'poll') { kind = 'poll'; icon = 'poll'; }
  else if (type === 'note') { kind = 'note'; icon = 'note'; }
  else if (Object.prototype.hasOwnProperty.call(FILE_ICON, type)) { kind = 'file'; icon = FILE_ICON[type]; }

  return {
    id: raw.id || null,
    type,
    kind,
    icon,
    title,
    subtitle,
    href,
    checklist: kind === 'checklist'
      ? {
          items: Array.isArray(raw.items) ? raw.items : [],
          checkedItems: Array.isArray(raw.checkedItems) ? raw.checkedItems : [],
        }
      : null,
    poll: kind === 'poll'
      ? {
          options: Array.isArray(raw.options) ? raw.options : [],
          votes: Array.isArray(raw.votes) ? raw.votes : [],
          total: sum(raw.votes),
        }
      : null,
    note: kind === 'note'
      ? { content: typeof raw.content === 'string' ? raw.content : '', source: raw.source || null }
      : null,
  };
}

/** Overall progress across a project's stages. */
export function stageProgress(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const total = list.length;
  const done = list.filter((s) => s && s.status === 'done').length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

/** UA label + tone key for a stage status. */
export function stageStatusMeta(status) {
  if (status === 'todo') return { label: 'Заплановано', tone: 'muted' };
  if (status === 'in-progress') return { label: 'В роботі', tone: 'active' };
  if (status === 'done') return { label: 'Завершено', tone: 'done' };
  return { label: '—', tone: 'muted' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd qt-workspace && node --test tests/qtplus-material-view.test.mjs`
Expected: PASS — 11 tests.

- [ ] **Step 5: Add the test script**

In `qt-workspace/package.json` `scripts`, after `"test:qtplus-link-model": ...`, add:

```json
    "test:qtplus-material-view": "node --test tests/qtplus-material-view.test.mjs",
```

- [ ] **Step 6: Commit**

```bash
cd qt-workspace
git add src/lib/portal/qtplusMaterialView.mjs tests/qtplus-material-view.test.mjs package.json
git commit -m "feat(qtplus): pure material/stage view-model helpers (Phase 4a)"
```

---

### Task 2: `usePortalStages(qtProjectId)` — real-time stages

**Files:**
- Create: `src/lib/portal/usePortalStages.js`

**Interfaces:**
- Consumes: `getPortalDb()` from `src/lib/portal/firebase.js`.
- Produces: `usePortalStages(qtProjectId) → { stages, loading, error }`. `stages` is `[{ id, ... }]` (`[]` before first read); `error ∈ { null, 'no_access', 'read_failed' }`.

> **Testing note:** client hook (Firebase SDK); no node test. Verified by `npx eslint` here and `npm run build` in Task 5.

- [ ] **Step 1: Create the hook**

Create `src/lib/portal/usePortalStages.js`:

```js
'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getPortalDb } from '@/lib/portal/firebase';

/**
 * Real-time, read-only stages of a QuickTeam+ project, read from the portal DB
 * as the connected user. QT+ rules authorize by team membership;
 * permission-denied (viewer not on the team) is a quiet, expected outcome.
 */
export function usePortalStages(qtProjectId) {
  const [stages, setStages] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!qtProjectId) return;
    const db = getPortalDb();
    if (!db) return;

    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setStages(null); setError(null); } });

    const q = query(
      collection(db, 'stages'),
      where('projectId', '==', qtProjectId),
      orderBy('order', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (cancelled) return;
      setStages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setError(null);
    }, (err) => {
      if (cancelled) return;
      if (err.code !== 'permission-denied') {
        console.error('[qtplus] portal stages read failed:', err.message);
      }
      setError(err.code === 'permission-denied' ? 'no_access' : 'read_failed');
    });

    return () => { cancelled = true; unsub(); };
  }, [qtProjectId]);

  const loading = Boolean(qtProjectId) && stages === null && error === null;
  return { stages: stages || [], loading, error };
}
```

- [ ] **Step 2: Lint**

Run: `cd qt-workspace && npx eslint src/lib/portal/usePortalStages.js`
Expected: clean (no `react-hooks/set-state-in-effect`).

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/lib/portal/usePortalStages.js
git commit -m "feat(qtplus): usePortalStages real-time read-only stages hook (Phase 4a)"
```

---

### Task 3: `usePortalStageMaterials(stageId)` — real-time materials for one stage

**Files:**
- Create: `src/lib/portal/usePortalStageMaterials.js`

**Interfaces:**
- Consumes: `getPortalDb()`.
- Produces: `usePortalStageMaterials(stageId) → { materials, loading, error }` (same shapes/semantics as Task 2, `materials` = `[]` before first read).

> **Testing note:** client hook; verified by `npx eslint` + Task 5 build. Mounted only for the expanded stage (Task 4), so listeners stay bounded.

- [ ] **Step 1: Create the hook**

Create `src/lib/portal/usePortalStageMaterials.js`:

```js
'use client';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPortalDb } from '@/lib/portal/firebase';

/**
 * Real-time, read-only materials of one QuickTeam+ stage
 * (stages/{stageId}/materials), read from the portal DB as the connected user.
 * permission-denied is a quiet, expected outcome.
 */
export function usePortalStageMaterials(stageId) {
  const [materials, setMaterials] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!stageId) return;
    const db = getPortalDb();
    if (!db) return;

    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setMaterials(null); setError(null); } });

    const q = query(collection(db, 'stages', stageId, 'materials'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      if (cancelled) return;
      setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setError(null);
    }, (err) => {
      if (cancelled) return;
      if (err.code !== 'permission-denied') {
        console.error('[qtplus] portal materials read failed:', err.message);
      }
      setError(err.code === 'permission-denied' ? 'no_access' : 'read_failed');
    });

    return () => { cancelled = true; unsub(); };
  }, [stageId]);

  const loading = Boolean(stageId) && materials === null && error === null;
  return { materials: materials || [], loading, error };
}
```

- [ ] **Step 2: Lint**

Run: `cd qt-workspace && npx eslint src/lib/portal/usePortalStageMaterials.js`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/lib/portal/usePortalStageMaterials.js
git commit -m "feat(qtplus): usePortalStageMaterials real-time read-only materials hook (Phase 4a)"
```

---

### Task 4: `QtPlusStagesView.jsx` — the stages/materials render

**Files:**
- Create: `src/components/workspace/QtPlusStagesView.jsx`

**Interfaces:**
- Consumes: `usePortalStages` (Task 2), `usePortalStageMaterials` (Task 3), `toMaterialView`/`stageProgress`/`stageStatusMeta` (Task 1); lucide icons.
- Produces: `default export function QtPlusStagesView({ qtProjectId })`.

> **Testing note:** client component; verified by `npx eslint` + Task 5 build. Every state change is in event handlers / hooks — no `useEffect` in the component bodies here, so `set-state-in-effect` cannot trigger.

- [ ] **Step 1: Create the component**

Create `src/components/workspace/QtPlusStagesView.jsx`:

```jsx
'use client';
import { useState } from 'react';
import {
  ChevronRight, FileText, Image as ImageIcon, Music, Link2, ListChecks,
  BarChart3, StickyNote, File, Check,
} from 'lucide-react';
import { usePortalStages } from '@/lib/portal/usePortalStages';
import { usePortalStageMaterials } from '@/lib/portal/usePortalStageMaterials';
import { toMaterialView, stageProgress, stageStatusMeta } from '@/lib/portal/qtplusMaterialView.mjs';

const MATERIAL_ICON = {
  file: FileText, image: ImageIcon, audio: Music, link: Link2,
  checklist: ListChecks, poll: BarChart3, note: StickyNote, unknown: File,
};

const STATUS_DOT = { muted: 'bg-faint', active: 'bg-[#6366f1]', done: 'bg-[#10b981]' };

function Spinner() {
  return <div className="w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin" />;
}

function MaterialCard({ material }) {
  const v = toMaterialView(material);
  const Icon = MATERIAL_ICON[v.icon] || File;

  const head = (
    <div className="flex items-start gap-2">
      <Icon size={15} className="text-muted shrink-0 mt-[1px]" />
      <div className="min-w-0">
        <p className="text-[13px] text-ink font-medium truncate">{v.title}</p>
        {v.subtitle && <p className="text-[12px] text-muted truncate">{v.subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="rounded-[10px] border border-line px-3 py-2 bg-white">
      {v.href ? (
        <a href={v.href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80">
          {head}
        </a>
      ) : head}

      {v.checklist && (
        <ul className="mt-2 flex flex-col gap-1 pl-[23px]">
          {v.checklist.items.map((item, i) => {
            const checked = v.checklist.checkedItems.includes(i);
            return (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center shrink-0 ${checked ? 'bg-[#10b981] border-[#10b981]' : 'border-line bg-white'}`}>
                  {checked && <Check size={10} className="text-white" />}
                </span>
                <span className={checked ? 'text-muted line-through' : 'text-ink'}>{item}</span>
              </li>
            );
          })}
        </ul>
      )}

      {v.poll && (
        <div className="mt-2 flex flex-col gap-1 pl-[23px]">
          {v.poll.options.map((opt, i) => {
            const count = v.poll.votes[i] || 0;
            const pct = v.poll.total ? Math.round((count / v.poll.total) * 100) : 0;
            return (
              <div key={i} className="text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-ink truncate">{opt}</span>
                  <span className="text-muted shrink-0">{count}</span>
                </div>
                <div className="mt-[2px] h-[4px] rounded-full bg-canvas overflow-hidden">
                  <div className="h-full bg-[#6366f1]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {v.note && (
        <div className="mt-2 pl-[23px]">
          <p className="text-[12px] text-ink whitespace-pre-wrap">{v.note.content}</p>
          {v.note.source && <p className="text-[11px] text-muted mt-1">{v.note.source}</p>}
        </div>
      )}
    </div>
  );
}

function StageMaterials({ stageId }) {
  const { materials, loading, error } = usePortalStageMaterials(stageId);
  if (loading) return <div className="py-2 pl-1"><Spinner /></div>;
  if (error) return <p className="text-[12px] text-muted py-2 pl-1">Немає доступу до матеріалів.</p>;
  if (materials.length === 0) return <p className="text-[12px] text-muted py-2 pl-1">Ще немає матеріалів.</p>;
  return (
    <div className="flex flex-col gap-2 py-2">
      {materials.map((m) => <MaterialCard key={m.id} material={m} />)}
    </div>
  );
}

export default function QtPlusStagesView({ qtProjectId }) {
  const { stages, loading, error } = usePortalStages(qtProjectId);
  const [expanded, setExpanded] = useState(null);

  if (loading) return <div className="py-3"><Spinner /></div>;
  if (error) return <p className="text-[13px] text-muted py-3">Немає доступу до цього проєкту QuickTeam+ вашим акаунтом.</p>;
  if (stages.length === 0) return <p className="text-[13px] text-muted py-3">Ще немає етапів.</p>;

  const { done, total, percent } = stageProgress(stages);

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink font-semibold">Етапи</span>
        <span className="text-[12px] text-muted">Прогрес: {percent}% ({done}/{total})</span>
      </div>

      <div className="flex flex-col gap-1">
        {stages.map((s) => {
          const meta = stageStatusMeta(s.status);
          const open = expanded === s.id;
          return (
            <div key={s.id} className="rounded-[10px] border border-line overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : s.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-canvas text-left"
              >
                <ChevronRight size={14} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                <span className="text-[13px] text-ink font-medium truncate flex-1">{s.label}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className={`w-[6px] h-[6px] rounded-full ${STATUS_DOT[meta.tone] || 'bg-faint'}`} />
                  <span className="text-[11px] text-muted">{meta.label}</span>
                </span>
              </button>
              {open && (
                <div className="px-3 pb-1 border-t border-line">
                  <StageMaterials stageId={s.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `cd qt-workspace && npx eslint src/components/workspace/QtPlusStagesView.jsx`
Expected: clean (no unused imports; all lucide names resolve — verified by build in Task 5).

- [ ] **Step 3: Commit**

```bash
cd qt-workspace
git add src/components/workspace/QtPlusStagesView.jsx
git commit -m "feat(qtplus): QtPlusStagesView read-only stages + materials accordion (Phase 4a)"
```

---

### Task 5: Mount the stages view in `QtPlusProjectTab.jsx`

**Files:**
- Modify: `src/components/workspace/QtPlusProjectTab.jsx`

**Interfaces:**
- Consumes: `QtPlusStagesView` (Task 4). Uses existing `portalUser`, `view`, `link` in the component.
- Produces: no new exports.

> **Testing note:** integration point — first place `QtPlusStagesView` (and Tasks 1–4) is imported, so `npm run build` here validates the whole Phase 4a import graph. Verified by `npx eslint` + `npm run build`.

- [ ] **Step 1: Add the import**

In `src/components/workspace/QtPlusProjectTab.jsx`, after the existing import line
`import { linkQtPlusProject, unlinkQtPlusProject } from '@/lib/portal/qtplusProjectLink';`, add:

```js
import QtPlusStagesView from '@/components/workspace/QtPlusStagesView';
```

- [ ] **Step 2: Render in the member (read-only) linked branch**

Replace the member early-return block — currently:

```jsx
  if (!canManage) {
    if (!view.linked) return null;
    return (
      <div className="flex-1 min-h-[240px] py-6">
        <LinkedRow name={view.linkedName} readOnly />
      </div>
    );
  }
```

with:

```jsx
  if (!canManage) {
    if (!view.linked) return null;
    return (
      <div className="flex-1 min-h-[240px] py-6 flex flex-col gap-4">
        <LinkedRow name={view.linkedName} readOnly />
        {portalUser && <QtPlusStagesView qtProjectId={link.projectId} />}
      </div>
    );
  }
```

- [ ] **Step 3: Render in the owner/admin linked branch**

In the owner/admin `return`, the outer container is
`<div className="flex-1 min-h-[240px] py-6 max-w-[560px] flex flex-col gap-4">` and its last child is the `view.linked ? ( … ) : … ` ternary. Immediately **after that ternary closes** and **before the container's closing `</div>`**, add:

```jsx
      {view.linked && portalUser && <QtPlusStagesView qtProjectId={link.projectId} />}
```

(For reference, this sits between the `)}` that closes the big `view.linked ? (...) : (...)` expression and the final `</div>` of the owner/admin return.)

- [ ] **Step 4: Lint**

Run: `cd qt-workspace && npx eslint src/components/workspace/QtPlusProjectTab.jsx`
Expected: clean.

- [ ] **Step 5: Build (integration gate)**

Run: `cd qt-workspace && npm run build`
Expected: PASS — compiles; all Phase 4a imports resolve (`QtPlusStagesView` → the two portal hooks → `qtplusMaterialView.mjs`; the lucide icon names all exist).

- [ ] **Step 6: Commit**

```bash
cd qt-workspace
git add src/components/workspace/QtPlusProjectTab.jsx
git commit -m "feat(qtplus): show QuickTeam+ stages/materials in the linked tab (Phase 4a)"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Pure-helper test + prior logic suites**

Run: `cd qt-workspace && npm run test:qtplus-material-view && npm run test:qtplus-link-model && npm run test:qtplus-exchange && npm run test:oauth-state && npm run test:secret-box`
Expected: PASS — new helper 11 tests, plus prior suites green.

- [ ] **Step 2: Build + lint**

Run: `cd qt-workspace && npm run build && npm run lint`
Expected: PASS — build completes; lint clean on the changed/new files.

- [ ] **Step 3: Confirm READ-ONLY (no portal writes) + no rules/qt change**

Run: `cd qt-workspace && grep -rnE "addDoc|updateDoc|deleteDoc|setDoc|deleteField" src/lib/portal/usePortalStages.js src/lib/portal/usePortalStageMaterials.js src/lib/portal/qtplusMaterialView.mjs src/components/workspace/QtPlusStagesView.jsx`
Expected: **no matches** — Phase 4a writes nothing to the portal.
Run: `cd qt-workspace && git diff --name-only origin/main..HEAD -- firestore.rules` (expect empty) and confirm the `qt` repo is untouched.

---

## Human steps (after merge — cannot be done by an agent)

1. **No env changes.** Portal config baked in since Phase 2.
2. **Browser E2E:** on a linked project, as a QuickTeam+ team member of the linked project, open the **QuickTeam+** tab → see the stage list + "Прогрес: N%"; expand a stage → its materials by type (file/link/checklist/poll/note); make a change in the portal and watch it appear live. A viewer without QT+ access to that project still sees only the Phase 3 "Привʼязано до «…»" row.

---

## Self-review

**Spec coverage:**
- Component A (`usePortalStages`) → Task 2. ✓
- Component B (`usePortalStageMaterials`) → Task 3. ✓
- Component C (pure `qtplusMaterialView.mjs`) → Task 1 (autotested). ✓
- Component D (`QtPlusStagesView`) → Task 4. ✓
- Component E (integration into `QtPlusProjectTab`) → Task 5. ✓
- Read-only guarantee → Task 6 Step 3 grep. ✓
- Access/visibility (portal-session gating, `no_access` state) → hooks' error mapping + Task 4 states. ✓
- Testing split → Task 1 (autotest) vs Tasks 2–6 (eslint/build/E2E). ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every command lists expected output.

**Type consistency:** `toMaterialView(m) → { kind, icon, title, subtitle, href, checklist, poll, note }` matches Task 4's use (`v.kind`/`v.icon`/`v.href`/`v.checklist`/`v.poll`/`v.note`). `stageProgress → { done, total, percent }` and `stageStatusMeta → { label, tone }` match Task 4. `usePortalStages → { stages, loading, error }` and `usePortalStageMaterials → { materials, loading, error }` match Task 4's destructuring. `QtPlusStagesView({ qtProjectId })` matches Task 5's `<QtPlusStagesView qtProjectId={link.projectId} />`. `STATUS_DOT` tone keys (`muted`/`active`/`done`) match `stageStatusMeta`'s `tone`.
