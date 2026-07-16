# QuickTeam+ Фаза 0: закриття правил безпеки — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити відкриті Firestore-правила в QuickTeam+ так, щоб користувач бачив лише проєкти своєї команди — не зламавши при цьому інвайти.

**Architecture:** Спершу будуємо серверну заміну для інвайтів (`POST /api/join` на Admin SDK, який обходить правила), мігруємо на неї клієнт, і **аж тоді** закриваємо правила. Зворотний порядок зламав би інвайти в проді, бо зараз вони тримаються саме на відкритому `read`.

**Tech Stack:** Next.js 16.2.4, firebase-admin 13.8, firebase 12.12, Vitest 4.1, @firebase/rules-unit-testing 5.0, Firebase Emulator (firebase-tools 15.23)

**Репозиторій:** усі шляхи відносно `c:\Users\Arthu\QuickTeam\qt` (**не** qt-workspace).

**Спек:** [2026-07-15-quickteam-plus-integration-design.md](../specs/2026-07-15-quickteam-plus-integration-design.md)

## Global Constraints

- Цільовий Firebase-проєкт QuickTeam+ — **`quickteam-portal-prod`**. Ніколи не `quickteam-me` (це база workspace).
- Тести правил ганяються **лише на емуляторі**, ніколи проти живого проєкту.
- Admin SDK ініціалізується **тільки** з `FIREBASE_SERVICE_ACCOUNT` (env, JSON-рядок). Читання `serviceAccountKey.json` з диска — заборонено (саме воно й привело до вказівки на чужий проєкт).
- Мова UI-рядків — українська, як у наявному коді.
- Порядок деплою: **код → перевірка → правила**. Ніколи не навпаки.

## Порядок деплою (критично)

```
Task 1-4  ──► деплой коду (/api/join живий, клієнт мігрований)
                    │
                    ▼
              перевірка на проді: інвайт працює через сервер
                    │
                    ▼
Task 5-7  ──► деплой правил (firebase deploy --only firestore:rules)
```

Правила в Task 5–7 **не деплоїмо**, доки Task 4 не в проді. Інакше інвайти впадуть.

## File Structure

| Файл | Відповідальність |
|---|---|
| `firebase.json` | **Modify** — додати конфіг емулятора |
| `package.json` | **Modify** — devDeps + скрипти тестів |
| `vitest.config.js` | **Create** — node-середовище, шлях до тестів |
| `tests/rules/helpers.js` | **Create** — підняття test env, сідинг фікстур |
| `tests/rules/projects.test.js` | **Create** — тести правил проєктів/повідомлень |
| `tests/rules/stages.test.js` | **Create** — тести правил стейджів/матеріалів |
| `tests/rules/tasks.test.js` | **Create** — `tasks` недоступні з порталу |
| `tests/rules/invitations.test.js` | **Create** — тести правил інвайтів |
| `src/lib/server/firebaseAdmin.js` | **Create** — Admin SDK + guard на project_id |
| `src/lib/server/joinProject.js` | **Create** — чиста логіка приєднання (тестована) |
| `tests/server/joinProject.test.js` | **Create** — інтеграційні тести логіки на емуляторі |
| `src/app/api/join/route.js` | **Create** — HTTP-обгортка: verify token → joinProject |
| `src/app/(main)/join/page.js` | **Modify** — виклик `/api/join` замість прямих записів |
| `firestore.rules` | **Modify** — власне закриття (Task 5–7) |

Розділення `joinProject.js` (логіка) і `route.js` (HTTP) навмисне: логіку можна тестувати проти емулятора без підняття Next.js.

---

### Task 1: Тестова інфраструктура + тести, що фіксують дірки

Тести спершу **проходять** там, де мають падати — це і є доказ, що дірка існує. Після Task 5–7 вони позеленіють у правильний бік.

**Files:**
- Modify: `package.json`
- Modify: `firebase.json`
- Create: `vitest.config.js`
- Create: `tests/rules/helpers.js`
- Create: `tests/rules/projects.test.js`

**Interfaces:**
- Produces: `getTestEnv()`, `seedFixtures()`, константи `ALICE`, `BOB`, `PROJECT_ID` — використовують усі наступні тести правил.

- [ ] **Step 1: Встановити залежності**

```bash
cd c:/Users/Arthu/QuickTeam/qt
npm install --save-dev vitest@4.1.10 @firebase/rules-unit-testing@5.0.1 firebase-tools@15.23.0
```

- [ ] **Step 2: Додати скрипти в `package.json`**

Заміни блок `"scripts"` на:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "firebase emulators:exec --only firestore --project quickteam-portal-test \"vitest run\"",
    "test:rules": "firebase emulators:exec --only firestore --project quickteam-portal-test \"vitest run tests/rules\"",
    "test:server": "firebase emulators:exec --only firestore --project quickteam-portal-test \"vitest run tests/server\""
  },
