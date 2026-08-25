# Data migrations

One runbook per controlled migration script. They share one shape, and the shape
is the point: **dry run is the default**, apply demands the exact project (and
usually the organization) spelled out a second time, and a re-run after apply is
how the migration is declared finished.

None of these ever runs during login, deployment or a browser session
(`AGENTS.md`). JSON reports carry internal ids — keep them beside the operational
ticket, never in this repository.

---

## Міграція ієрархії завдань v2

Ця міграція переводить старі механізми `parentEpicId`, `subtasks[]` і парні
`issueLinks` на одну узгоджену модель:

- `parentIssueId` — єдине поле ієрархії, максимум один рівень;
- старі елементи `subtasks[]` стають Markdown-чеклістом в описі;
- один логічний зв’язок має один детермінований документ;
- вбудовані English labels локалізуються лише за точним стабільним `id` і
  точним старим label. Кастомні назви не змінюються.

Скрипт ніколи не вгадує напрямок старих `subtask-of` або `duplicates`.
Такі записи потрапляють до `manualReview` у JSON-звіті й залишаються без змін.
Так само не переносяться невалідні міжпроєктні батьки, глибші дерева та
циклічні залежності.

### 1. Dry run

Firebase project треба вказати явно:

```powershell
npm run migrate:issue-hierarchy -- --project quickteam-prod --report C:\tmp\issue-hierarchy-dry-run.json
```

За потреби можна обмежити одну організацію:

```powershell
npm run migrate:issue-hierarchy -- --project quickteam-prod --organization ORG_ID --report C:\tmp\issue-hierarchy-org.json
```

Перевірте `manualReview`, кількість змін і Firebase project у звіті. Dry run
нічого не записує.

### 2. Apply

Apply потребує окремого точного підтвердження project id:

```powershell
npm run migrate:issue-hierarchy -- --project quickteam-prod --apply --confirm-project quickteam-prod --report C:\tmp\issue-hierarchy-applied.json
```

Запускайте через Admin SDK з `GOOGLE_APPLICATION_CREDENTIALS` або
`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. Скрипт не запускається під
час логіну чи роботи вебзастосунку.

### Ідемпотентність і конкурентні зміни

- `parentIssueId` після першого проходу є авторитетним; застаріле поле
  видаляється лише коли немає конфлікту.
- Чекліст має marker `quickteam:legacy-subtasks-migrated`, тому не дублюється.
- Canonical link id залежить від організації, проєкту та unordered пари задач.
- Кожне issue-оновлення повторно звіряє вихідні hierarchy/checklist поля й
  інваріанти у транзакції з `project.issueHierarchyVersion`. Якщо дані
  змінилися після dry run, запис пропускається й потрапляє до `manualReview`.
- Link migration читає та інкрементить `project.issueLinkVersion` у транзакції.
  Це серіалізує її з API та YouTrack importer без maintenance window.
- Повторний запуск пропускає вже канонічні записи й знову звітує невирішені
  неоднозначності.

Збережіть обидва JSON-звіти біля операційного ticket, але не комітьте їх у
репозиторій: вони можуть містити внутрішні issue ids.

---

## Historical issue-key migration

QuickTeam now creates URL-safe ASCII issue prefixes containing at least one
Latin letter. Older organizations may still contain Cyrillic keys such as
`МАЧ-1` or numeric-only prefixes such as `111-1`.

The product recognizes these historical keys immediately and canonicalizes an
opened URL. The migration makes that result durable: it updates the project
prefix when the stored prefix is no longer valid, replaces each affected
`issues.issueKey`, and appends the previous key to `legacyIssueKeys`. Old links
therefore continue to resolve and are replaced in the address bar by the new
ASCII URL.

Run one dry-run per explicit organization. The command never writes by default:

```powershell
npm run migrate:issue-keys -- --project quickteam-prod --organization org-id
```

Review every project and issue operation in the JSON report. In particular,
`collisions` must be empty. Stop project creation and all task writers for that
organization, then apply with exact confirmations:

```powershell
npm run migrate:issue-keys -- --project quickteam-prod --organization org-id --apply `
  --confirm-project quickteam-prod --confirm-organization org-id `
  --confirm-writes-frozen
