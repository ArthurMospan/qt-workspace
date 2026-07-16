# Task 5 — Закрити правила проєктів: звіт

**Гілка:** `security/phase0-firestore-rules` · **Репо:** `c:\Users\Arthu\QuickTeam\qt`
**Правила НЕ деплоїлись** (`firebase deploy` не запускався) — деплой лишається за Task 8.
Тести ганялись лише на емуляторі, проєкт `quickteam-portal-test`. `quickteam-me` не зачіпався.

## Підсумок

Реалізовано Task 5 плану + Addition A (ескалація привілеїв через `update`) + Addition B (тести на `create`).
Під час перевірки знайдено **третю проблему, якої не було в завданні**: обмеження полів ламало
легітимний флоу «Залишити проєкт». Виправлено окремою гілкою `isSelfRemoval()` — деталі нижче.

Фінально: **47 тестів проходять** (23 rules + 24 server), 0 падінь.
Три «дірочні» тести з Task 1 позеленіли **без послаблення** — жоден із них не видалений і не змінений.

## Фінальні правила (`firestore.rules`)

```js
    // ─── Хелпери ─────────────────────────────────────────────
    function projectTeam(projectId) {
      return get(/databases/$(database)/documents/projects/$(projectId)).data.team;
    }
    function isTeamMember(projectId) {
      return request.auth != null && request.auth.uid in projectTeam(projectId);
    }

    // Поля, які визначають, хто в проєкті і з якими правами.
    function touchesMembership() {
      return request.resource.data.diff(resource.data).affectedKeys()
               .hasAny(['team', 'teamRoles', 'ownerId']);
    }

    // «Залишити проєкт»: учасник прибирає з team рівно себе і рівно свою роль.
    // Ownerʼа не чіпає, чужих ролей не чіпає, себе не підвищує.
    function isSelfRemoval() {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ownerId'])
             && request.resource.data.team == resource.data.team.removeAll([request.auth.uid])
             && !(request.auth.uid in request.resource.data.get('teamRoles', {}))
             && request.resource.data.get('teamRoles', {})
                  .diff(resource.data.get('teamRoles', {}))
                  .affectedKeys().hasOnly([request.auth.uid]);
    }

    match /projects/{projectId} {
      allow read:   if request.auth != null && request.auth.uid in resource.data.team;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.ownerId
                    && request.auth.uid in request.resource.data.team;
      allow update: if request.auth != null
                    && request.auth.uid in resource.data.team
                    && (
                      request.auth.uid == resource.data.ownerId
                      || !touchesMembership()
                      || isSelfRemoval()
                    );
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

## Доказ, що дірки реальні (RED)

### 1. Базова лінія — правила до змін

```
 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
```
Три відомі дірки з Task 1 (`projects` read, self-add у team, `messages` read).

### 2. Нові тести проти ПОТОЧНИХ правил — 11 падінь

```
× чужий залогінений юзер НЕ читає проєкт
× чужий юзер НЕ може дописати себе в team
× чужий юзер НЕ читає повідомлення
× учасник-НЕвласник НЕ підвищує себе до owner через teamRoles
× учасник-НЕвласник НЕ перезаписує teamRoles цілком
× учасник-НЕвласник НЕ понижує роль власника
× учасник-НЕвласник НЕ перехоплює ownerId
× учасник-НЕвласник НЕ дописує сторонніх у team
× учасник-НЕвласник НЕ викидає власника з team
× НЕ створює проєкт із підробленим ownerId
× НЕ створює проєкт, у команді якого немає автора
 Tests  11 failed | 8 passed (19)
```

### 3. Ключовий доказ — нові тести проти НАЇВНОГО правила з плану

Застосовано блок `projects` рівно так, як написано в плані
(`allow update: if request.auth != null && request.auth.uid in resource.data.team;`):

```
× учасник-НЕвласник НЕ підвищує себе до owner через teamRoles
× учасник-НЕвласник НЕ перезаписує teamRoles цілком
× учасник-НЕвласник НЕ понижує роль власника
× учасник-НЕвласник НЕ перехоплює ownerId
× учасник-НЕвласник НЕ дописує сторонніх у team
× учасник-НЕвласник НЕ викидає власника з team
 Tests  6 failed | 13 passed (19)