```

- [ ] **Step 3: Налаштувати емулятор у `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": false
    },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 4: Створити `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
```

`fileParallelism: false` — усі файли б'ють в один емулятор і чистять дані між тестами; паралельні файли гоняли б стан один одному.

- [ ] **Step 5: Створити `tests/rules/helpers.js`**

```js
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

export const ALICE = 'alice-uid';
export const BOB = 'bob-uid';
export const PROJECT_ID = 'p1';
export const STAGE_ID = 's1';

let testEnv;

export async function getTestEnv() {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'quickteam-portal-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  }
  return testEnv;
}

export async function cleanup() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

/** Записує фікстури в обхід правил. Alice — у команді, Bob — ні. */
export async function seedFixtures() {
  const env = await getTestEnv();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'projects', PROJECT_ID), {
      name: 'Сайт Acme',
      ownerId: ALICE,
      team: [ALICE],
      teamRoles: { [ALICE]: 'owner' },
    });
    await setDoc(doc(db, 'projects', PROJECT_ID, 'messages', 'msg1'), {
      text: 'привіт команді',
      senderId: ALICE,
      role: 'user',
    });
    await setDoc(doc(db, 'stages', STAGE_ID), {
      projectId: PROJECT_ID,
      label: '01. Збір думок',
      order: 0,
    });
    await setDoc(doc(db, 'stages', STAGE_ID, 'materials', 'm1'), {
      name: 'brief.pdf',
      order: 0,
    });
    await setDoc(doc(db, 'tasks', 't1'), {
      organizationId: 'org-workspace-1',
      title: 'Внутрішня задача workspace',
    });
    await setDoc(doc(db, 'invitations', 'inv1'), {
      projectId: PROJECT_ID,
      role: 'viewer',
      createdBy: ALICE,
      active: true,
    });
  });
}
```

- [ ] **Step 6: Створити `tests/rules/projects.test.js`**

```js
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestEnv, seedFixtures, cleanup, ALICE, BOB, PROJECT_ID } from './helpers.js';

beforeEach(seedFixtures);
afterAll(cleanup);

async function dbFor(uid) {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore();
}

describe('projects: читання', () => {
  it('член команди читає проєкт', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(getDoc(doc(db, 'projects', PROJECT_ID)));
  });

  it('чужий залогінений юзер НЕ читає проєкт', async () => {
    const db = await dbFor(BOB);
    await assertFails(getDoc(doc(db, 'projects', PROJECT_ID)));
  });

  it('незалогінений НЕ читає проєкт', async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'projects', PROJECT_ID)));
  });
});

describe('projects: self-add у команду', () => {
  it('чужий юзер НЕ може дописати себе в team', async () => {
    const db = await dbFor(BOB);
    await assertFails(updateDoc(doc(db, 'projects', PROJECT_ID), {
      team: arrayUnion(BOB),
    }));
  });

  it('член команди може оновити проєкт', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(updateDoc(doc(db, 'projects', PROJECT_ID), {
      name: 'Сайт Acme v2',
    }));
  });
});

describe('projects/messages', () => {
  it('член команди читає повідомлення', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(getDoc(doc(db, 'projects', PROJECT_ID, 'messages', 'msg1')));
  });

  it('чужий юзер НЕ читає повідомлення', async () => {
    const db = await dbFor(BOB);
    await assertFails(getDoc(doc(db, 'projects', PROJECT_ID, 'messages', 'msg1')));
  });
});
```

- [ ] **Step 7: Запустити — і побачити, що дірка реальна**

Run: `npm run test:rules`

Expected: тести **падають** на всіх `assertFails` для Bob — бо поточні правила йому все дозволяють. Приблизно так:

```
FAIL  tests/rules/projects.test.js > projects: читання > чужий залогінений юзер НЕ читає проєкт
Error: Expected request to fail, but it succeeded.
```

Це і є доказ дірки, зафіксований у тесті. Тести для Alice (`assertSucceeds`) мають проходити вже зараз.

- [ ] **Step 8: Коміт**

```bash
git add package.json package-lock.json firebase.json vitest.config.js tests/
git commit -m "test: add rules test harness, documenting open-read holes as failing tests"
```

---

### Task 2: Admin SDK з guard на project_id

Це той самий guard, який не дав би `clear.js` знести базу workspace.

**Files:**
- Create: `src/lib/server/firebaseAdmin.js`
- Create: `tests/server/firebaseAdmin.test.js`

**Interfaces:**
- Produces: `getAdminDb()` → `Firestore`, `getAdminAuth()` → `Auth`, `assertServiceAccountProject(parsed, expectedProjectId)` → `void | throws`. Використовує Task 3 і Task 4.

- [ ] **Step 1: Написати падаючий тест**