```

The script uses Firebase Admin credentials from the environment. It never runs
from a browser or login flow. Targets come from the same canonicalizer used by
task links, target collisions stop apply before any write, and each live
document is rechecked transactionally. Re-running an interrupted apply is safe.

After apply, run the dry-run again before lifting the write freeze.
`projectPrefixesPlanned` and `issueKeysPlanned` must both be zero. Keep the
reported `legacyIssueKeys`; they are the redirect aliases for links already in
chat, notifications, email, or browser history.

---

## Звірка фактично витраченого часу

`issues.spentMinutes` — денормалізоване дзеркало сирих документів
`timeLogs`. Нові записи, зміни й видалення оновлюють лог та дзеркало одним
batch/transaction. Для старих даних є окремий ідемпотентний Admin SDK скрипт.

Скрипт рахує лише валідні task-логи з точним збігом `issueId`,
`organizationId` і `projectId`. Календарні, міжпроєктні та невалідні записи не
вгадуються: їхні id потрапляють у JSON-звіт, а відповідна задача отримує
`manual-review` і не змінюється навіть у режимі apply. Спочатку виправте або
класифікуйте кожен такий лог і повторіть dry run.

### Версія дзеркала та порядок rollout

`spentMinutesMirrorVersion: 1` означає, що дзеркало вже звірене. Перед
увімкненням серверних мутацій часу в production спочатку запустіть migration
для всіх завдань з історією `timeLogs`.

Мутації навмисно відхиляють legacy-завдання, яке має логи без цієї версії.
Так rollout не закріпить помилкову історичну суму. Якщо завдання ще не має
жодного логу, API безпечно ініціалізує нульове дзеркало та версію під час
першого списання.

### Dry run

```powershell
npm run reconcile:issue-time -- --project quickteam-prod --report C:\tmp\issue-time-dry-run.json
```

Для однієї організації:

```powershell
npm run reconcile:issue-time -- --project quickteam-prod --organization ORG_ID --report C:\tmp\issue-time-org.json
```

Dry run є режимом за замовчуванням і нічого не записує.

### Apply

```powershell
npm run reconcile:issue-time -- --project quickteam-prod --apply --confirm-project quickteam-prod --confirm-writes-frozen --report C:\tmp\issue-time-applied.json
```

Apply повторно читає кожну задачу та її логи в транзакції й записує абсолютну
суму, тому повторний запуск безпечний. Задачі, які вже видаляються, скрипт
пропускає; задачі з неоднозначними логами залишає для ручної перевірки. Після
apply повторіть dry run: `mismatchedIssues`, `rejectedScopedLogs`,
`orphanTaskLogIds` та `issuesRequiringManualReview` мають дорівнювати нулю.
Скрипт ніколи не запускається під час логіну або роботи вебзастосунку.
JSON-звіти не комітьте: вони містять внутрішні id.

Перед apply прямі legacy-записи в `timeLogs` мають бути зупинені maintenance
вікном або попереднім релізом серверних writers + deny-write rules. Скрипт
навмисно вимагає явний `--confirm-writes-frozen` і повторно перевіряє кожну
задачу, навіть якщо на dry run її дзеркало виглядало чистим.

---

## Класифікація видимості календарного часу

Календарні логи мають серверні поля `eventVisibility` і
`calendarOrganizerId`. Аналітика читає окремо task-логи та лише ті календарні
логи, які явно класифіковані як `team`. Історичний час подій `participants` і
`private` не потрапляє у спільні аналітичні запити.

Backfill треба завершити до ввімкнення split-запитів і нових Firestore Rules.
Скрипт ніколи не запускається під час логіну й за замовчуванням працює в dry
run.

```powershell
node --env-file=.env.local scripts/backfill-calendar-time-log-visibility.mjs `
  --project <firebase-project-id> `
  --organization <organization-id> `
  --report C:\tmp\calendar-time-visibility-report.json
```