```

**Це і є доказ Addition A.** Правило з плану закриває дірки Task 1 і `create` (Addition B стає
зеленим), але **всі 6 тестів на ескалацію привілеїв лишаються червоними**: viewer, який щойно
приєднався, робить `updateDoc(ref, {'teamRoles.<свій-uid>': 'owner'})` з клієнта і стає власником.
Рольовий allowlist із Task 3 при цьому не спрацьовує — він на іншому шляху (`/api/join`).

**Addition B** доведений окремо в прогоні №2: проти `create: if request.auth != null` тести
«підроблений ownerId» і «немає автора в команді» падають — обидва записи проходили.

### 4. Регресія, знайдена вже після харденінгу (див. «Що я змінив понад завдання»)

```
× учасник-НЕвласник виходить із проєкту сам
 Tests  1 failed | 22 passed (23)
```

## GREEN

```
 Test Files  3 passed (3)
      Tests  47 passed (47)
```
`npm test` — 23 тести правил + 24 серверних. `npm run test:rules` — 23/23.

## Семантика `affectedKeys()` для крапкових шляхів у мапі

**Висновок: `updateDoc(ref, {'teamRoles.abc': 'owner'})` РЕЄСТРУЄТЬСЯ як affected key `teamRoles`.**
Тобто наївне припущення тут справджується — `hasAny(['teamRoles'])` ловить крапковий запис.

`request.resource.data` — це **результуючий документ після мержу**, а не патч запиту. Крапкові
шляхи клієнтського SDK застосовуються до нього ще до обчислення правил, тож `diff()` бачить, що
змінилось значення топ-рівневого ключа `teamRoles`, і повертає саме `teamRoles`. Вкладені ключі
(`teamRoles.abc`) в `affectedKeys()` **не** з'являються — гранулярність рівно топ-рівнева.

Я не покладався на припущення, а поставив розрізнювальний експеримент: тимчасово прибрав
`'teamRoles'` зі списку `hasAny(['team', 'teamRoles', 'ownerId'])` → `hasAny(['team', 'ownerId'])`:

```
× учасник-НЕвласник НЕ підвищує себе до owner через teamRoles
× учасник-НЕвласник НЕ перезаписує teamRoles цілком
× учасник-НЕвласник НЕ понижує роль власника
 Tests  3 failed | 20 passed (23)
