# Інтеграція QuickTeam Workspace ↔ QuickTeam+

**Дата:** 2026-07-15
**Статус:** дизайн затверджено, готовий до планування

## Проблема

Workspace (`qt-workspace`) і QuickTeam+ (`qt`) — два продукти однієї команди, але живуть у **різних Firebase-проєктах**:

| | Workspace | QuickTeam+ |
|---|---|---|
| Firebase project | `quickteam-me` | `quickteam-portal-prod` |
| Роль | внутрішній таск-менеджер | клієнтський портал |

Спільної бази немає — workspace не може читати проєкти/чат/етапи QT+ напряму. Потрібен міст.

Треба, щоб проєкт у workspace можна було синхронізувати з проєктом у QT+, і тоді всередині workspace з'являлись: чат QT+, етапи, матеріали й посилання на проєкт. **Без копіювання API-токенів** — один клік «Підключити».

## Ухвалені рішення

| Рішення | Вибір | Чому |
|---|---|---|
| Модель доступу | **Персональна** — кожен підключає свій акаунт QT+ | Реальна атрибуція повідомлень; доступ = те, що людині справді дозволено в QT+ |
| Обсяг | **Чат — запис, етапи/матеріали — читання** | Чат — те, заради чого перемикаються. Етапи редагують рідко → кнопка «Відкрити в QT+» |
| Немає доступу в QT+ | **Пропонувати додати команду при лінкуванні** | Робить це той, хто вже має право в QT+ → безпечно, і знімає ручну тяганину |
| Правила QT+ | **Закрити до інтеграції (Фаза 0)** | Інакше персональна модель дає ілюзію безпеки |

## ⚠️ Фаза 0 — правила безпеки QT+ (передумова)

Поточні [qt/firestore.rules](../../../../qt/firestore.rules) відкриті будь-кому залогіненому. Три критичні діри:

1. **`projects.read: if request.auth != null`** — будь-який юзер QT+ читає всі проєкти всіх клієнтів.
2. **`projects.update`** — умова `uid in request.resource.data.team` дозволяє **дописати себе в команду будь-якого проєкту** одним `updateDoc`.
3. **`tasks.read: if request.auth != null`** — коментар стверджує *«Clients NEVER access this collection»*, але правило дозволяє клієнту з порталу вичитати **всі задачі всіх організацій** workspace. Коментар описує намір, а не поведінку коду.

Стейджі, матеріали, повідомлення — так само відкриті.

**Це діра в проді вже зараз, незалежно від інтеграції.**

### Цільові правила

```js
match /projects/{projectId} {
  allow read:   if request.auth != null && request.auth.uid in resource.data.team;
  allow update: if request.auth != null && request.auth.uid in resource.data.team;
  allow delete: if request.auth != null && request.auth.uid == resource.data.ownerId;

  match /messages/{messageId} {
    allow read, create: if request.auth != null && request.auth.uid in
      get(/databases/$(database)/documents/projects/$(projectId)).data.team;
    allow delete: if request.auth != null && resource.data.senderId == request.auth.uid;
  }
}

match /stages/{stageId} {
  allow read, write: if request.auth != null && request.auth.uid in
    get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.team;
}

match /tasks/{taskId} {
  allow read, write: if false;  // цій колекції не місце в порталі
}
```

### Два наслідки, вирішені свідомо

**Invite-links зламаються.** Відкритий `read` існує саме щоб не-член команди міг зарезолвити інвайт. Заміна: серверний `POST /api/join` (Admin SDK) — резолвить інвайт і додає юзера в `team`. Обов'язково, інакше фіча інвайтів помре.

**`get()` у правилах = платні читання** — 1 read на кожну перевірку стейджа (підписка на 20 стейджів → +20 читань). Прийнятно. Альтернатива (денормалізувати `team` у стейдж) має складнішу інвалідацію — не робимо на старті.

## Фаза 1 — підключення без токенів

Authorization-code flow, обидва боки першосторонні.

```
Workspace                                    QT+
   │  «Підключити QuickTeam+»
   ├─ popup: /oauth/authorize?client_id&state&redirect_uri ─►
   │                                    │ юзер залогінений Google
   │                                    │ екран згоди
   │  ◄──────── redirect ?code&state ───┤ [Дозволити]
   │
   │  ═══ СЕРВЕР→СЕРВЕР ═══
   │  POST /api/oauth/token {code, client_secret} ──────────►
   │  ◄──────── {qtUserId, email, refreshToken} ────────────┤
   │
   └─ users/{uid}/private/qtplus  (шифрований, лише сервер)
```