До apply розберіть кожен запис `manualReview`. Скрипт навмисно нічого не
вгадує, якщо події немає, організація/проєкт не збігаються, збережена
видимість конфліктує або occurrence не є точним канонічним повторенням.

Apply потребує точного підтвердження обох scope:

```powershell
node --env-file=.env.local scripts/backfill-calendar-time-log-visibility.mjs `
  --project <firebase-project-id> `
  --organization <organization-id> `
  --apply `
  --confirm-project <firebase-project-id> `
  --confirm-organization <organization-id> `
  --confirm-writes-frozen `
  --report C:\tmp\calendar-time-visibility-applied.json
```

Після apply повторіть dry run. Очікуваний результат: усі валідні записи мають
статус `clean`, `teamBackfill` і `restrictedBackfill` дорівнюють нулю,
`manualReview` порожній.

Apply дозволений лише коли legacy-записи часу вже зупинені. Безпечний порядок
production rollout:

1. задеплоїти `firestore.indexes.json` і дочекатися стану READY;
2. увімкнути maintenance/write fence або спочатку випустити сумісний реліз із
   серверними writers, дочекатися завершення старих сесій і заборонити прямі
   client writes;
3. виконати dry run, розібрати всі неоднозначності й зробити apply з
   `--confirm-writes-frozen`;
4. повторити dry run до нульових проблем;
5. лише тоді деплоїти split-запити та фінальні `firestore.rules`, після чого
   зняти maintenance.

JSON-звіти не комітьте: вони містять внутрішні id.

---

## Private chat attachments

New chat attachments are uploaded with Cloudinary delivery type
`authenticated`. Firestore stores only the organization-owned public id and
format, not a delivery URL. The client asks
`POST /api/chat/attachments/access` for a five-minute signed URL; that route
checks Firebase authentication, organization membership, direct-message or
channel membership, and the exact attachment on the message before signing.

Existing chat files remain public until they are converted. Run the migration
once per organization. Dry-run is the default and does not call Cloudinary or
write Firestore:

```powershell
npm run migrate:chat-attachments -- --project quickteam-prod --organization org-id
```

Review every planned source and destination, freeze chat writes for that
organization, then apply with exact confirmations:

```powershell
npm run migrate:chat-attachments -- --project quickteam-prod --organization org-id --apply `
  --confirm-project quickteam-prod --confirm-organization org-id `
  --confirm-writes-frozen
```

The script requires Firebase Admin credentials and, for apply,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Destinations are deterministic. On a retry, an already-authenticated
destination is reused, and a Firestore document is updated only when its live
attachments still exactly match the reviewed value.

After apply, run dry-run again. `attachmentsPlanned`,
`otherOrganizationSkipped`, `unsupportedPathSkipped`, and
`missingFormatSkipped` must be zero before lifting the write freeze. This
repository does not run the migration during login or deployment.

---

## Organization-scoped image assets

Legacy profile avatars and organization logos were uploaded below
`quickteam/avatars/`. That path does not prove tenant ownership, so the product
correctly refuses to delete those files. New uploads use
`quickteam/organizations/{organizationId}/avatars|logos` and persist the
Cloudinary public id beside the delivery URL.

Run the migration once per organization. It scans only that organization's
document and current member profiles. Dry-run is the default and does not call
Cloudinary:

```powershell
npm run migrate:image-assets -- --project quickteam-prod --organization org-id
```

Review the printed source/destination list, freeze avatar/logo changes for the
organization, then apply with exact confirmations:

```powershell
npm run migrate:image-assets -- --project quickteam-prod --organization org-id --apply `
  --confirm-project quickteam-prod --confirm-organization org-id `
  --confirm-writes-frozen
```

The script uses Firebase Admin credentials plus `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from the environment. Apply
is idempotent: destination ids are deterministic, an existing destination is
reused, and Firestore is updated only when the live URL still matches the
value classified by the script.