```

Впали рівно три teamRoles-тести (включно з крапковим), решта — ні. Це доводить, що заборону дає
саме ключ `teamRoles` в `affectedKeys()`, а не якийсь побічний ефект. Правила відновлено.

Друга (позитивна) перевірка, що обмеження не надто широке: тест «учасник-НЕвласник оновлює звичайні
поля проєкту» (`name`, `description`, `progress`, `lastActivity`, `updatedAt` одним записом)
проходить — `affectedKeys()` не чіпляє membership-поля помилково.

Окремо: для **вкладеної** мапи гранулярність теж працює — `resource.data.get('teamRoles', {})
.diff(...).affectedKeys()` вже повертає ключі *всередині* `teamRoles` (uid'и). Саме на цьому
тримається `isSelfRemoval()`.

## Що я змінив понад завдання (і чому)

**Знайдено регресію: обмеження `team`/`teamRoles` тільки власником ламає «Залишити проєкт».**

`src/pages-vite/ProjectDetail.jsx:502` (`removeMember`) пише `team: arrayRemove(memberId)` +
`teamRoles.<id>: deleteField()`. Викликається з двох місць у `FunctionalModals.jsx`:

| Виклик | Гейт в UI | Сумісність із правилом |
|---|---|---|
| `handleSaveRole` (:594) | `if (!isOwner) return` | ✅ лише власник |
| `handleRemove` (:611) | `if (!isOwner \|\| isMe) return` | ✅ лише власник |
| `handleLeaveProject` (:659) | `if (!isMe) return` — **власником бути не треба** | ❌ **ламалось** |

`pages-vite` — живий код: імпортується з `src/app/(main)/project/[id]/page.js`.
Тобто будь-який viewer/manager, що виходить із проєкту, отримав би `permission-denied`.

Завдання прямо вимагало не ламати звичайні флоу («do not simply lock updates to owners»), тож я
додав вузьку гілку `isSelfRemoval()` — за TDD: спершу червоний тест (прогін №4), потім правило.
Вона дозволяє рівно вихід із проєкту й нічого більше. Три тести-зловживання підтверджують межі:
«вихід» не прикриває видалення іншого, підвищення себе до owner, ані перехоплення `ownerId`.

`.get('teamRoles', {})` — щоб легасі-документи без `teamRoles` не ламали вихід із проєкту.

## Зміни у фікстурі

`tests/rules/helpers.js`: додано `CAROL = 'carol-uid'` — учасник команди, але **не** власник:
`team: [ALICE, CAROL]`, `teamRoles: { alice: 'owner', carol: 'viewer' }`.
Наявні тести не зламані — уся сюїта (включно з `tests/server`, яка має власні фікстури) зелена: 47/47.

## Перевірки сумісності з реальним кодом

- `src/lib/hooks/useProjects.js:43` (`addProject`) пише `ownerId: currentUser.id`,
  `team: [currentUser.id]`, `teamRoles: {id: 'owner'}` → нове правило `create` задовольняє.
  (`FunctionalModals.jsx:848` передає `team: selectedTeam`, але `addProject` це поле ігнорує й
  хардкодить `[currentUser.id]` — залишок мок-UI, на правила не впливає.)
- `/api/join` пише `team`/`teamRoles` через Admin SDK → правила його не стосуються, інвайти цілі.
- `npm run lint`: 74 проблеми — **усі преіснуючі**, перевірено прогоном на `git stash`;
  у моїх файлах помилок нема.

## Занепокоєння

1. **`handleLeaveProject` для єдиного власника.** UI блокує вихід останнього власника
   (`FunctionalModals.jsx:661`), але це **лише клієнтський** гейт. Правило дозволяє власнику
   будь-який `update`, тож власник в обхід UI може вийти сам і лишити проєкт без власника —
   документ стане нередагованим у частині membership (нікого з `ownerId` в `team`). Не регресія
   (так було й до змін) і не входить у скоуп Task 5, але варте окремого тікета.
2. **`messages.update` дозволений будь-якому члену команди** — можна редагувати чужі повідомлення.
   Так у плані (Task 5), лишив як є; `delete` при цьому вже обмежений автором. Виглядає
   непослідовно — можливо, варто звузити до `senderId == uid` окремою задачею.
3. **`notifications.create: if request.auth != null`** — лишається відкритим; план це свідомо
   виніс за межі фази («Що НЕ входить у цю фазу»).
4. **Правила стейджів/матеріалів/`tasks`/інвайтів ще відкриті** — це Task 6–7. Хелпери
   `projectTeam()`/`isTeamMember()` вже додані й ними використовуватимуться.
5. **Ціна читань:** `messages`/`typing` тепер роблять `get()` на `projects/{id}` — +1 читання на
   перевірку. Усвідомлено, як у специфікації.
6. `firestore-debug.log` (вивід емулятора) лишається невідстеженим у репо — не комітив;
   можливо, варто додати в `.gitignore` окремо.

---

# Доробка: два review-фінди (Task 5, пост-хардненінг)

**Коміт:** `a09c3b3` на `security/phase0-firestore-rules`. Правила НЕ деплоїлись.

## Finding 1 — «Вийти з проєкту» ламається наскрізно новими обмеженнями полів

**Причина.** `removeMember()` (`src/pages-vite/ProjectDetail.jsx:502`) робив ТРИ записи по черзі:
1. `updateDoc(projectRef, {team: arrayRemove(memberId), 'teamRoles.<id>': deleteField()})` —
   дозволено гілкою `isSelfRemoval()`.
2. `fbAddSystemMessage()` → `useChat.js:165` `addDoc(.../messages, ...)` — вимагає `isTeamMember()`.
3. Той самий виклик → `useChat.js:177` `updateDoc(projectRef, {lastActivity, updatedAt})` —
   вимагає `uid in resource.data.team`.

Після кроку 1 автор запису вже не в `team`, тому кроки 2 і 3 падають з `permission-denied`.
`handleLeaveProject` (`FunctionalModals.jsx:667-674`) ковтає помилку в `catch`, тож `onClose()`
і редирект на `/` не виконуються — юзер лишається застряглим на проєкті, який більше не читає.

**Виправлення.** Переставив порядок записів у `removeMember()`: системне повідомлення в чат і
`notifyTeam` йдуть ПЕРШИМИ (поки автор ще в команді), а `updateDoc` із самовидаленням з `team` —
ОСТАННІМ. Гілка «власник видаляє іншого учасника» цим не зачеплена: власник ніколи не виходить
із власної команди, тож порядок для неї не впливає на результат — лишив однаковим для обох гілок
заради простоти коду. Правила Task 5 НЕ чіпались і не послаблювались.

**RED (до виправлення) — тест `усі записи «виходу з проєкту» проходять у порядку, який реально
виконує додаток`, написаний із ПОТОЧНИМ (баговим) порядком викликів (спершу самовидалення з team,
потім повідомлення, потім lastActivity):**

```
stderr | ... GrpcConnection RPC 'Write' stream ... error. Code: 7 Message: 7 PERMISSION_DENIED:
evaluation error at L65:26 for 'create' @ L65, false for 'create' @ L65

 ❯ tests/rules/projects.test.js (27 tests | 1 failed)
     × усі записи «виходу з проєкту» проходять у порядку, який реально виконує додаток