Create `tests/server/firebaseAdmin.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { assertServiceAccountProject } from '../../src/lib/server/firebaseAdmin.js';

describe('assertServiceAccountProject', () => {
  it('пропускає ключ від правильного проєкту', () => {
    expect(() =>
      assertServiceAccountProject({ project_id: 'quickteam-portal-prod' }, 'quickteam-portal-prod')
    ).not.toThrow();
  });

  it('відхиляє ключ від бази workspace', () => {
    expect(() =>
      assertServiceAccountProject({ project_id: 'quickteam-me' }, 'quickteam-portal-prod')
    ).toThrow(/quickteam-me.*quickteam-portal-prod/s);
  });

  it('відхиляє ключ без project_id', () => {
    expect(() =>
      assertServiceAccountProject({}, 'quickteam-portal-prod')
    ).toThrow(/project_id/);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `npx vitest run tests/server/firebaseAdmin.test.js`
Expected: FAIL — `Failed to resolve import ... firebaseAdmin.js`

- [ ] **Step 3: Реалізувати**

> ⚠️ **Код нижче дефектний — виправлено під час виконання (коміт `bffa107`).** Рев'ю знайшло два fail-open:
> 1. `if (expectedProjectId && ...)` пропускав перевірку, коли `NEXT_PUBLIC_FIREBASE_PROJECT_ID` не заданий — тобто рівно в кейсі `node clear.js`, проти якого guard і писався.
> 2. `getApps()[0]` підхоплював чужий вже ініціалізований застосунок в обхід перевірки.
>
> Правильна поведінка: **fail closed скрізь** — кидати помилку, якщо очікуваний project id відсутній; шукати застосунок за іменем `qt-portal`, а не за індексом. Дивись фактичний `src/lib/server/firebaseAdmin.js` у репо, а не цей блок.

Create `src/lib/server/firebaseAdmin.js`:

```js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const EXPECTED_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/**
 * Не дає ініціалізуватись ключем від чужого Firebase-проєкту.
 * Саме ця перевірка ловить ключ quickteam-me, підкладений у портал.
 */
