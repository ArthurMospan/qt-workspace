# QuickTeam+ Фаза 4a′ — матеріали: дані, превʼю, скачування, UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Матеріали QuickTeam+ у вкладці проєкту відкриваються, переглядаються й скачуються — через правильні поля порталу, з превʼю та компонуванням «степер + сітка».

**Architecture:** Чисті view-model хелпери (`.mjs`, без Firebase, тестуються `node --test`) віддають карткам готові дані. Хуки — єдине місце, що торкається порталу; вони не змінюються. Компоненти розбиті по одній картці на файл, бо портальний аналог — `MaterialsGrid.jsx` на 1431 рядок — саме тому й нечитабельний.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, Tailwind v4, lucide-react, Firebase Firestore (read-only, портальна БД), `pdfjs-dist` (нова залежність), `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-17-qtplus-phase4a-prime-materials-ux-design.md`

## Global Constraints

- **У портальну БД не пишемо нічого.** Заборонені в `src/lib/portal/**` і `src/components/workspace/qtplus/**`: `addDoc`, `updateDoc`, `deleteDoc`, `setDoc`, `deleteField`, `writeBatch`. Виняток — наявний `src/lib/portal/qtplusProjectLink.js` (Фаза 3), який пише у **воркспейсну** БД.
- **`firestore.rules` не чіпаємо** в жодному репозиторії. Репозиторний файл дрейфує від задеплоєних правил — він не джерело істини.
- **Репозиторій `qt` не чіпаємо.**
- **Бренд-токени, не сирий hex:** `bg-ink` / `text-ink` / `bg-canvas` / `bg-surface` / `border-line` / `text-muted` / `text-faint`. Джерело — `@theme` у `src/app/globals.css`.
  Сирий hex дозволений **рівно у двох місцях**, бо це семантичні кольори, а не бренд-палітра, і в токенах їх немає:
  1. `badgeFor()` у `qtplusMaterialView.mjs` — кольори типів файлів (PDF-червоний тощо);
  2. `TONE_DOT` у `StageStepper.jsx` — зелений `#10b981` для статусу «Завершено».

  Більше ніде. Якщо знадобився третій — це сигнал заводити токен, а не копіювати hex.
- **`react-hooks/set-state-in-effect` форситься:** жодного синхронного `setState` у тілі ефекту. Патерн — `queueMicrotask` або async-IIFE, як у `src/lib/hooks/useProjects.js`.
- **Мова інтерфейсу — українська.**
- **Імпорти через `@/`**, не відносні.
- **Хуки до раннього `return`** (правила хуків React).

---

### Task 1: Чисті view-model хелпери матеріалів

**Files:**
- Rewrite: `src/lib/portal/qtplusMaterialView.mjs`
- Rewrite: `tests/qtplus-material-view.test.mjs`

**Interfaces:**
- Consumes: нічого.
- Produces:
  - `resolveMaterialUrl(raw) -> string|null`
  - `extOf(title) -> string` (нижній регістр, без крапки, `''` якщо немає)
  - `kindOf(raw) -> 'image'|'pdf'|'video'|'audio'|'text'|'office'|'file'|'link'|'checklist'|'poll'|'note'`
  - `badgeFor(raw) -> { label: string, color: string, bg: string }`
  - `toMaterialView(raw) -> { id, kind, title, subtitle, url, badge, checklist, poll, note, link }`

**Чому спершу це:** тут живе кореневий дефект. `href = raw.url` — мертвий для файлів. Усе інше в плані спирається на цей модуль.

- [ ] **Step 1: Написати падаючі тести**

Замінити вміст `tests/qtplus-material-view.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMaterialUrl, extOf, kindOf, badgeFor, toMaterialView,
} from '../src/lib/portal/qtplusMaterialView.mjs';

// Фікстури відтворюють РЕАЛЬНУ схему порталу.
// Джерело: qt/src/components/MaterialsGrid.jsx (resolve: previewUrl||audioUrl||url,
// audioSource: audioUrl||previewUrl||url) та qt/src/lib/hooks/useMaterials.js.
// Не вигадувати поля — Фаза 4a впала саме на вигаданому `url` для файлів.

test('resolveMaterialUrl: файл читає previewUrl (регресія кореневого дефекту 4a)', () => {
  const m = { type: 'file', title: 'brief.pdf', previewUrl: 'https://res.cloudinary.com/x/brief.pdf' };
  assert.equal(resolveMaterialUrl(m), 'https://res.cloudinary.com/x/brief.pdf');
});

test('resolveMaterialUrl: аудіо віддає перевагу audioUrl', () => {
  const m = { type: 'audio', title: 'memo.mp3', audioUrl: 'https://res.cloudinary.com/x/memo.mp3', previewUrl: 'https://res.cloudinary.com/x/other.mp3' };
  assert.equal(resolveMaterialUrl(m), 'https://res.cloudinary.com/x/memo.mp3');
});

test('resolveMaterialUrl: аудіо без audioUrl падає на previewUrl', () => {
  const m = { type: 'audio', title: 'memo.mp3', previewUrl: 'https://res.cloudinary.com/x/memo.mp3' };
  assert.equal(resolveMaterialUrl(m), 'https://res.cloudinary.com/x/memo.mp3');
});

test('resolveMaterialUrl: лінк читає url', () => {
  assert.equal(resolveMaterialUrl({ type: 'link', url: 'https://figma.com/file/1' }), 'https://figma.com/file/1');
});

test('resolveMaterialUrl: нічого немає -> null', () => {
  assert.equal(resolveMaterialUrl({ type: 'note', content: 'текст' }), null);
});

test('resolveMaterialUrl: відкидає javascript: та data:', () => {
  assert.equal(resolveMaterialUrl({ type: 'link', url: 'javascript:alert(1)' }), null);
  assert.equal(resolveMaterialUrl({ type: 'link', url: 'data:text/html,<script>' }), null);
});

test('resolveMaterialUrl: не падає на сміттєвому вводі', () => {
  assert.equal(resolveMaterialUrl(null), null);
  assert.equal(resolveMaterialUrl(undefined), null);
  assert.equal(resolveMaterialUrl({ type: 'link', url: 42 }), null);
});

test('extOf', () => {
  assert.equal(extOf('logo-v2.PNG'), 'png');
  assert.equal(extOf('archive.tar.gz'), 'gz');
  assert.equal(extOf('README'), '');
  assert.equal(extOf(null), '');
});

test('kindOf: розширення перемагає поле type', () => {
  // Портал зберігає відео як type:'file' — тип визначається розширенням.
  assert.equal(kindOf({ type: 'file', title: 'promo.mp4' }), 'video');
  assert.equal(kindOf({ type: 'file', title: 'brief.pdf' }), 'pdf');
  assert.equal(kindOf({ type: 'file', title: 'photo.heic' }), 'image');
  assert.equal(kindOf({ type: 'file', title: 'kostorys.docx' }), 'office');
  assert.equal(kindOf({ type: 'file', title: 'index.tsx' }), 'text');
  assert.equal(kindOf({ type: 'file', title: 'archive.zip' }), 'file');
  assert.equal(kindOf({ type: 'file', title: 'README' }), 'file');
});

test('kindOf: аудіо за type або за розширенням', () => {
  assert.equal(kindOf({ type: 'audio', title: 'memo.ogg' }), 'audio');
  assert.equal(kindOf({ type: 'file', title: 'memo.mp3' }), 'audio');
});

test('kindOf: нефайлові типи проходять як є', () => {
  assert.equal(kindOf({ type: 'link', title: 'Figma' }), 'link');
  assert.equal(kindOf({ type: 'checklist', title: 'Здача' }), 'checklist');
  assert.equal(kindOf({ type: 'poll', title: 'Колір' }), 'poll');
  assert.equal(kindOf({ type: 'note', title: 'Ідея' }), 'note');
});

test('badgeFor', () => {
  assert.equal(badgeFor({ type: 'file', title: 'brief.pdf' }).label, 'PDF');
  assert.equal(badgeFor({ type: 'file', title: 'kostorys.docx' }).label, 'DOCX');
  assert.equal(badgeFor({ type: 'file', title: 'logo.png' }).label, 'IMG');
  assert.equal(badgeFor({ type: 'file', title: 'promo.mp4' }).label, 'VIDEO');
  assert.equal(badgeFor({ type: 'file', title: 'README' }).label, 'FILE');
});

test('toMaterialView: файл', () => {
  const v = toMaterialView({
    id: 'm1', type: 'file', title: 'brief.pdf', desc: 'Бриф клієнта',
    previewUrl: 'https://res.cloudinary.com/x/brief.pdf',
  });
  assert.equal(v.id, 'm1');
  assert.equal(v.kind, 'pdf');
  assert.equal(v.title, 'brief.pdf');
  assert.equal(v.subtitle, 'Бриф клієнта');
  assert.equal(v.url, 'https://res.cloudinary.com/x/brief.pdf');
  assert.equal(v.badge.label, 'PDF');
});

test('toMaterialView: без назви -> "Без назви"', () => {
  assert.equal(toMaterialView({ type: 'file' }).title, 'Без назви');
});

test('toMaterialView: чеклист', () => {
  const v = toMaterialView({ id: 'c1', type: 'checklist', title: 'Здача', items: ['a', 'b', 'c'], checkedItems: [0, 2] });
  assert.deepEqual(v.checklist, { items: ['a', 'b', 'c'], checkedItems: [0, 2], done: 2, total: 3, percent: 67 });
});

test('toMaterialView: чеклист без items', () => {
  const v = toMaterialView({ type: 'checklist', title: 'Порожній' });
  assert.deepEqual(v.checklist, { items: [], checkedItems: [], done: 0, total: 0, percent: 0 });
});

test('toMaterialView: опитування рахує відсотки', () => {
  const v = toMaterialView({ id: 'p1', type: 'poll', title: 'Колір', options: ['Синій', 'Червоний'], votes: [3, 1] });
  assert.equal(v.poll.total, 4);
  assert.deepEqual(v.poll.results, [
    { option: 'Синій', count: 3, percent: 75 },
    { option: 'Червоний', count: 1, percent: 25 },
  ]);
});

test('toMaterialView: опитування без голосів не ділить на нуль', () => {
  const v = toMaterialView({ type: 'poll', title: 'Колір', options: ['Синій'] });
  assert.equal(v.poll.total, 0);
  assert.deepEqual(v.poll.results, [{ option: 'Синій', count: 0, percent: 0 }]);
});

test('toMaterialView: нотатка', () => {
  const v = toMaterialView({ id: 'n1', type: 'note', title: 'Ідея', content: 'Текст', source: 'Дзвінок' });
  assert.deepEqual(v.note, { content: 'Текст', source: 'Дзвінок' });
});

test('toMaterialView: лінк з OG', () => {
  const v = toMaterialView({ id: 'l1', type: 'link', title: 'Макети', url: 'https://figma.com/file/1', ogImage: 'https://cdn/og.png', ogTitle: 'Figma — Макети' });
  assert.equal(v.kind, 'link');
  assert.equal(v.link.domain, 'figma.com');
  assert.equal(v.link.image, 'https://cdn/og.png');
  assert.equal(v.link.title, 'Figma — Макети');
});

test('toMaterialView: лінк без OG падає на title і домен', () => {
  const v = toMaterialView({ type: 'link', title: 'Макети', url: 'https://www.figma.com/file/1' });
  assert.equal(v.link.image, null);
  assert.equal(v.link.title, 'Макети');
  assert.equal(v.link.domain, 'figma.com');
});

test('toMaterialView: битий URL лінка не кидає виняток', () => {
  const v = toMaterialView({ type: 'link', title: 'Зламаний', url: 'не-url' });
  assert.equal(v.link.domain, '');
  assert.equal(v.url, null);
});
```