**Інваріанти безпеки:**
- `code` — одноразовий, TTL 60 с, прив'язаний до `client_id`
- `state` — підписаний, звіряється в callback (без нього можливий CSRF-підсув чужого акаунта)
- `client_secret` — env workspace-сервера, **ніколи** не в браузері
- `refreshToken` — шифрований at rest, ніколи не віддається клієнту

**Прив'язка по імейлу — заборонена.** Створення орга з чужим імейлом дало б доступ до чужих проєктів (account takeover). Імейл можна лише *підказати* збіг; доступ дає тільки явна згода на боці QT+.

**Розмежування:** org-level прапорець (адмін вмикає для організації) + персональне підключення кожного учасника. Кнопка синхронізації з'являється лише коли увімкнено обидва.

## Фаза 2 — живі дані

Workspace піднімає **другий іменований Firebase-інстанс**:

```js
// src/lib/qtplus/app.js
export const qtPlusApp  = initializeApp(QT_PLUS_CONFIG, 'qtplus');
export const qtPlusAuth = getAuth(qtPlusApp);
export const qtPlusDb   = getFirestore(qtPlusApp);
```

Клієнт → наш сервер по custom token → наш сервер обмінює `refreshToken` у QT+ → `signInWithCustomToken(qtPlusAuth, token)` → далі **звичайний `onSnapshot`**. Живий чат, нуль polling, API для чату писати не треба.

### Звуження сесії клеймами

```js
createCustomToken(qtUserId, { viaWorkspace: true, scopedProject: linkedProjectId })
```

```js
allow read: if request.auth.uid in resource.data.team
  && (!('viaWorkspace' in request.auth.token)
      || projectId == request.auth.token.scopedProject);
```

Сесія, видана через workspace, дає доступ **тільки до відкритого зараз злінкованого проєкту**. Якщо workspace зламають — радіус ураження один проєкт, а не весь акаунт QT+ (де їх може бути 50).

Токен мінтиться на конкретний проєкт (не список) — уникає ліміту 1000 байт на клейми й дає найвужчий скоуп. Ціна: перемикання проєкту = новий `signInWithCustomToken` (~200 мс). Прийнятно, бо юзер дивиться один проєкт за раз.

**Чесний трейд-оф:** custom token — це повноцінна сесія QT+ у браузері. Клейми звужують її, але це сильніший примітив, ніж REST-проксі, де сервер контролює кожен байт. Обираємо його, бо реального часу чату інакше не буде без переписування; клейми закривають головний ризик.

## Фаза 3 — лінкування проєктів

### Модель даних (workspace)

```js
// projects/{projectId}
qtPlus: {
  projectId:   'abc123',      // id проєкту в QT+
  projectName: 'Сайт Acme',   // кеш для лейбла таба без зайвого раунд-тріпа
  linkedAt:    Timestamp,
  linkedBy:    uid,
}
```

### Чому пікер через REST, а не через Firebase

Scoped-токен фіксує сесію на **вже злінкованому** проєкті. Щоб *вибрати* проєкт, треба прочитати ті, що ще не злінковані — за визначенням поза скоупом. Правила Firestore не вміють обмежувати поля при читанні: читаєш документ — читаєш усі його поля.

Тому: **пікер → REST** (сервер віддає лише `id` + `name`), **перегляд → Firebase custom token**. Низькочастотні метадані через REST, високочастотні живі дані через Firebase.

### Ендпоінти

**QT+ (нові):**
| Метод | Шлях | Призначення |
|---|---|---|
| GET | `/oauth/authorize` | сторінка згоди |
| POST | `/api/oauth/token` | `code` → `{qtUserId, email, refreshToken}` |
| POST | `/api/oauth/firebase-token` | `refreshToken` → scoped custom token |
| POST | `/api/oauth/revoke` | відключення |
| GET | `/api/v1/projects` | список проєктів юзера (**лише** `id`, `name`) |
| POST | `/api/v1/projects/{id}/team` | додати учасників по імейлу |
| POST | `/api/join` | резолв інвайта (з Фази 0) |

**Workspace (нові):**
| Метод | Шлях | Призначення |
|---|---|---|
| GET | `/api/integrations/qtplus/connect` | старт flow, ставить `state`-cookie |
| GET | `/api/integrations/qtplus/callback` | обмін `code` |
| POST | `/api/integrations/qtplus/firebase-token` | scoped token для юзер+проєкт |
| GET | `/api/integrations/qtplus/projects` | проксі пікера |
| POST | `/api/integrations/qtplus/disconnect` | відв'язати акаунт |