export function assertServiceAccountProject(parsed, expectedProjectId) {
  if (!parsed?.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT: у ключі відсутній project_id');
  }
  if (expectedProjectId && parsed.project_id !== expectedProjectId) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT — ключ від проєкту "${parsed.project_id}", ` +
      `а застосунок працює з "${expectedProjectId}". Відмовляюсь стартувати.`
    );
  }
}

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT містить невалідний JSON');
  }

  assertServiceAccountProject(parsed, EXPECTED_PROJECT_ID);
  return cert(parsed);
}

export function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  const credential = loadCredential();
  return initializeApp(
    credential
      ? { credential, projectId: EXPECTED_PROJECT_ID }
      : { projectId: EXPECTED_PROJECT_ID }
  );
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
```

Коли `FIREBASE_SERVICE_ACCOUNT` не заданий (емулятор, Vercel з ADC) — падаємо на `projectId`-only ініціалізацію, як робив старий код. Різниця в тому, що мовчазного `try/catch`, який ковтав неправильну конфігурацію, більше немає.

- [ ] **Step 4: Запустити — має пройти**

Run: `npx vitest run tests/server/firebaseAdmin.test.js`
Expected: PASS, 3 тести

- [ ] **Step 5: Коміт**

```bash
git add src/lib/server/firebaseAdmin.js tests/server/firebaseAdmin.test.js
git commit -m "feat: add admin SDK init with project-id guard"
```

---

### Task 3: Логіка приєднання до проєкту

**Files:**
- Create: `src/lib/server/joinProject.js`
- Create: `tests/server/joinProject.test.js`

**Interfaces:**
- Consumes: `getAdminDb()` з Task 2 (у тестах — власний admin-інстанс на емуляторі).
- Produces: `joinProject({ db, uid, userName, userAvatar, inviteId })` → `Promise<{ ok: true, projectId: string, alreadyMember: boolean } | { ok: false, code: string }>`. Коди помилок: `invalid_invite`, `invite_not_found`, `invite_inactive`, `project_not_found`. Використовує Task 4.

- [ ] **Step 1: Написати падаючі тести**

Create `tests/server/joinProject.test.js`:

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { joinProject } from '../../src/lib/server/joinProject.js';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
let app;
let db;

beforeAll(() => {
  app = initializeApp({ projectId: 'quickteam-portal-test' }, 'join-tests');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  // recursiveDelete, а не delete: видалення документа в Firestore НЕ видаляє
  // його підколекції, тож projects/p1/messages пережили б звичайну чистку
  // й текли б з тесту в тест.
  await db.recursiveDelete(db.collection('projects'));
  await db.recursiveDelete(db.collection('invitations'));
  await db.recursiveDelete(db.collection('notifications'));

  await db.collection('projects').doc('p1').set({
    name: 'Сайт Acme',
    ownerId: ALICE,
    team: [ALICE],
    teamRoles: { [ALICE]: 'owner' },
  });
  await db.collection('invitations').doc('inv1').set({
    projectId: 'p1',
    role: 'viewer',
    createdBy: ALICE,
    active: true,
  });
});

const bob = { uid: BOB, userName: 'Бор', userAvatar: null };

describe('joinProject', () => {
  it('додає юзера в команду за валідним інвайтом', async () => {
    const result = await joinProject({ db, ...bob, inviteId: 'inv1' });

    expect(result).toEqual({ ok: true, projectId: 'p1', alreadyMember: false });

    const snap = await db.collection('projects').doc('p1').get();
    expect(snap.data().team).toContain(BOB);
    expect(snap.data().teamRoles[BOB]).toBe('viewer');
  });

  it('пише системне повідомлення в чат проєкту', async () => {
    await joinProject({ db, ...bob, inviteId: 'inv1' });

    const snap = await db.collection('projects').doc('p1').collection('messages').get();
    expect(snap.size).toBe(1);
    expect(snap.docs[0].data().role).toBe('system');
    expect(snap.docs[0].data().senderId).toBe(BOB);
  });

  it('сповіщає наявних учасників, але не самого прибульця', async () => {
    await joinProject({ db, ...bob, inviteId: 'inv1' });

    const snap = await db.collection('notifications').get();
    const userIds = snap.docs.map((d) => d.data().userId);
    expect(userIds).toContain(ALICE);
    expect(userIds).not.toContain(BOB);
  });

  it('НЕ дає стати owner навіть якщо так написано в інвайті', async () => {
    await db.collection('invitations').doc('inv1').update({ role: 'owner' });

    await joinProject({ db, ...bob, inviteId: 'inv1' });

    const snap = await db.collection('projects').doc('p1').get();
    expect(snap.data().teamRoles[BOB]).toBe('viewer');
  });

  it('є ідемпотентним для того, хто вже в команді', async () => {
    const result = await joinProject({ db, uid: ALICE, userName: 'Аліса', userAvatar: null, inviteId: 'inv1' });

    expect(result).toEqual({ ok: true, projectId: 'p1', alreadyMember: true });

    const snap = await db.collection('projects').doc('p1').get();
    expect(snap.data().team).toEqual([ALICE]);

    const msgs = await db.collection('projects').doc('p1').collection('messages').get();
    expect(msgs.size).toBe(0);
  });

  it('відхиляє неактивний інвайт', async () => {
    await db.collection('invitations').doc('inv1').update({ active: false });

    const result = await joinProject({ db, ...bob, inviteId: 'inv1' });

    expect(result).toEqual({ ok: false, code: 'invite_inactive' });
  });

  it('відхиляє неіснуючий інвайт', async () => {
    const result = await joinProject({ db, ...bob, inviteId: 'nope' });
    expect(result).toEqual({ ok: false, code: 'invite_not_found' });
  });

  it('відхиляє порожній інвайт', async () => {
    const result = await joinProject({ db, ...bob, inviteId: '' });
    expect(result).toEqual({ ok: false, code: 'invalid_invite' });
  });

  it('відхиляє інвайт на видалений проєкт', async () => {
    await db.collection('projects').doc('p1').delete();

    const result = await joinProject({ db, ...bob, inviteId: 'inv1' });

    expect(result).toEqual({ ok: false, code: 'project_not_found' });
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `npm run test:server`
Expected: FAIL — `Failed to resolve import ... joinProject.js`

- [ ] **Step 3: Реалізувати**

Create `src/lib/server/joinProject.js`:

```js
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Приєднує користувача до проєкту за інвайтом.
 * Виконується Admin SDK — правила Firestore тут не діють, тому
 * кожну перевірку робимо явно.
 *
 * @returns {Promise<{ok: true, projectId: string, alreadyMember: boolean} | {ok: false, code: string}>}
 */
export async function joinProject({ db, uid, userName, userAvatar, inviteId }) {
  if (!inviteId) return { ok: false, code: 'invalid_invite' };

  const inviteSnap = await db.collection('invitations').doc(inviteId).get();
  if (!inviteSnap.exists) return { ok: false, code: 'invite_not_found' };

  const invite = inviteSnap.data();
  if (invite.active === false) return { ok: false, code: 'invite_inactive' };

  const projectRef = db.collection('projects').doc(invite.projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return { ok: false, code: 'project_not_found' };

  const project = projectSnap.data();
  const team = project.team || [];

  if (team.includes(uid)) {
    return { ok: true, projectId: invite.projectId, alreadyMember: true };
  }

  // Інвайт ніколи не робить owner, навіть якщо так записано в документі.
  const safeRole = invite.role === 'owner' ? 'viewer' : (invite.role || 'viewer');

  await projectRef.update({
    team: FieldValue.arrayUnion(uid),
    [`teamRoles.${uid}`]: safeRole,
  });

  await projectRef.collection('messages').add({
    role: 'system',
    text: 'Приєднався(лася) до команди проєкту',
    senderId: uid,
    senderName: userName || 'Учасник',
    avatarUrl: userAvatar || null,
    createdAt: FieldValue.serverTimestamp(),
  });

  const recipients = team.filter((id) => id !== uid);
  await Promise.all(
    recipients.map((userId) =>
      db.collection('notifications').add({
        userId,
        type: 'team_invite',
        text: `${userName || 'Новий користувач'} приєднався до команди проєкту "${project.name}"`,
        projectId: invite.projectId,
        projectName: project.name,
        actorName: userName || null,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  return { ok: true, projectId: invite.projectId, alreadyMember: false };
}
```

- [ ] **Step 4: Запустити — має пройти**

Run: `npm run test:server`
Expected: PASS, 9 тестів у `joinProject.test.js`

- [ ] **Step 5: Коміт**

```bash
git add src/lib/server/joinProject.js tests/server/joinProject.test.js
git commit -m "feat: add server-side joinProject logic with tests"
```

---

### Task 4: Роут `/api/join` + міграція клієнта

**Files:**
- Create: `src/app/api/join/route.js`
- Modify: `src/app/(main)/join/page.js:43-129`

**Interfaces:**
- Consumes: `getAdminDb()`, `getAdminAuth()` (Task 2); `joinProject()` (Task 3).
- Produces: `POST /api/join` — тіло `{ inviteId }`, заголовок `Authorization: Bearer <Firebase ID token>`. Відповідь `200 {projectId, alreadyMember}` або `4xx {error, code}`.

- [ ] **Step 1: Створити роут**

Create `src/app/api/join/route.js`:

```js
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import { joinProject } from '@/lib/server/joinProject';

const ERROR_STATUS = {
  invalid_invite: 400,
  invite_not_found: 404,
  invite_inactive: 410,
  project_not_found: 404,
};

const ERROR_MESSAGE = {
  invalid_invite: 'Недійсне або відсутнє посилання запрошення.',
  invite_not_found: 'Запрошення не знайдено або термін його дії закінчився.',
  invite_inactive: 'Це запрошення більше не активне. Попросіть надіслати нове.',
  project_not_found: 'Проєкт не знайдено.',
};

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Потрібна авторизація.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Сесія недійсна. Увійдіть ще раз.' }, { status: 401 });
    }

    const { inviteId } = await req.json().catch(() => ({}));

    const result = await joinProject({
      db: getAdminDb(),
      uid: decoded.uid,
      userName: decoded.name || null,
      userAvatar: decoded.picture || null,
      inviteId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: ERROR_MESSAGE[result.code], code: result.code },
        { status: ERROR_STATUS[result.code] ?? 400 }
      );
    }

    return NextResponse.json({
      projectId: result.projectId,
      alreadyMember: result.alreadyMember,
    });
  } catch (error) {
    console.error('[api/join]', error);
    return NextResponse.json({ error: 'Внутрішня помилка сервера.' }, { status: 500 });
  }
}
```

Ім'я й аватар беремо з **перевіреного токена**, а не з тіла запиту — інакше приєднатись можна було б під будь-яким іменем.

- [ ] **Step 2: Замінити логіку в клієнті**

У `src/app/(main)/join/page.js` заміни функцію `joinProject` всередині `useEffect` (рядки 43–126) на:

```js
    async function joinProject() {
      if (!inviteId) {
        setError('Недійсне або відсутнє посилання запрошення. Попросіть власника надіслати нове безпечне посилання.');
        return;
      }

      try {
        setStatus('Приєднуємо до проєкту...');

        const { getAuth } = await import('firebase/auth');
        const idToken = await getAuth().currentUser?.getIdToken();

        if (!idToken) {
          setError('Не вдалося підтвердити вхід. Спробуйте увійти ще раз.');
          return;
        }

        const res = await fetch('/api/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ inviteId }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Не вдалося приєднатися до проєкту.');
          return;
        }

        setStatus(data.alreadyMember ? 'Ви вже у команді. Перенаправлення...' : 'Успішно! Готуємо ваш доступ...');
        router.replace(`/project/${data.projectId}`);
      } catch (err) {
        console.error('Error joining project:', err);
        setError('Не вдалося приєднатися до проєкту. Можливо, посилання недійсне.');
      }
    }
```

- [ ] **Step 3: Прибрати незадіяні імпорти**

У `src/app/(main)/join/page.js:5-7` заміни:

```js
import { doc, getDoc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notifyTeam } from '@/lib/services/notificationService';
```

на:

```js
// Приєднання виконує /api/join на сервері — прямих записів у Firestore тут більше немає.
```

Штучна затримка `await new Promise(r => setTimeout(r, 1500))` теж зникає: вона існувала, щоб дочекатись синхронізації Firestore після клієнтського запису. Сервер повертає відповідь уже після коміту, тож чекати нема чого.

- [ ] **Step 4: Перевірити лінтером, що нічого не забули**

Run: `npm run lint`
Expected: без помилок. Якщо лається на невикористаний `db` чи `notifyTeam` — прибери й ці імпорти.

- [ ] **Step 5: Перевірити руками**

```bash
npm run dev
```

1. Створи проєкт, згенеруй інвайт-лінк через модалку запрошення.
2. Відкрий лінк у приватному вікні під **іншим** Google-акаунтом.
3. Очікується: приєднання спрацювало, редірект у проєкт, у чаті системне повідомлення, у власника — сповіщення.
4. Відкрий лінк вдруге тим самим акаунтом → «Ви вже у команді», дублікатів у `team` немає.

- [ ] **Step 6: Коміт**

```bash
git add src/app/api/join/route.js "src/app/(main)/join/page.js"
git commit -m "feat: move project join to server route, drop client-side writes"
```

- [ ] **Step 7: 🚀 Задеплоїти код і переконатись, що інвайти живі**

```bash
git push
```

**Дочекайся деплою й повтори перевірку зі Step 5 на проді.** Наступні задачі закривають правила — якщо `/api/join` не працює на проді, інвайти зламаються назовсім. Не йди далі, доки не переконався.

---

### Task 5: Закрити правила проєктів

**Files:**
- Modify: `firestore.rules`

Тепер тести з Task 1 мають позеленіти.

- [ ] **Step 1: Додати хелпери й переписати блок `projects`**

У `firestore.rules`, одразу після `match /databases/{database}/documents {`, додай:

```js
    // ─── Хелпери ─────────────────────────────────────────────
    function projectTeam(projectId) {
      return get(/databases/$(database)/documents/projects/$(projectId)).data.team;
    }
    function isTeamMember(projectId) {
      return request.auth != null && request.auth.uid in projectTeam(projectId);
    }
```

Заміни увесь блок `match /projects/{projectId} { ... }` (рядки 14–43) на:

```js
    match /projects/{projectId} {
      allow read:   if request.auth != null && request.auth.uid in resource.data.team;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.ownerId
                    && request.auth.uid in request.resource.data.team;
      // Приєднання за інвайтом іде через /api/join (Admin SDK), тому
      // самододавання в team тут більше не потрібне — і заборонене.
      allow update: if request.auth != null && request.auth.uid in resource.data.team;
      allow delete: if request.auth != null && request.auth.uid == resource.data.ownerId;

      match /messages/{messageId} {
        allow read:   if isTeamMember(projectId);
        allow create: if isTeamMember(projectId)
                      && request.resource.data.senderId == request.auth.uid;
        allow update: if isTeamMember(projectId);
        allow delete: if isTeamMember(projectId)
                      && resource.data.senderId == request.auth.uid;
      }

      match /typing/{userId} {
        allow read:  if isTeamMember(projectId);
        allow write: if request.auth != null && request.auth.uid == userId
                     && isTeamMember(projectId);
      }
    }
```

`create` тепер вимагає, щоб автор ставив себе і власником, і в команду — інакше можна було створити проєкт із чужим `ownerId`.

`messages.create` вимагає `senderId == uid` — раніше можна було писати в чат від чужого імені.

- [ ] **Step 2: Запустити тести**

Run: `npm run test:rules`
Expected: **PASS** — усі тести з `projects.test.js`, включно з тими, що падали в Task 1 Step 7. Тести стейджів ще не написані.

- [ ] **Step 3: Коміт**

```bash
git add firestore.rules
git commit -m "fix(security): restrict project reads to team members, block team self-add"
```

---

### Task 6: Закрити правила стейджів і матеріалів

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/stages.test.js`

- [ ] **Step 1: Написати падаючі тести**

Create `tests/rules/stages.test.js`:

```js
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv, seedFixtures, cleanup, ALICE, BOB, STAGE_ID } from './helpers.js';

beforeEach(seedFixtures);
afterAll(cleanup);

async function dbFor(uid) {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore();
}

describe('stages', () => {
  it('член команди читає стейдж', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(getDoc(doc(db, 'stages', STAGE_ID)));
  });

  it('чужий юзер НЕ читає стейдж', async () => {
    const db = await dbFor(BOB);
    await assertFails(getDoc(doc(db, 'stages', STAGE_ID)));
  });

  it('чужий юзер НЕ змінює стейдж', async () => {
    const db = await dbFor(BOB);
    await assertFails(updateDoc(doc(db, 'stages', STAGE_ID), { status: 'done' }));
  });

  it('член команди змінює стейдж', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(updateDoc(doc(db, 'stages', STAGE_ID), { status: 'done' }));
  });
});

describe('stages/materials', () => {
  it('член команди читає матеріал', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(getDoc(doc(db, 'stages', STAGE_ID, 'materials', 'm1')));
  });

  it('чужий юзер НЕ читає матеріал', async () => {
    const db = await dbFor(BOB);
    await assertFails(getDoc(doc(db, 'stages', STAGE_ID, 'materials', 'm1')));
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `npm run test:rules`
Expected: FAIL на тестах Bob — правила стейджів ще відкриті.

- [ ] **Step 3: Переписати блок `stages`**

Додай хелпер поруч із рештою:

```js
    function stageProjectId(stageId) {
      return get(/databases/$(database)/documents/stages/$(stageId)).data.projectId;
    }
```

Заміни блок `match /stages/{stageId} { ... }` на:

```js
    match /stages/{stageId} {
      allow read:   if isTeamMember(resource.data.projectId);
      allow create: if isTeamMember(request.resource.data.projectId);
      allow update: if isTeamMember(resource.data.projectId);
      allow delete: if isTeamMember(resource.data.projectId);

      match /materials/{materialId} {
        allow read, write: if isTeamMember(stageProjectId(stageId));
      }

      match /messages/{messageId} {
        allow read:   if isTeamMember(stageProjectId(stageId));
        allow create: if isTeamMember(stageProjectId(stageId))
                      && request.resource.data.senderId == request.auth.uid;
        allow update: if isTeamMember(stageProjectId(stageId));
        allow delete: if false;
      }
    }
```

Кожна перевірка матеріалу = 2 читання (`stages/{id}` + `projects/{id}`). Це усвідомлена ціна — див. спек.

- [ ] **Step 4: Запустити — має пройти**

Run: `npm run test:rules`
Expected: PASS, усі тести `projects.test.js` + `stages.test.js`

- [ ] **Step 5: Коміт**

```bash
git add firestore.rules tests/rules/stages.test.js
git commit -m "fix(security): restrict stages and materials to project team"
```

---

### Task 7: Заблокувати `tasks` і закрити інвайти

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/tasks.test.js`
- Create: `tests/rules/invitations.test.js`

- [ ] **Step 1: Написати падаючі тести**

Create `tests/rules/tasks.test.js`:

```js
import { assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv, seedFixtures, cleanup, ALICE, BOB } from './helpers.js';

beforeEach(seedFixtures);
afterAll(cleanup);

async function dbFor(uid) {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore();
}

// `tasks` — колекція workspace. У порталі до неї не має доступу НІХТО,
// включно з власниками проєктів. Раніше правило дозволяло будь-кому
// залогіненому вичитати задачі всіх організацій.
describe('tasks: недоступні з порталу', () => {
  it('чужий юзер НЕ читає задачі', async () => {
    const db = await dbFor(BOB);
    await assertFails(getDoc(doc(db, 'tasks', 't1')));
  });

  it('власник проєкту теж НЕ читає задачі', async () => {
    const db = await dbFor(ALICE);
    await assertFails(getDoc(doc(db, 'tasks', 't1')));
  });

  it('ніхто не пише задачі', async () => {
    const db = await dbFor(ALICE);
    await assertFails(setDoc(doc(db, 'tasks', 't2'), { organizationId: 'org1' }));
  });
});
```

Create `tests/rules/invitations.test.js`:

```js
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv, seedFixtures, cleanup, ALICE, BOB, PROJECT_ID } from './helpers.js';

beforeEach(seedFixtures);
afterAll(cleanup);

async function dbFor(uid) {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore();
}

describe('invitations', () => {
  it('член команди читає інвайт свого проєкту', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(getDoc(doc(db, 'invitations', 'inv1')));
  });

  it('чужий юзер НЕ читає інвайт', async () => {
    const db = await dbFor(BOB);
    await assertFails(getDoc(doc(db, 'invitations', 'inv1')));
  });

  it('член команди створює інвайт', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(addDoc(collection(db, 'invitations'), {
      projectId: PROJECT_ID,
      role: 'viewer',
      createdBy: ALICE,
      active: true,
    }));
  });

  it('чужий юзер НЕ створює інвайт у чужий проєкт', async () => {
    const db = await dbFor(BOB);
    await assertFails(addDoc(collection(db, 'invitations'), {
      projectId: PROJECT_ID,
      role: 'manager',
      createdBy: BOB,
      active: true,
    }));
  });

  it('чужий юзер НЕ деактивує інвайт', async () => {
    const db = await dbFor(BOB);
    await assertFails(updateDoc(doc(db, 'invitations', 'inv1'), { active: false }));
  });

  it('член команди деактивує інвайт', async () => {
    const db = await dbFor(ALICE);
    await assertSucceeds(updateDoc(doc(db, 'invitations', 'inv1'), { active: false }));
  });
});
```

Клієнтський `read` на інвайти лишається — модалка запрошень робить запит `where projectId == ... && role == ... && active == true`, щоб не плодити дублікати. Сам join його вже не потребує: там Admin SDK.

- [ ] **Step 2: Запустити — має впасти**

Run: `npm run test:rules`
Expected: FAIL на `tasks.test.js` і на тестах Bob в `invitations.test.js`

- [ ] **Step 3: Переписати блоки `tasks` та `invitations`**

Заміни блок `match /invitations/{inviteId} { ... }` на:

```js
    match /invitations/{inviteId} {
      allow read:   if isTeamMember(resource.data.projectId);
      allow create: if isTeamMember(request.resource.data.projectId)
                    && request.resource.data.createdBy == request.auth.uid;
      allow update: if isTeamMember(resource.data.projectId)
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['active']);
    }
```

Заміни увесь блок `match /tasks/{taskId} { ... }` (разом із вкладеним `taskComments`) на:

```js
    // Колекція workspace. Портал до неї не звертається — і не повинен.
    // Доступ у workspace йде через окремий Firebase-проєкт (quickteam-me).
    match /tasks/{taskId} {
      allow read, write: if false;
      match /taskComments/{commentId} {
        allow read, write: if false;
      }
    }
```

- [ ] **Step 4: Запустити — має пройти**

Run: `npm run test:rules`
Expected: PASS, усі 4 файли тестів правил

- [ ] **Step 5: Перевірити, що портал справді не читає `tasks`**

Run: `grep -rn "collection(db, 'tasks')\|'tasks'" src/ --include=*.js --include=*.jsx | grep -v node_modules`

Expected: **порожньо**. Якщо щось знайшлося — портал усе-таки читає `tasks`, і `allow read, write: if false` це зламає. Тоді зупинись і з'ясуй, навіщо воно там, перш ніж деплоїти правила.

- [ ] **Step 6: Коміт**

```bash
git add firestore.rules tests/rules/tasks.test.js tests/rules/invitations.test.js
git commit -m "fix(security): block workspace tasks from portal, scope invitations to team"
```

---

### Task 8: Деплой правил і перевірка на проді

**Files:** немає змін — це процедура.

- [ ] **Step 1: Переконатись, що Task 4 у проді**

Інвайти мають працювати через `/api/join` **до** зміни правил. Якщо ні — стоп.

- [ ] **Step 2: Прогнати весь набір тестів**

Run: `npm test`
Expected: PASS — усі тести правил і сервера.

- [ ] **Step 3: Перевірити, на який проєкт дивиться CLI**

```bash
firebase use
```

Expected: `quickteam-portal-prod`. **Якщо там `quickteam-me` — СТОП.** Це база workspace; деплой правил порталу туди зламає workspace.

- [ ] **Step 4: Задеплоїти правила**

```bash
firebase deploy --only firestore:rules --project quickteam-portal-prod
```

- [ ] **Step 5: Перевірити на проді**

1. Відкрити проєкт своїм акаунтом → дані на місці, чат живий, матеріали видно.
2. Іншим акаунтом (не в команді) відкрити `/project/<id>` → доступу немає.
3. Пройти інвайт-лінк новим акаунтом → приєднання працює.
4. Консоль браузера → без потоку `permission-denied` у нормальних сценаріях.

- [ ] **Step 6: Прибрати міну з `clear.js`**

Тепер, коли `FIREBASE_SERVICE_ACCOUNT` — єдине джерело кредів, локальний `serviceAccountKey.json` (ключ від `quickteam-me`) більше не потрібен і небезпечний: `node clear.js` зітре продакшн workspace.

```bash
rm serviceAccountKey.json
```

Перевір, чи `clear.js`, `link-users.js`, `src/lib/cleanup.js`, `src/lib/seed.js` ще комусь потрібні. Якщо так — переведи їх на `getAdminDb()` з Task 2 (guard на `project_id` не дасть їм піти в чужу базу). Якщо ні — видали.

Файл `src/app/api/chat/route.js:11` вантажить ключ через `eval('require')` з мовчазним фолбеком — переведи його на `getAdminDb()`:

```js
import { getAdminDb } from '@/lib/server/firebaseAdmin';
```

і прибери локальну функцію `getDb()`.

- [ ] **Step 7: Коміт**

```bash
git add -A
git commit -m "chore: drop stale service account key, route admin access through guarded helper"
```

---

## Що НЕ входить у цю фазу

- OAuth-флоу підключення (Фаза 1)
- Другий Firebase-інстанс і scoped custom tokens (Фаза 2) — **правила під `viaWorkspace` додає Фаза 2**, не цей план
- Лінкування проєктів і таби (Фази 3–4)
- Правила `notifications`: `create: if request.auth != null` дозволяє слати сповіщення будь-кому. Реальна, але менша дірка; клієнтський `pushNotification` на ній тримається, тож чіпати треба окремо й свідомо.