Re-run dry-run after apply. `legacyMovesPlanned` and
`metadataBackfillsPlanned` must both be zero before the write freeze is lifted.

---

## Member access and rate migration

This migration removes legacy payroll fields from member-readable documents,
moves them to server-only paths, and cleans stale member ids from project teams,
issue assignees, and issue watchers.

Run a dry-run first against one explicit organization:

```bash
npm run migrate:member-access -- --project quickteam-prod --organization org-id
```

Review the JSON counts, stop membership, workflow, project-team, and issue
assignment writes for that organization, then apply with exact confirmations:

```bash
npm run migrate:member-access -- --project quickteam-prod --organization org-id --apply --confirm-project quickteam-prod --confirm-organization org-id --confirm-writes-frozen
```

The script is idempotent. Re-run the dry-run after apply; every migration and
cleanup count should be zero. Repeat explicitly for each organization. Never run
it from a browser or login flow.

## Ключ батьківського завдання на підзавданні

`scripts/backfill-parent-issue-key.mjs`

Картка підзавдання називає задачу, під якою воно висить. Раніше вона шукала цю
задачу серед тих, що випадково завантажені на тому ж екрані, — а батьківська
зазвичай не там: інший спринт, інша колонка, за межами сторінки. Слот
ідентифікатора тоді показував слова «Батьківське завдання», що читалось як номер
самої задачі.

Задачі, створені після цієї зміни, несуть `parentIssueKey`: маршрути створення
(`/api/issues`) і зміни батька (`/api/issues/[issueId]/parent`) все одно читають
батьківський документ для валідації, тож зберегти його ключ не коштує нічого.
Скрипт дописує це поле старим підзавданням.

### Dry run

```bash
node scripts/backfill-parent-issue-key.mjs --dry-run
```

Друкує кількість підзавдань, скільки вже коректні, скільки треба полагодити і
список тих, чиє батьківське завдання не знайдено. Останні **не чіпаються**: це
зламане посилання, яке треба виправити руками, а не ключ, який можна вигадати.

### Apply

```bash
node scripts/backfill-parent-issue-key.mjs
```

Ідемпотентний: підзавдання з правильним `parentIssueKey` пропускається без
запису. Читає одне підзавдання і один унікальний батьківський документ, тож
повторний запуск після повного проходу майже безкоштовний.

Поки поле не проставлене, картка показує лише значок «це підзавдання» — без
номера, але й без вигаданого тексту в слоті ідентифікатора.

---

## Денні підсумки аналітики (`analyticsRollups`)

`scripts/backfill-analytics-rollups.mjs` перебудовує колекцію денних підсумків
часу з сирих `timeLogs`, з яких вона виведена.

Підсумки пишуться інкрементально — у тих самих транзакціях, що й самі записи
часу. Тобто вони настільки правильні, наскільки правильними були останній
деплой, останній retry і останній випадок, якого ніхто не передбачив. Тому цей
скрипт — три інструменти в одному:

- **міграція**, яка наповнює колекцію вперше;
- **ремонт**, коли підсумок і його логи розійшлися;
- **аудит**, який каже, чи розійшлися: dry run звітує кожен день, чиї збережені
  цифри не збігаються з перерахованими, і не звітує нічого, коли інкрементний
  шлях працює правильно.

Скрипт ніколи не інкрементує: він рахує абсолютні підсумки заново й записує їх
через `set` без merge. Merge успадкував би саме той дрейф, заради якого запуск і
відбувається.

День береться в часовому поясі організації (`organizations/{id}.timezone`). Якщо
пояс змінили — повторний запуск перекладає історичні дні в новий.

### 1. Dry run

```powershell
npm run backfill:analytics-rollups -- --project quickteam-prod --report C:\tmp\rollups-dry-run.json
```

Можна обмежити однією організацією:

```powershell
npm run backfill:analytics-rollups -- --project quickteam-prod --organization ORG_ID
```

Виводить по кожній організації: скільки логів прочитано, скільки днів вони
утворюють, скільки днів треба записати і скільки документів залишились без
жодного лога. Перші десять розбіжностей друкуються повністю
(`задачі X→Y · події X→Y · скасовані X→Y`), решта — у JSON-звіті.