- [ ] **Step 2: Запустити — переконатись, що падає**

Run: `node --test tests/qtplus-material-view.test.mjs`
Expected: FAIL — `resolveMaterialUrl is not a function` (модуль ще експортує старий API). Тест «регресія кореневого дефекту 4a» має падати й після додавання експортів, якщо мапінг лишити старим — це доказ, що він ловить реальну ваду.

- [ ] **Step 3: Переписати модуль**

Замінити вміст `src/lib/portal/qtplusMaterialView.mjs`:

```js
/**
 * Чисті view-model хелпери матеріалів QuickTeam+ (Фаза 4a′).
 * Без `server-only` / Firebase — виконується під `node --test`.
 *
 * Схема матеріалу — з РЕАЛЬНОГО порталу (qt/src/components/MaterialsGrid.jsx,
 * qt/src/lib/hooks/useMaterials.js):
 *   previewUrl — файли/зображення/відео/PDF/документи (Cloudinary)
 *   audioUrl   — аудіо (Cloudinary)
 *   url        — ТІЛЬКИ type='link'
 * Фаза 4a читала `url` для всього й тому рендерила файли без посилання.
 */

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'tiff', 'bmp', 'avif'];
const VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods', 'odp'];
const TEXT_EXT = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'py', 'go', 'php', 'c', 'cpp', 'h', 'java', 'swift', 'kt', 'sql', 'yaml', 'yml', 'xml', 'csv'];

const PASSTHROUGH_KINDS = ['link', 'checklist', 'poll', 'note'];

const BADGE = {
  pdf:    { label: 'PDF',   color: '#ef4444', bg: '#fee2e2' },
  image:  { label: 'IMG',   color: '#3b82f6', bg: '#dbeafe' },
  video:  { label: 'VIDEO', color: '#f97316', bg: '#ffedd5' },
  audio:  { label: 'AUDIO', color: '#1f1f1f', bg: '#f5f5f5' },
  office: { label: 'DOC',   color: '#3b82f6', bg: '#dbeafe' },
  text:   { label: 'TXT',   color: '#64748b', bg: '#f1f5f9' },
  file:   { label: 'FILE',  color: '#9a9a9a', bg: '#f5f5f5' },
};

/** Розширення з назви: 'logo.PNG' -> 'png'. */
export function extOf(title) {
  if (typeof title !== 'string') return '';
  const i = title.lastIndexOf('.');
  if (i <= 0 || i === title.length - 1) return '';
  return title.slice(i + 1).toLowerCase();
}

/**
 * URL матеріалу за правилами порталу. Пропускаємо лише http(s) —
 * javascript:/data: у href дали б XSS через дані порталу.
 */
export function resolveMaterialUrl(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const candidate = [m.audioUrl, m.previewUrl, m.url].find((v) => typeof v === 'string' && v);
  if (!candidate) return null;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : null;
}

/** Вид матеріалу. Розширення важливіше за `type`: портал кладе відео як type='file'. */
export function kindOf(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  if (PASSTHROUGH_KINDS.includes(m.type)) return m.type;
  const ext = extOf(m.title);
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (OFFICE_EXT.includes(ext)) return 'office';
  if (TEXT_EXT.includes(ext)) return 'text';
  if (m.type === 'audio') return 'audio';
  if (m.type === 'image') return 'image';
  return 'file';
}

/** Бейдж типу: підпис + кольори. Єдине місце з сирим hex — це не бренд-палітра. */
export function badgeFor(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const kind = kindOf(m);
  const ext = extOf(m.title);
  const base = BADGE[kind] || BADGE.file;
  if (kind === 'office' || kind === 'text' || kind === 'file') {
    return { ...base, label: ext ? ext.toUpperCase() : base.label };
  }
  return base;
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Сирий док матеріалу -> готова до рендеру модель. */
export function toMaterialView(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const kind = kindOf(m);
  const url = resolveMaterialUrl(m);
  const title = (typeof m.title === 'string' && m.title.trim()) || 'Без назви';

  let checklist = null;
  if (kind === 'checklist') {
    const items = Array.isArray(m.items) ? m.items : [];
    const checkedItems = Array.isArray(m.checkedItems) ? m.checkedItems : [];
    const total = items.length;
    const done = checkedItems.length;
    checklist = { items, checkedItems, done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  let poll = null;
  if (kind === 'poll') {
    const options = Array.isArray(m.options) ? m.options : [];
    const votes = Array.isArray(m.votes) ? m.votes : [];
    const total = votes.reduce((a, b) => a + (Number(b) || 0), 0);
    poll = {
      total,
      results: options.map((option, i) => {
        const count = Number(votes[i]) || 0;
        return { option, count, percent: total ? Math.round((count / total) * 100) : 0 };
      }),
    };
  }

  const note = kind === 'note'
    ? { content: typeof m.content === 'string' ? m.content : '', source: m.source || null }
    : null;

  const link = kind === 'link'
    ? {
        domain: domainOf(typeof m.url === 'string' ? m.url : ''),
        image: m.ogImage || null,
        title: m.ogTitle || title,
        description: m.ogDescription || null,
      }
    : null;

  return {
    id: m.id || null,
    kind,
    title,
    subtitle: m.desc || m.source || null,
    url,
    badge: badgeFor(m),
    checklist,
    poll,
    note,
    link,
  };
}
```