FirebaseError: 7 PERMISSION_DENIED:
evaluation error at L65:26 for 'create' @ L65, false for 'create' @ L65

 Test Files  1 failed (1)
      Tests  1 failed | 26 passed (27)
```

Падає рівно на кроці 2 (`messages.create`, L65 правил) — точно там, де й передбачено в описі
регресії. Це доводить, що дірка реальна, а не гіпотетична.

Після виправлення коду тест оновлено на КОРЕКТНИЙ (новий) порядок викликів (повідомлення →
lastActivity → самовидалення) — саме так, як тепер реально пише `removeMember()`.

## Finding 2 — legacy-документи без `ownerId` стають ненавідно оновлюваними

**Причина.** `resource.data.ownerId` кидає помилку читання неіснуючого поля для документів без
цього поля. У правилі `update` це частково прикривається OR-семантикою CEL (`true || error =
true`) — якщо запис не чіпає membership-поля, `!touchesMembership()` рятує; емпірично підтвердив
це на емуляторі (звичайне редагування `name` в legacy-документі проходило ще ДО фіксу). Але:
- у правилі `delete` OR-рятівної гілки немає — `resource.data.ownerId` там єдина умова, тож
  legacy-документ не видалить НІХТО, включно зі справжнім власником;
- у правилі `update` легітимний власник legacy-документа, який хоче саме membership-зміну
  (наприклад, `teamRoles`), теж отримає помилку — жодна OR-гілка це не врятує.

**Виправлення.** `resource.data.ownerId` → `resource.data.get('ownerId', '')` у гілках `update` і
`delete` (`firestore.rules:56,60`). Відсутність поля тепер трактується як «власника немає», а не
як помилка, що валить весь запис.

**Тести (нова фікстура `PROJECT_ID_LEGACY = 'p-legacy'`, `team: [CAROL]`, БЕЗ `ownerId`):**
- звичайне редагування поля учасником команди — `assertSucceeds` (проходило й до фіксу, завдяки
  OR-абсорбції — задокументовано в звіті як знахідка, а не як хибний RED);
- зміна складу `team` учасником — `assertFails`;
- спроба учасника перехопити `ownerId` — `assertFails`.

## GREEN (обидві сюїти)

```
$ npm run test:rules
 Test Files  1 passed (1)
      Tests  27 passed (27)

$ npm run test:server
 Test Files  2 passed (2)
      Tests  24 passed (24)
```

## Команди, які реально виконувались

```
npm run test:rules   # запуск №1 (RED, до фіксу коду) — 26 passed | 1 failed
npm run test:rules   # запуск №2 (GREEN, після фіксу коду й правил) — 27 passed
npm run test:server  # 24 passed
git add firestore.rules src/pages-vite/ProjectDetail.jsx tests/rules/helpers.js tests/rules/projects.test.js
git commit -m "fix: repair leave-project write ordering and legacy ownerId reads"
```

## Занепокоєння (додатково до існуючого списку)

1. Легасі-`ownerId`-тест для звичайного редагування вже проходив ДО фіксу (CEL OR-абсорбція
   рятує `update`, коли запис не чіпає membership). Реальний, підтверджений на емуляторі баг —
   це `delete` (без рятівної гілки) і membership-зміни справжнім власником legacy-документа.
   Фікс (`.get()`) прибирає залежність від цієї недокументованої для читання поведінки й закриває
   обидва випадки явно, а не випадково.
2. `.gitignore` (додано `.superpowers/`) і `firestore-debug.log` (лог емулятора) лишені поза
   комітом цієї доробки — не стосуються завдання, не чіпав.
</content>