Наслідують наявний патерн: `getAdminDb`, `enforceRateLimit`, `routeErrorResponse` із `@/lib/server/firebaseAdmin`.

### «Додати команду в QT+»

При лінкуванні workspace звіряє імейли учасників свого проєкту з командою QT+ проєкту → показує тих, кого бракує → «Додати». На боці QT+:
- імейл має акаунт → `uid` додається в `team`
- імейлу немає → створюється invitation

Дозволено лише якщо актор сам у команді QT+ проєкту.

## Фаза 4 — UI

Будуємо **на UI-кіті workspace**, не портуємо компоненти QT+ (різні дизайн-системи).

| Місце | Що |
|---|---|
| Settings → Інтеграції | картка: org-toggle (адмін) + «Підключити» (персонально) + статус |
| CreateProjectModal | «Синхронізувати з QuickTeam+» → пікер (видно якщо org увімкнено **і** юзер підключений) |
| Редагування проєкту | той самий пікер + «Відв'язати» |
| `InnerNavigation` | таб «QuickTeam+» біля Дошка/Команда/Аналітика — коли є `project.qtPlus` |
| Чат | таб біля наявного чату → чат QT+ проєкту |
| Скрізь | «Відкрити в QuickTeam+» ↗ |

Вміст таба QuickTeam+: рейка етапів + сітка матеріалів (read-only) + прогрес.

## Крайові випадки

| Ситуація | Поведінка |
|---|---|
| Юзер не підключив QT+ | таб показує «Підключити QuickTeam+» |
| Юзер підключений, але не в команді проєкту | «Немає доступу» + «Запитати доступ» |
| Злінкований проєкт видалено в QT+ | «Проєкт більше не існує» + «Відв'язати» |
| `refreshToken` відкликано | чистимо підключення, просимо перепідключитись |
| Орг вимкнув інтеграцію | таби ховаються, **лінки зберігаються** (вмикання відновлює) |
| Мінт токена | rate limit через `enforceRateLimit` |

## Тестування

**Правила (Фаза 0) — критично.** `@firebase/rules-unit-testing` на емуляторі:
- не-член команди **не** читає проєкт / стейджі / матеріали / повідомлення
- self-add у `team` заблоковано
- `tasks` недоступні з порталу взагалі
- `viaWorkspace`-токен не читає проєкт поза `scopedProject`

**OAuth:** `code` одноразовий; `code` протух → 400; `state` не збігся → відмова; `client_secret` невірний → 401.

**Інтеграційно:** лінк → таб з'явився; повідомлення з workspace долітає в QT+ з правильним автором; відв'язка ховає таб.

## Що НЕ робимо (YAGNI)

- Двостороння синхронізація задач ↔ етапів
- Завантаження матеріалів із workspace (Фаза 4 read-only)
- Редагування етапів із workspace
- Кілька QT+ проєктів на один workspace-проєкт (1:1)
- Публічна OAuth-реєстрація сторонніх клієнтів (`client_id` захардкоджений, першосторонній)

## Поза скоупом, але знайдено під час дизайну

### 🔴 `qt/clear.js` зітре продакшн workspace

`qt/serviceAccountKey.json` — ключ від **`quickteam-me`** (workspace), а не від `quickteam-portal-prod`. У git його немає й ніколи не було (`.gitignore` покриває) — витоку немає. Але його вантажать:

| Файл | Наслідок |
|---|---|
| **`qt/clear.js`** | `clearCollection('projects')` + `clearCollection('stages')` → **видалить усі проєкти всіх організацій у продакшні workspace**. Виглядає як безпечний dev-скрипт у папці порталу; не є ним. |
| `qt/src/lib/cleanup.js` | те саме джерело ключа — перевірити |
| `qt/src/app/api/chat/route.js:11` | AI-чат порталу локально читає базу workspace. У проді ключа немає → фолбек на правильний проєкт, тому баг видно лише локально. |

**Дії (окремо від інтеграції):** прибрати/перегенерувати ключ під правильний проєкт; додати в деструктивні скрипти guard на `project_id`; замінити мовчазний `try/catch` фолбек у `chat/route.js` на явну помилку — зараз він маскує неправильну конфігурацію.

### Довгостроково

Злиття в один Firebase-проєкт прибрало б увесь цей міст (один Google-логін = один uid). Велика міграція, не зараз, але це «справжній» фікс.