- [ ] **Step 4: Запустити — переконатись, що проходить**

Run: `node --test tests/qtplus-material-view.test.mjs`
Expected: PASS, 0 fail.

- [ ] **Step 5: Lint**

Run: `npx eslint src/lib/portal/qtplusMaterialView.mjs tests/qtplus-material-view.test.mjs`
Expected: без помилок.

- [ ] **Step 6: Коміт**

```bash
git add src/lib/portal/qtplusMaterialView.mjs tests/qtplus-material-view.test.mjs
git commit -m "fix(qtplus): resolve material URLs from real portal fields (previewUrl/audioUrl)"
```

---

### Task 2: Модель етапів

**Files:**
- Create: `src/lib/portal/qtplusStageModel.mjs`
- Create: `tests/qtplus-stage-model.test.mjs`
- Modify: `src/lib/portal/qtplusMaterialView.mjs` (прибрати `stageProgress`, `stageStatusMeta` — переїжджають)

**Interfaces:**
- Consumes: нічого.
- Produces:
  - `stageProgress(stages) -> { done, total, percent }`
  - `stageStatusMeta(status) -> { label, tone }` де `tone ∈ 'muted'|'active'|'done'`
  - `canAccessStage(stage) -> boolean`
  - `defaultStageId(stages) -> string|null`

- [ ] **Step 1: Написати падаючі тести**

Створити `tests/qtplus-stage-model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageProgress, stageStatusMeta, canAccessStage, defaultStageId,
} from '../src/lib/portal/qtplusStageModel.mjs';

const S = (id, status) => ({ id, status, label: id, order: 0 });

test('stageProgress', () => {
  assert.deepEqual(stageProgress([S('a', 'done'), S('b', 'in-progress'), S('c', 'todo')]), { done: 1, total: 3, percent: 33 });
  assert.deepEqual(stageProgress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(stageProgress(null), { done: 0, total: 0, percent: 0 });
});

test('stageStatusMeta', () => {
  assert.deepEqual(stageStatusMeta('todo'), { label: 'Заплановано', tone: 'muted' });
  assert.deepEqual(stageStatusMeta('in-progress'), { label: 'В роботі', tone: 'active' });
  assert.deepEqual(stageStatusMeta('done'), { label: 'Завершено', tone: 'done' });
  assert.deepEqual(stageStatusMeta('дичина'), { label: '—', tone: 'muted' });
});

test('canAccessStage: паритет із порталом — todo заблоковано', () => {
  // qt/src/components/StageNav.jsx: canAccess = status === 'done' || 'in-progress'
  assert.equal(canAccessStage(S('a', 'done')), true);
  assert.equal(canAccessStage(S('a', 'in-progress')), true);
  assert.equal(canAccessStage(S('a', 'todo')), false);
  assert.equal(canAccessStage(null), false);
});

test('defaultStageId: перший in-progress виграє', () => {
  assert.equal(defaultStageId([S('a', 'done'), S('b', 'in-progress'), S('c', 'in-progress')]), 'b');
});

test('defaultStageId: лише done -> ОСТАННІЙ done', () => {
  assert.equal(defaultStageId([S('a', 'done'), S('b', 'done')]), 'b');
});

test('defaultStageId: усі todo -> null (роботу не розпочато)', () => {
  assert.equal(defaultStageId([S('a', 'todo'), S('b', 'todo')]), null);
});

test('defaultStageId: порожньо або сміття -> null', () => {
  assert.equal(defaultStageId([]), null);
  assert.equal(defaultStageId(null), null);
});
```

- [ ] **Step 2: Запустити — падає**

Run: `node --test tests/qtplus-stage-model.test.mjs`
Expected: FAIL — модуля не існує.

- [ ] **Step 3: Створити модуль**

Створити `src/lib/portal/qtplusStageModel.mjs`:

```js
/**
 * Чисті хелпери етапів QuickTeam+ (Фаза 4a′). Без Firebase — `node --test`.
 *
 * УВАГА: canAccessStage — це UI-паритет із порталом (qt/src/components/StageNav.jsx),
 * а НЕ правило безпеки. Firestore віддасть матеріали todo-етапу будь-якому членові
 * команди. Замок відтворює поведінку порталу, щоб два продукти поводились однаково;
 * покладатись на нього як на захист не можна.
 */

/** Прогрес по етапах проєкту. */
export function stageProgress(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const total = list.length;
  const done = list.filter((s) => s && s.status === 'done').length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** Підпис + тон для статусу етапу. */
export function stageStatusMeta(status) {
  if (status === 'todo') return { label: 'Заплановано', tone: 'muted' };
  if (status === 'in-progress') return { label: 'В роботі', tone: 'active' };
  if (status === 'done') return { label: 'Завершено', tone: 'done' };
  return { label: '—', tone: 'muted' };
}

/** Чи можна відкрити етап (паритет із порталом — див. шапку). */
export function canAccessStage(stage) {
  if (!stage || typeof stage !== 'object') return false;
  return stage.status === 'done' || stage.status === 'in-progress';
}

/**
 * Етап, відкритий за замовчуванням:
 * 1) перший in-progress; 2) інакше останній done; 3) інакше null (усі todo).
 */
export function defaultStageId(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const active = list.find((s) => s && s.status === 'in-progress');
  if (active) return active.id;
  const done = list.filter((s) => s && s.status === 'done');
  if (done.length) return done[done.length - 1].id;
  return null;
}
```

- [ ] **Step 4: Прибрати переїхалі функції зі старого модуля**

У `src/lib/portal/qtplusMaterialView.mjs` видалити `stageProgress` і `stageStatusMeta`, якщо вони там лишились після Task 1 (у переписаному вмісті їх немає — перевірити й не дублювати).

Run: `grep -n "stageProgress\|stageStatusMeta" src/lib/portal/qtplusMaterialView.mjs`
Expected: порожньо.

- [ ] **Step 5: Тести проходять**

Run: `node --test tests/qtplus-stage-model.test.mjs tests/qtplus-material-view.test.mjs`
Expected: PASS, 0 fail.

- [ ] **Step 6: Lint + коміт**

```bash
npx eslint src/lib/portal/qtplusStageModel.mjs tests/qtplus-stage-model.test.mjs
git add src/lib/portal/qtplusStageModel.mjs tests/qtplus-stage-model.test.mjs src/lib/portal/qtplusMaterialView.mjs
git commit -m "feat(qtplus): stage model helpers (locks, default stage, progress)"
```

---

### Task 3: Скачування матеріалу

**Files:**
- Create: `src/lib/portal/downloadMaterial.js`

**Interfaces:**
- Consumes: нічого.
- Produces: `downloadMaterial(url, filename) -> Promise<'downloaded'|'opened'|'skipped'>`