### 2. Apply

```powershell
npm run backfill:analytics-rollups -- --project quickteam-prod --apply --confirm-project quickteam-prod --report C:\tmp\rollups-applied.json
```

Запускати через Admin SDK з `GOOGLE_APPLICATION_CREDENTIALS` або
`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.

### 3. Повторний dry run — це і є підтвердження

```powershell
npm run backfill:analytics-rollups -- --project quickteam-prod
```

Має надрукувати `Розбіжностей: 0 … зайвих документів: 0` і
`Підсумки збігаються з сирими логами. Міграція завершена.` Будь-яке інше число
означає, що якийсь шлях запису змінює хвилини, не змінюючи підсумок, — і його
треба знайти, а не просто перезаписати підсумки ще раз.

### Що саме перебудовується

- `taskMinutes` — усе, що списано на задачі цього дня;
- `eventMinutes` — час командних подій календаря;
- `cancelledTaskMinutes` — та частина `taskMinutes`, що належить задачам із
  `cancelledAt`. Читач віднімає її; підсумок «що записали» не переписується;
- `minutesByUser` / `cancelledMinutesByUser` — те саме по кожному `userId`.

Архівні задачі **не** коригуються: година, відпрацьована над задачею, яку потім
відклали, лишається годиною, яку відпрацювали (`AGENTS.md`).

Документ, під яким не лишилось жодного лога (задачу вичистили з
«Нещодавно видаленого», проєкт видалили), видаляється, а не обнуляється: «немає
документа» і «день без годин» мають лишатися одним твердженням.

Звіт містить внутрішні ідентифікатори — тримайте його біля операційного ticket,
не в репозиторії.

---

## Курсор замість позначки в кожному повідомленні (міграції немає)

Цей розділ існує саме тому, що скрипта тут немає, і це треба було перевірити, а
не припустити.

Чат завдання більше не питає `readBy` кожного коментаря, чи прочитане
повідомлення, — на це відповідає курсор `organizations/{orgId}/issueReadState/{uid}_{issueId}`,
той самий, з якого вже жила крапка на картці й межа в стрічці змін. Позначка на
самому повідомленні лишилась тільки під квитанцією ✓✓ і пишеться по одній на
автора, а не на кожне повідомлення.

**Backfill не потрібен, і ось чому:**

- Старі повідомлення несуть повний `readBy` і `readAt`. `receiptMarks` читає їх
  так само, як читав, тож квитанції в історії не змінюються і не втрачають
  годину.
- Нові повідомлення несуть позначку тільки на найновішому від кожного автора, а
  квитанція для старіших виводиться з неї (`commentReaders`). Обидві форми даних
  живуть в одній колекції одночасно й читаються одним кодом.
- Непрочитане тепер рахується від курсора. Курсор пишеться з першої хвилі, тож
  у людей, які відкривали задачу після неї, він уже є. У кого його нема, той
  побачить розмову як непрочитану один раз — і вихід із задачі його поставить.
- Зайвий `readBy` у старих документах нікому не заважає: його ніхто не читає для
  непрочитаного, а місця він не коштує помітно.

Правило запису в Firestore Rules (`hasOnly(['readBy', 'readAt'])`) лишається без
змін: воно й далі описує рівно те, що клієнт має право писати в чужий коментар.

### Порядок розгортання строку давності

`pruneReadNotifications` виконує запит `read == true` + діапазон по `createdAt`.
Складений індекс на це вже описаний у `firestore.indexes.json`, але Firestore
створює індекси не миттєво:

```powershell
firebase deploy --only firestore:indexes --project quickteam-prod
```

Поки індекс будується, запит падає з `failed-precondition`, і прохід чистки
просто нічого не видалить — доставка сповіщень від цього не залежить і не
зупиняється. Тому індекс варто розкотити перед кодом, але зворотний порядок не є
аварією: наступний повільний прохід підбере те саме.