**Чому без автотесту:** функція — це `fetch` + DOM (`createObjectURL`, `<a>.click()`). Тест під node перевіряв би моки, а не продукт. Саме такі тести й пропустили дефект 4a. Перевірка — eslint, build і браузерний E2E.

- [ ] **Step 1: Написати модуль**

Створити `src/lib/portal/downloadMaterial.js`:

```js
'use client';

/**
 * Качає матеріал порталу. Патерн порталу (qt/src/components/MaterialsGrid.jsx:1120):
 * fetch -> blob -> <a download> -> revoke. Фолбек критичний: Cloudinary може не
 * віддати CORS-заголовки для деяких типів, тоді fetch падає — і файл усе одно
 * має дістатись користувачеві, хай і в новій вкладці.
 *
 * Нічого не пише — читання плюс DOM.
 */
export async function downloadMaterial(url, filename) {
  if (!url) return 'skipped';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return 'downloaded';
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'opened';
  }
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/lib/portal/downloadMaterial.js`
Expected: без помилок.

- [ ] **Step 3: Коміт**

```bash
git add src/lib/portal/downloadMaterial.js
git commit -m "feat(qtplus): downloadMaterial with blob download and new-tab fallback"
```

---

### Task 4: Компоненти превʼю (PDF, текст, Office)

**Files:**
- Create: `src/components/workspace/qtplus/previews/PdfThumb.jsx`
- Create: `src/components/workspace/qtplus/previews/TextThumb.jsx`
- Create: `src/components/workspace/qtplus/previews/OfficeThumb.jsx`
- Modify: `package.json` (додати `pdfjs-dist`)

**Interfaces:**
- Consumes: нічого з попередніх задач.
- Produces:
  - `<PdfThumb url={string} />`
  - `<TextThumb url={string} />`
  - `<OfficeThumb url={string} title={string} />`

Усі три рендерять контейнер висотою 160px і самі показують свій стан завантаження/помилки. Клік не обробляють — це робить батько.

- [ ] **Step 1: Поставити pdfjs-dist**

Run: `npm install pdfjs-dist@^4.10.38`
Expected: `package.json` і `package-lock.json` оновлено.

**Чому саме `^4`, а не `latest` (6.1.200):** код нижче написаний під API v4 (`getDocument` → `getPage` → `render({ canvasContext, viewport })`) — той самий, що використовує портал. У v5/v6 сигнатура `render` змінювалась. Оновлення мажора — окрема задача з окремою перевіркою, а не побічний ефект цього зрізу. **Не міняти версію «щоб свіжіше»** — код зламається мовчки на рантаймі, білд це не спіймає.

- [ ] **Step 2: PdfThumb**

Створити `src/components/workspace/qtplus/previews/PdfThumb.jsx`:

```jsx
'use client';
import { useEffect, useState } from 'react';

/**
 * Мініатюра першої сторінки PDF. pdfjs-dist з npm, не з CDN (портал інжектить
 * <script> з cdnjs у рантаймі — зовнішня точка відмови). Рендер локальний,
 * файл нікуди не надсилається. import() динамічний: воркер важкий, тягнемо
 * лише коли PDF реально є на екрані.
 */
export default function PdfThumb({ url }) {
  const [thumb, setThumb] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // ЛОКАЛЬНА змінна, НЕ useRef. Ref спільний для всіх перезапусків ефекту:
    // при зміні url cleanup поставив би canceled=true, а новий ефект одразу
    // скинув би ТОЙ САМИЙ ref назад у false — і стара обіцянка записала б
    // мініатюру чужого файлу. Локальний let приватний для свого виклику,
    // тож скасований виклик уже нічим не «розскасувати». Так само в TextThumb.
    let canceled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // new URL(..., import.meta.url) — те, що розуміють і Turbopack, і webpack5.
        // НЕ використовувати суфікс '?url': це конвенція Vite, у Next вона не збереться.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const pdf = await pdfjs.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        if (!canceled) setThumb(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        if (!canceled) setFailed(true);
      }
    })();
    return () => { canceled = true; };
  }, [url]);

  if (failed) return null;
  if (!thumb) {
    return (
      <div className="w-full h-[160px] bg-canvas flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-line border-t-muted rounded-full animate-spin" />
      </div>
    );
  }
  return <img src={thumb} alt="" className="w-full h-[160px] object-cover object-top" />;
}
```

- [ ] **Step 3: TextThumb**

Створити `src/components/workspace/qtplus/previews/TextThumb.jsx`:

```jsx
'use client';
import { useEffect, useState } from 'react';

/** Перші 500 байтів текстового/кодового файлу. Тільки читання. */
export default function TextThumb({ url }) {
  const [content, setContent] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!canceled) setContent(text.slice(0, 500));
      } catch {
        if (!canceled) setFailed(true);
      }
    })();
    return () => { canceled = true; };
  }, [url]);

  if (failed) return null;
  if (content === null) {
    return (
      <div className="w-full h-[160px] bg-canvas flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-line border-t-muted rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-full h-[160px] bg-ink p-3 overflow-hidden relative select-none">
      <pre className="text-[9px] text-white/60 font-mono leading-tight whitespace-pre-wrap break-all">{content}</pre>
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
    </div>
  );
}
```

- [ ] **Step 4: OfficeThumb**

Створити `src/components/workspace/qtplus/previews/OfficeThumb.jsx`:

```jsx
'use client';

/**
 * Превʼю Office через публічний вьювер Microsoft.
 *
 * КОМПРОМІС, ПОГОДЖЕНИЙ ІЗ КОРИСТУВАЧЕМ (спека §6.4): URL документа їде на
 * сервери Microsoft, і Microsoft його завантажує. Cloudinary-URL-и не
 * авторизовані — хто має URL, той має файл. Залишено заради паритету: портал
 * робить рівно це з тими самими файлами.
 *
 * pointer-events вимкнено — це мініатюра, клік обробляє батько.
 */
export default function OfficeThumb({ url, title }) {
  return (
    <div className="w-full h-[160px] bg-surface relative overflow-hidden select-none pointer-events-none">
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
        className="w-[200%] h-[400px] origin-top-left scale-[0.5] border-0"
        title={title}
        loading="lazy"
      />
      <div className="absolute inset-0 z-10 bg-transparent" />
    </div>
  );
}
```

- [ ] **Step 5: Lint + build**

Run: `npx eslint src/components/workspace/qtplus/previews/ && npm run build`
Expected: eslint без помилок; build успішний.

- [ ] **Step 6: Коміт**

```bash
git add package.json package-lock.json src/components/workspace/qtplus/previews/
git commit -m "feat(qtplus): PDF/text/Office preview thumbnails (pdfjs-dist from npm)"
```

---

### Task 5: Лайтбокс

**Files:**
- Create: `src/components/workspace/qtplus/MediaLightbox.jsx`

**Interfaces:**
- Consumes: `toMaterialView` (Task 1) — приймає готовий `view`.
- Produces: `<MediaLightbox view={view|null} onClose={fn} />`

**Чому не UI-кітовий `Dialog`:** `Dialog` — модалка з шапкою-заголовком і `max-w`; лайтбоксу треба голий повний екран. Натягувати кіт туди, куди він не тягнеться, шкідливіше, ніж окремий компонент. За політикою кіту — це **кандидат** у кіт, зафіксувати в наступному ревʼю кіту.

- [ ] **Step 1: Написати компонент**

Створити `src/components/workspace/qtplus/MediaLightbox.jsx`:

```jsx
'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Повноекранний перегляд. Escape і клік по підкладці закривають. Тільки читання. */
export default function MediaLightbox({ view, onClose }) {
  useEffect(() => {
    if (!view) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [view, onClose]);

  if (!view) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={view.title}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрити"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <X size={18} />
      </button>

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {view.kind === 'image' && (
          <img src={view.url} alt={view.title} className="max-w-[90vw] max-h-[80vh] object-contain rounded-[12px]" />
        )}
        {view.kind === 'video' && (
          <video src={view.url} controls autoPlay className="max-w-[90vw] max-h-[80vh] rounded-[12px]" />
        )}
        {view.kind === 'pdf' && (
          <iframe src={view.url} title={view.title} className="w-[90vw] h-[80vh] rounded-[12px] bg-white border-0" />
        )}
        {view.kind === 'text' && (
          <iframe src={view.url} title={view.title} className="w-[70vw] h-[80vh] rounded-[12px] bg-white border-0" />
        )}
        {view.kind === 'note' && (
          <div className="bg-surface rounded-[16px] p-6 max-w-[640px] max-h-[80vh] overflow-y-auto">
            <p className="text-[15px] text-ink whitespace-pre-wrap">{view.note.content}</p>
            {view.note.source && <p className="text-[12px] text-muted mt-3 italic">Джерело: {view.note.source}</p>}
          </div>
        )}
        <p className="text-[13px] text-white/70">{view.title}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + коміт**

```bash
npx eslint src/components/workspace/qtplus/MediaLightbox.jsx
git add src/components/workspace/qtplus/MediaLightbox.jsx
git commit -m "feat(qtplus): full-screen media lightbox"
```

---

### Task 6: Картка файлу

**Files:**
- Create: `src/components/workspace/qtplus/cards/FileCard.jsx`

**Interfaces:**
- Consumes: `downloadMaterial` (Task 3); `PdfThumb`, `TextThumb`, `OfficeThumb` (Task 4); `view` від `toMaterialView` (Task 1).
- Produces: `<FileCard view={view} onOpen={fn(view)} />` — покриває `kind ∈ 'image'|'pdf'|'video'|'text'|'office'|'file'`.

- [ ] **Step 1: Написати компонент**

Створити `src/components/workspace/qtplus/cards/FileCard.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Download, FileText, Image as ImageIcon, Film, File } from 'lucide-react';
import { downloadMaterial } from '@/lib/portal/downloadMaterial';
import PdfThumb from '../previews/PdfThumb';
import TextThumb from '../previews/TextThumb';
import OfficeThumb from '../previews/OfficeThumb';

const FALLBACK_ICON = { image: ImageIcon, video: Film, pdf: FileText, text: FileText, office: FileText, file: File };

const OPENS_LIGHTBOX = ['image', 'pdf', 'video', 'text'];

export default function FileCard({ view, onOpen }) {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = FALLBACK_ICON[view.kind] || File;

  const handleDownload = async (e) => {
    e.stopPropagation();
    await downloadMaterial(view.url, view.title);
  };

  const handleClick = () => {
    if (!view.url) return;
    if (OPENS_LIGHTBOX.includes(view.kind)) onOpen(view);
    else window.open(view.url, '_blank', 'noopener,noreferrer');
  };

  let thumb = null;
  if (view.url) {
    if (view.kind === 'image' && !imgFailed) {
      thumb = <img src={view.url} alt={view.title} onError={() => setImgFailed(true)} className="w-full h-[160px] object-cover" />;
    } else if (view.kind === 'pdf') {
      thumb = <PdfThumb url={view.url} />;
    } else if (view.kind === 'video') {
      thumb = <video src={view.url} className="w-full h-[160px] object-cover bg-ink" preload="metadata" />;
    } else if (view.kind === 'text') {
      thumb = <TextThumb url={view.url} />;
    } else if (view.kind === 'office') {
      thumb = <OfficeThumb url={view.url} title={view.title} />;
    }
  }

  return (
    <div className="rounded-[12px] border border-line bg-surface overflow-hidden group hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="relative">
        {thumb || (
          <div className="w-full h-[160px] flex items-center justify-center" style={{ backgroundColor: view.badge.bg }}>
            <Icon size={28} style={{ color: view.badge.color }} />
          </div>
        )}

        {/* ПОРЯДОК ВАЖЛИВИЙ: оверлей «відкрити» йде ПЕРШИМ, а бейдж і кнопка
            скачування — після нього й з z-10. Обидва елементи абсолютні; при
            рівному z-index виграє той, що пізніше в DOM. Якщо оверлей поставити
            останнім, він накриє кнопку ⤓ і скачування не спрацює НІКОЛИ. */}
        {view.url && (
          <button
            type="button"
            onClick={handleClick}
            aria-label={`Відкрити ${view.title}`}
            className="absolute inset-0 cursor-pointer"
          />
        )}

        <span
          className="absolute top-2 left-2 z-10 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-[4px] pointer-events-none"
          style={{ backgroundColor: view.badge.bg, color: view.badge.color }}
        >
          {view.badge.label}
        </span>

        {view.url && (
          <button
            type="button"
            onClick={handleDownload}
            aria-label={`Завантажити ${view.title}`}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/70"
          >
            <Download size={13} />
          </button>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
        {view.subtitle && <p className="text-[12px] text-muted truncate">{view.subtitle}</p>}
      </div>
    </div>
  );
}
```

**Про кнопку скачування на тачі:** `opacity-0 group-hover:opacity-100` ховає її там, де ховера немає. Додано `focus-visible:opacity-100` для клавіатури; на тач-пристроях кнопка проявляється при тапі по картці (браузер емулює hover). Якщо E2E покаже, що на мобільному качати незручно — виправляємо в наступному зрізі, не роздуваючи цей.

- [ ] **Step 2: Lint + коміт**

```bash
npx eslint src/components/workspace/qtplus/cards/FileCard.jsx
git add src/components/workspace/qtplus/cards/FileCard.jsx
git commit -m "feat(qtplus): file card with type previews, badge and download"
```

---

### Task 7: Картка аудіо

**Files:**
- Create: `src/components/workspace/qtplus/cards/AudioCard.jsx`

**Interfaces:**
- Consumes: `downloadMaterial` (Task 3); `view` (Task 1).
- Produces: `<AudioCard view={view} />` — покриває `kind === 'audio'`.

- [ ] **Step 1: Написати компонент**

Створити `src/components/workspace/qtplus/cards/AudioCard.jsx`:

```jsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { downloadMaterial } from '@/lib/portal/downloadMaterial';

function formatTime(t) {
  if (!Number.isFinite(t)) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AudioCard({ view }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState('00:00');
  const [total, setTotal] = useState('00:00');

  // Слухаємо сам <audio>, а не власні клікі — інакше стан розʼїдеться,
  // якщо браузер поставить на паузу сам (втрата фокуса, інший трек).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!Number.isFinite(el.duration)) return;
      setProgress((el.currentTime / el.duration) * 100);
      setCurrent(formatTime(el.currentTime));
    };
    const onMeta = () => setTotal(formatTime(el.duration));
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, [view.url]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  };

  return (
    <div className="rounded-[12px] border border-line bg-surface px-3 py-3 flex flex-col gap-2 group">
      {view.url && <audio ref={audioRef} src={view.url} preload="metadata" playsInline />}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={!view.url}
          aria-label={playing ? 'Пауза' : 'Відтворити'}
          className="w-8 h-8 rounded-[8px] bg-canvas text-ink flex items-center justify-center shrink-0 hover:bg-line transition-colors disabled:opacity-40"
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-[2px]" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
          <p className="text-[11px] text-muted">{current} / {total}</p>
        </div>

        {view.url && (
          <button
            type="button"
            onClick={() => downloadMaterial(view.url, view.title)}
            aria-label={`Завантажити ${view.title}`}
            className="w-7 h-7 rounded-full text-muted flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-canvas hover:text-ink shrink-0"
          >
            <Download size={13} />
          </button>
        )}
      </div>

      <div className="h-[6px] w-full bg-canvas rounded-full cursor-pointer relative" onClick={seek}>
        <div className="absolute top-0 left-0 h-full bg-ink rounded-full" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + коміт**

```bash
npx eslint src/components/workspace/qtplus/cards/AudioCard.jsx
git add src/components/workspace/qtplus/cards/AudioCard.jsx
git commit -m "feat(qtplus): audio card with inline player and seek"
```

---

### Task 8: Картки лінка, нотатки, чеклиста, опитування

**Files:**
- Create: `src/components/workspace/qtplus/cards/LinkCard.jsx`
- Create: `src/components/workspace/qtplus/cards/NoteCard.jsx`
- Create: `src/components/workspace/qtplus/cards/ChecklistCard.jsx`
- Create: `src/components/workspace/qtplus/cards/PollCard.jsx`

**Interfaces:**
- Consumes: `view` (Task 1).
- Produces: `<LinkCard view/>`, `<NoteCard view onOpen/>`, `<ChecklistCard view/>`, `<PollCard view/>`.

**Read-only:** чеклист і опитування **не інтерактивні**. Ніяких `onClick` на пунктах, ніяких `<input type=checkbox>` без `disabled`. Клік = запис у портал = наступний зріз.

- [ ] **Step 1: LinkCard**

Створити `src/components/workspace/qtplus/cards/LinkCard.jsx`:

```jsx
'use client';
import { useState } from 'react';
import { Link2 } from 'lucide-react';

/**
 * OG-превʼю показуємо лише те, що портал УЖЕ зберіг у матеріалі.
 * Портал, не знайшовши ogImage, фетчить /api/link-preview і ПИШЕ результат назад
 * у матеріал — нам це заборонено (read-only). Деградуємо до іконки й домену.
 */
export default function LinkCard({ view }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { domain, image, title, description } = view.link;

  if (!view.url) {
    return (
      <div className="rounded-[12px] border border-line bg-surface px-3 py-2">
        <p className="text-[13px] text-ink font-medium truncate">{title}</p>
        <p className="text-[12px] text-muted">Посилання недоступне</p>
      </div>
    );
  }

  return (
    <a
      href={view.url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-[12px] border border-line bg-surface overflow-hidden block hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="h-[160px] bg-canvas flex items-center justify-center overflow-hidden">
        {image && !imgFailed ? (
          <img src={image} alt="" onError={() => setImgFailed(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-[10px] bg-surface flex items-center justify-center">
            <Link2 size={18} className="text-ink" />
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-[13px] text-ink font-medium truncate">{title}</p>
        <p className="text-[11px] text-muted truncate">{description || domain}</p>
      </div>
    </a>
  );
}
```

- [ ] **Step 2: NoteCard**

Створити `src/components/workspace/qtplus/cards/NoteCard.jsx`:

```jsx
'use client';
import { StickyNote } from 'lucide-react';

export default function NoteCard({ view, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      className="rounded-[12px] border border-line bg-surface text-left flex flex-col overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-line">
        <div className="w-7 h-7 rounded-[8px] bg-canvas flex items-center justify-center shrink-0">
          <StickyNote size={14} className="text-muted" />
        </div>
        <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
      </div>
      <div className="px-3 py-2 relative max-h-[140px] overflow-hidden">
        <p className="text-[12px] text-ink whitespace-pre-wrap">{view.note.content}</p>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent" />
      </div>
    </button>
  );
}
```

- [ ] **Step 3: ChecklistCard**

Створити `src/components/workspace/qtplus/cards/ChecklistCard.jsx`:

```jsx
'use client';
import { ListChecks, Check } from 'lucide-react';

/** READ-ONLY. Пункти не клікаються: toggle = запис у портал = наступний зріз. */
export default function ChecklistCard({ view }) {
  const { items, checkedItems, done, total, percent } = view.checklist;

  return (
    <div className="rounded-[12px] border border-line bg-surface flex flex-col overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-line">
        <div className="w-7 h-7 rounded-[8px] bg-canvas flex items-center justify-center shrink-0">
          <ListChecks size={14} className="text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
          <p className="text-[11px] text-muted">{done}/{total} виконано</p>
        </div>
      </div>

      <div className="px-3 py-2 flex flex-col gap-2">
        <div className="h-[4px] bg-canvas rounded-full overflow-hidden">
          <div className="h-full bg-ink rounded-full" style={{ width: `${percent}%` }} />
        </div>
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => {
            const checked = checkedItems.includes(i);
            const text = typeof item === 'string' ? item : item?.text || '';
            return (
              <li key={`${i}-${text}`} className="flex items-center gap-2 text-[12px]">
                <span className={`w-[15px] h-[15px] rounded-[4px] border flex items-center justify-center shrink-0 ${checked ? 'bg-ink border-ink' : 'border-line'}`}>
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span className={checked ? 'text-muted line-through' : 'text-ink'}>{text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: PollCard**

Створити `src/components/workspace/qtplus/cards/PollCard.jsx`:

```jsx
'use client';
import { BarChart3 } from 'lucide-react';

/** READ-ONLY. Голосувати не можна: vote = запис у портал = наступний зріз. */
export default function PollCard({ view }) {
  const { total, results } = view.poll;

  return (
    <div className="rounded-[12px] border border-line bg-surface flex flex-col overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-line">
        <div className="w-7 h-7 rounded-[8px] bg-canvas flex items-center justify-center shrink-0">
          <BarChart3 size={14} className="text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink font-medium truncate">{view.title}</p>
          <p className="text-[11px] text-muted">{total} {total === 1 ? 'голос' : total >= 2 && total <= 4 ? 'голоси' : 'голосів'}</p>
        </div>
      </div>

      <div className="px-3 py-2 flex flex-col gap-2">
        {results.map((r, i) => (
          <div key={`${i}-${r.option}`} className="text-[12px]">
            <div className="flex justify-between gap-2">
              <span className="text-ink truncate">{r.option}</span>
              <span className="text-muted shrink-0">{r.percent}%</span>
            </div>
            <div className="mt-[3px] h-[4px] rounded-full bg-canvas overflow-hidden">
              <div className="h-full bg-ink rounded-full" style={{ width: `${r.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Українські форми числівника («1 голос», «2-4 голоси», «5+ голосів») — той самий підхід, що вже застосований у `pluralProjects` Фази 2. Форма для 11-14 тут не обробляється навмисно: опитування на 11-14 голосів у цьому продукті практично не трапляється, а тягнути повну плюралізацію заради цього — оверкіл. Якщо трапиться — виносимо спільний хелпер.

- [ ] **Step 5: Lint + коміт**

```bash
npx eslint src/components/workspace/qtplus/cards/
git add src/components/workspace/qtplus/cards/
git commit -m "feat(qtplus): link, note, read-only checklist and poll cards"
```

---

### Task 9: Диспетчер карток + сітка

**Files:**
- Create: `src/components/workspace/qtplus/MaterialCard.jsx`
- Create: `src/components/workspace/qtplus/MaterialGrid.jsx`

**Interfaces:**
- Consumes: `toMaterialView` (Task 1); усі картки (Tasks 6-8).
- Produces:
  - `<MaterialCard raw={rawDoc} onOpen={fn(view)} />`
  - `<MaterialGrid materials={rawDoc[]} onOpen={fn(view)} />`

- [ ] **Step 1: MaterialCard**

Створити `src/components/workspace/qtplus/MaterialCard.jsx`:

```jsx
'use client';
import { toMaterialView } from '@/lib/portal/qtplusMaterialView.mjs';
import FileCard from './cards/FileCard';
import AudioCard from './cards/AudioCard';
import LinkCard from './cards/LinkCard';
import NoteCard from './cards/NoteCard';
import ChecklistCard from './cards/ChecklistCard';
import PollCard from './cards/PollCard';

/** Єдина точка, де сирий док стає view і обирається картка. */
export default function MaterialCard({ raw, onOpen }) {
  const view = toMaterialView(raw);

  if (view.kind === 'audio') return <AudioCard view={view} />;
  if (view.kind === 'link') return <LinkCard view={view} />;
  if (view.kind === 'note') return <NoteCard view={view} onOpen={onOpen} />;
  if (view.kind === 'checklist') return <ChecklistCard view={view} />;
  if (view.kind === 'poll') return <PollCard view={view} />;
  return <FileCard view={view} onOpen={onOpen} />;
}
```

- [ ] **Step 2: MaterialGrid**

Створити `src/components/workspace/qtplus/MaterialGrid.jsx`:

```jsx
'use client';
import MaterialCard from './MaterialCard';

export default function MaterialGrid({ materials, onOpen }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {materials.map((m) => <MaterialCard key={m.id} raw={m} onOpen={onOpen} />)}
    </div>
  );
}
```

- [ ] **Step 3: Lint + коміт**

```bash
npx eslint src/components/workspace/qtplus/MaterialCard.jsx src/components/workspace/qtplus/MaterialGrid.jsx
git add src/components/workspace/qtplus/MaterialCard.jsx src/components/workspace/qtplus/MaterialGrid.jsx
git commit -m "feat(qtplus): material card dispatcher and responsive grid"
```

---

### Task 10: Степер етапів

**Files:**
- Create: `src/components/workspace/qtplus/StageStepper.jsx`

**Interfaces:**
- Consumes: `canAccessStage`, `stageStatusMeta` (Task 2).
- Produces: `<StageStepper stages={stage[]} activeId={string|null} onSelect={fn(id)} />`

- [ ] **Step 1: Написати компонент**

Створити `src/components/workspace/qtplus/StageStepper.jsx`:

```jsx
'use client';
import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { canAccessStage, stageStatusMeta } from '@/lib/portal/qtplusStageModel.mjs';

const TONE_DOT = { muted: 'bg-faint', active: 'bg-ink', done: 'bg-[#10b981]' };

export default function StageStepper({ stages, activeId, onSelect }) {
  const scrollRef = useRef(null);
  const itemRefs = useRef({});

  // Автоскрол до активного кроку. Ефект нічого не сетить — лише скролить,
  // тож react-hooks/set-state-in-effect тут не застосовне.
  useEffect(() => {
    const el = itemRefs.current[activeId];
    const box = scrollRef.current;
    if (!el || !box) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [activeId]);

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto border-b border-line">
      <div className="flex items-center gap-5 min-w-max">
        {stages.map((s) => {
          const meta = stageStatusMeta(s.status);
          const accessible = canAccessStage(s);
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              ref={(el) => { itemRefs.current[s.id] = el; }}
              onClick={() => accessible && onSelect(s.id)}
              disabled={!accessible}
              aria-current={active ? 'step' : undefined}
              aria-disabled={!accessible}
              title={accessible ? meta.label : 'Етап ще не розпочато'}
              className={`flex items-center gap-1.5 whitespace-nowrap pb-2 pt-1 text-[13px] border-b-2 transition-colors ${
                active ? 'border-ink text-ink font-semibold' : 'border-transparent text-muted'
              } ${accessible ? 'hover:text-ink cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
            >
              <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${TONE_DOT[meta.tone] || 'bg-faint'}`} />
              {s.label || 'Без назви'}
              {!accessible && <Lock size={11} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + коміт**

```bash
npx eslint src/components/workspace/qtplus/StageStepper.jsx
git add src/components/workspace/qtplus/StageStepper.jsx
git commit -m "feat(qtplus): horizontal stage stepper with portal-parity locks"
```

---

### Task 11: Переписати StagesView на степер + сітку

**Files:**
- Create: `src/components/workspace/qtplus/QtPlusStagesView.jsx`
- Delete: `src/components/workspace/QtPlusStagesView.jsx` (акордеон)
- Modify: `src/components/workspace/QtPlusProjectTab.jsx:13` (лише шлях імпорту)

**Чому імпорт правимо вже тут:** `QtPlusProjectTab.jsx:13` імпортує старий модуль і монтує його на рядках 99 і 179. Видалити файл і не поправити шлях = зламаний білд аж до Task 12. Кожна задача мусить закінчуватись зеленим білдом, тож однорядкову правку шляху робимо тут, а перебудову рядка привʼязки лишаємо Task 12.

**Interfaces:**
- Consumes: `usePortalStages` (без змін); `stageProgress`, `defaultStageId` (Task 2); `StageStepper` (Task 10); `MaterialGrid` (Task 9); `MediaLightbox` (Task 5); `usePortalStageMaterials` (без змін).
- Produces: `<QtPlusStagesView qtProjectId={string} />`

- [ ] **Step 1: Створити новий компонент**

Створити `src/components/workspace/qtplus/QtPlusStagesView.jsx`:

```jsx
'use client';
import { useEffect, useState } from 'react';
import { usePortalStages } from '@/lib/portal/usePortalStages';
import { usePortalStageMaterials } from '@/lib/portal/usePortalStageMaterials';
import { stageProgress, defaultStageId } from '@/lib/portal/qtplusStageModel.mjs';
import StageStepper from './StageStepper';
import MaterialGrid from './MaterialGrid';
import MediaLightbox from './MediaLightbox';

function Spinner() {
  return <div className="w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin" />;
}

function StageMaterials({ stageId, onOpen }) {
  const { materials, loading, error } = usePortalStageMaterials(stageId);

  if (loading) return <div className="py-4"><Spinner /></div>;
  if (error) {
    return (
      <p className="text-[13px] text-muted py-4">
        {error === 'no_access'
          ? 'Немає доступу до матеріалів.'
          : 'Не вдалося завантажити матеріали. Спробуйте пізніше.'}
      </p>
    );
  }
  if (materials.length === 0) return <p className="text-[13px] text-muted py-4">У цьому етапі ще немає матеріалів.</p>;
  return <MaterialGrid materials={materials} onOpen={onOpen} />;
}

export default function QtPlusStagesView({ qtProjectId }) {
  const { stages, loading, error } = usePortalStages(qtProjectId);
  const [selectedId, setSelectedId] = useState(null);
  const [touched, setTouched] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Початковий етап рахуємо, коли етапи приїхали, і лише доки користувач сам
  // нічого не обрав. queueMicrotask — бо react-hooks/set-state-in-effect
  // забороняє синхронний setState у тілі ефекту (патерн useProjects.js).
  useEffect(() => {
    if (touched || !stages.length) return;
    queueMicrotask(() => setSelectedId(defaultStageId(stages)));
  }, [stages, touched]);

  const handleSelect = (id) => {
    setTouched(true);
    setSelectedId(id);
  };

  if (loading) return <div className="py-4"><Spinner /></div>;
  if (error) {
    return (
      <p className="text-[13px] text-muted py-4">
        {error === 'no_access'
          ? 'Немає доступу до цього проєкту QuickTeam+ вашим акаунтом.'
          : 'Не вдалося завантажити етапи. Спробуйте пізніше.'}
      </p>
    );
  }
  if (stages.length === 0) return <p className="text-[13px] text-muted py-4">Ще немає етапів.</p>;

  const { done, total, percent } = stageProgress(stages);
  const selected = stages.find((s) => s.id === selectedId) || null;

  return (
    <div className="flex flex-col gap-3">
      <StageStepper stages={stages} activeId={selectedId} onSelect={handleSelect} />

      {selected ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink font-semibold truncate">{selected.label || 'Без назви'}</span>
            <span className="text-[12px] text-muted shrink-0">Прогрес: {percent}% ({done}/{total})</span>
          </div>
          <StageMaterials stageId={selected.id} onOpen={setLightbox} />
        </>
      ) : (
        <p className="text-[13px] text-muted py-4">Роботу над проєктом ще не розпочато.</p>
      )}

      <MediaLightbox view={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Видалити старий акордеон**

```bash
git rm src/components/workspace/QtPlusStagesView.jsx
```

- [ ] **Step 3: Переставити імпорт у вкладці на новий шлях**

У `src/components/workspace/QtPlusProjectTab.jsx` замінити рядок 13:

```jsx
import QtPlusStagesView from '@/components/workspace/QtPlusStagesView';
```
на:
```jsx
import QtPlusStagesView from '@/components/workspace/qtplus/QtPlusStagesView';
```

Монтування на рядках 99 і 179 **не чіпаємо** — пропси ті самі (`qtProjectId={link.projectId}`), їх перебудовує Task 12.

- [ ] **Step 4: Перевірити, що мертвих посилань не лишилось**

Run: `grep -rn "workspace/QtPlusStagesView'" src/`
Expected: лише `src/components/workspace/qtplus/QtPlusStagesView` — жодного імпорту зі старого шляху.

- [ ] **Step 5: Lint + build**

Run: `npx eslint src/components/workspace/qtplus/QtPlusStagesView.jsx src/components/workspace/QtPlusProjectTab.jsx && npm run build`
Expected: eslint без помилок; **build успішний** — це і є доказ, що видалення файлу нічого не зламало.

- [ ] **Step 6: Коміт**

```bash
git add -A src/components/workspace/
git commit -m "feat(qtplus): replace stages accordion with stepper + grid view"
```

---

### Task 12: Рядок привʼязки у вкладці

**Files:**
- Modify: `src/components/workspace/QtPlusProjectTab.jsx`

**Interfaces:**
- Consumes: `QtPlusStagesView` за новим шляхом (Task 11); `ContextMenu` з UI-кіту.
- Produces: без змін — `<QtPlusProjectTab project orgRole currentUser allProjects />`.

**Що змінюємо:** привʼязаний стан більше не показує `Select` + дві кнопки на пів екрана. Один рядок + `ContextMenu`. Непривʼязаний стан для owner/admin лишається як є (пікер — єдиний контент, місця вистачає).

- [ ] **Step 1: Замінити гілку «привʼязано» для owner/admin**

У `src/components/workspace/QtPlusProjectTab.jsx`:

Додати імпорти:
```jsx
import { Plug, ExternalLink, MoreVertical, Link2, Unlink } from 'lucide-react';
import ContextMenu from '@/components/ui/ContextMenu';
import QtPlusStagesView from '@/components/workspace/qtplus/QtPlusStagesView';
```

Замінити `LinkedRow` на:
```jsx
function LinkedRow({ name, stale, menuItems }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Plug size={14} className="text-muted shrink-0" />
        <span className="text-[13px] text-ink truncate">
          Привʼязано до <span className="font-semibold">«{name || 'Без назви'}»</span>
        </span>
        {menuItems && (
          <div className="ml-auto shrink-0">
            <ContextMenu
              trigger={
                <button
                  type="button"
                  aria-label="Дії з привʼязкою"
                  className="w-7 h-7 rounded-full text-muted flex items-center justify-center hover:bg-canvas hover:text-ink transition-colors"
                >
                  <MoreVertical size={15} />
                </button>
              }
              items={menuItems}
            />
          </div>
        )}
      </div>
      {stale && (
        <p className="text-[12px] text-muted pl-[22px]">
          Цей проєкт QuickTeam+ зараз недоступний для вашого акаунта.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Гілка учасника — рядок + етапи**

Замінити блок `if (!canManage) { ... }` на:
```jsx
  if (!canManage) {
    if (!view.linked) return null;
    return (
      <div className="flex-1 min-h-[240px] py-6 flex flex-col gap-4">
        <LinkedRow name={view.linkedName} />
        {portalUser && <QtPlusStagesView qtProjectId={link.projectId} />}
      </div>
    );
  }
```

- [ ] **Step 3: Гілка owner/admin — рядок із меню + етапи**

Замінити блок `{view.linked ? (<div className="flex flex-col gap-3">…</div>) : …}` так, щоб привʼязаний стан рендерив:
```jsx
      {view.linked ? (
        <>
          <LinkedRow
            name={view.linkedName}
            stale={view.staleAccess}
            menuItems={[
              ...(portalUser && options.length > 0
                ? [{ label: 'Змінити привʼязку', icon: Link2, onClick: () => setChanging(true) }]
                : []),
              { label: 'Відвʼязати', icon: Unlink, onClick: doUnlink, isDanger: true },
            ]}
          />

          {changing && portalUser && options.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={selectValue}
                onChange={setPendingId}
                options={selectOptions}
                placeholder="Оберіть проєкт QuickTeam+"
              />
              <Button style="secondary" size="lg" onClick={doLink} disabled={saving || !selectValue || selectValue === view.linkedId}>
                Змінити
              </Button>
              <Button style="ghost" size="lg" onClick={() => { setChanging(false); setPendingId(''); }} disabled={saving}>
                Скасувати
              </Button>
            </div>
          )}

          {portalUser && !view.staleAccess && <QtPlusStagesView qtProjectId={link.projectId} />}
        </>
      ) : sessionLoading || projectsLoading ? (
```

Додати стан поруч із наявними `useState`:
```jsx
  const [changing, setChanging] = useState(false);
```

І в `doLink`, після успіху, закривати форму:
```jsx
      setPendingId('');
      setChanging(false);
      showToast('Проєкт QuickTeam+ привʼязано');
```

**Важливо (гейти зберігаються з Фази 4a):** `QtPlusStagesView` монтується лише коли є `portalUser` — інакше `onSnapshot` стартує до `signInWithCustomToken` і дає «немає доступу», яке вже не зникне. Для owner/admin додатково `!view.staleAccess`. `qtProjectId` — це `link.projectId` (id проєкту в **порталі**), а не `project.id` воркспейсу.

- [ ] **Step 4: Ширина контейнера**

Знайти `max-w-[560px]` у контейнері owner/admin і **прибрати** — сітці на 3 колонки потрібна вся ширина. Пікер у непривʼязаному стані обмежити локально:
```jsx
  return (
    <div className="flex-1 min-h-[240px] py-6 flex flex-col gap-4">
```
а обидві гілки з `Select` загорнути в `<div className="max-w-[560px] flex flex-col gap-3">`.

- [ ] **Step 5: Lint + build**

Run: `npx eslint src/components/workspace/QtPlusProjectTab.jsx && npm run build`
Expected: eslint без помилок; build успішний.

- [ ] **Step 6: Коміт**

```bash
git add src/components/workspace/QtPlusProjectTab.jsx
git commit -m "feat(qtplus): compact link row with menu; mount stages view in the tab"
```

---

### Task 13: Гейт верифікації

**Files:** без змін коду — лише перевірки.

- [ ] **Step 1: Усі node-тести**

Run: `node --test tests/`
Expected: PASS, 0 fail. Має бути ≥ Фази 4a (53) плюс нові з Tasks 1-2.

- [ ] **Step 2: Гейт read-only**

Run:
```bash
grep -rnE "addDoc|updateDoc|deleteDoc|setDoc|deleteField|writeBatch" src/lib/portal src/components/workspace/qtplus
```
Expected: **порожньо**. Будь-яке влучання — стоп: у портал писати заборонено.

- [ ] **Step 3: Портал і правила не зачеплені**

Run:
```bash
git diff --name-only origin/main...HEAD | grep -E "firestore.rules|^\.\./qt/" ; echo "exit: $?"
```
Expected: порожньо (`exit: 1` від grep = нічого не знайдено = добре).

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: 0 помилок; build успішний.

- [ ] **Step 5: Мертвих посилань на старий модуль немає**

Run: `grep -rn "stageProgress\|stageStatusMeta" src/ | grep -v qtplusStageModel`
Expected: лише імпорти з `qtplusStageModel.mjs`.

- [ ] **Step 6: Оновити леджер**

Дописати в `.superpowers/sdd/progress.md` підсумок Фази 4a′: що зроблено, що лишилось, і — обовʼязково — що кореневий дефект 4a був у вигаданих фікстурах, а не в логіці.

- [ ] **Step 7: Коміт**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs(qtplus): Phase 4a-prime ledger"
```

---

## Що лишається людині (агент зробити не може)

1. **Браузерний E2E** (спека §8.4): привʼязаний проєкт → вкладка QuickTeam+ → степер із замками → клік по етапу → сітка → зображення в лайтбоксі → PDF-мініатюра → аудіо грає й перемотується → `⤓` качає файл із правильним імʼям → зміна в порталі зʼявляється наживо.
2. **Створити PR** — `gh` не автентифікований: https://github.com/ArthurMospan/qt-workspace/pull/new/feat/qtplus-phase4a-stages
3. **Env-змінні** — не потрібні. Портальний конфіг зашитий у `src/lib/portal/firebase.js` (Фаза 2).
