# Імпорт із YouTrack без дублювання й «тихих» втрат

## Що вже реалізовано

Імпорт доступний власнику або адміністратору в **Налаштування → Інтеграції → Імпорт із YouTrack**:

1. Підключення постійним YouTrack token. Token шифрується AES-256-GCM і зберігається в закритому org-документі.
2. Інвентаризація доступних проєктів і користувачів.
3. Вибір проєктів, створення нового QuickTeam-проєкту або додавання в наявний.
4. Зіставлення статусів для кожного проєкту. QuickTeam пропонує відповідність автоматично, але адміністратор може вручну вибрати будь-який доступний статус проєкту-призначення, включно з архівними станами YouTrack на кшталт `Fixed` або `Closed`.
5. Зіставлення користувачів. Автопідстановка робиться лише за точним email; решта залишаються external actors.
6. Dry-run рахує чергу задач без змін бізнес-даних і серверно перевіряє, що вибрані статуси та проєкти-призначення ще доступні.
7. Відновлюваний commit по одній задачі з checkpoint після кожного кроку.
8. Перенесення задач, описів, статусів, типів, пріоритетів, дедлайнів, оцінок, тегів, коментарів, вкладень до 20 MB, work items і зв’язків. Work items створюються як `timeLogs` та оновлюють `issues.spentMinutes`.
9. Повторний запуск оновлює вже пов’язані об’єкти, а не дублює їх.

Стан job зберігається в `imports/{importId}`, черга — в `items`, відкладені зв’язки — в `links`. Ці колекції, `externalObjectLinks` та `externalActors` закриті Firestore Rules і доступні лише серверу.

## Ідемпотентність

Кожен імпортований об’єкт повинен мати серверний зовнішній ключ:

```text
sourceSystem: "youtrack"
sourceConnectionId: "<connection>"
externalId: "<YouTrack entity id>"
externalUpdatedAt: "<source timestamp>"
```

Унікальність визначається набором `organizationId + provider + connectionId + entityType + externalId`. Його SHA-256 hash є ID документа в `externalObjectLinks`. Повторний запуск оновлює той самий об’єкт. Така таблиця дозволяє згодом додати Jira, Linear та інші адаптери без зміни основної схеми.

## Користувачі

Не можна автоматично запрошувати або зливати акаунти лише за display name.

- Точний збіг підтвердженої email-адреси пропонується як мапінг, але адміністратор його підтверджує.
- Користувач без збігу імпортується як `external actor`: ім’я, аватар і YouTrack ID зберігаються в історичних записах, але він не отримує доступу до організації.
- Адміністратор може зіставити користувача з чинним учасником або залишити історичним автором. Запрошення нового учасника виконується окремо.
- Після майбутнього прийняття запрошення external actor можна зв’язати з реальним UID без переписування всієї історії.

Це прибирає головний ризик: випадково віддати доступ не тій людині або втратити автора старих коментарів/worklogs.

## Що переносити

| YouTrack | QuickTeam | Примітка |
|---|---|---|
| Project | Project | key зберігається як alias/external key |
| Issue | Issue | original readable ID показується в metadata |
| Description | Description | Розмітка зберігається як текст YouTrack |
| State/Type/Priority | Workflow values | мапінг перед commit |
| Assignee/Reporter | Member або external actor | без автоматичного злиття за ім’ям |
| Comments | Issue comments | оригінальний автор і час |
| Work items | Time logs | тип роботи можна лишити metadata |
| Links | Канонічний issue link | один документ на пару задач; `blocks`, `duplicates` або `relates-to` |
| Parent/subtask relation | Related link + review marker | не вгадувати ієрархію: YouTrack може мати кілька рівнів або різні проєкти |
| Attachments | Attachments | до 20 MB, помилки додаються як warnings |
| Tags | Labels + metadata | наявні однойменні labels мапляться, усі теги лишаються в metadata |
| Custom fields | import metadata | невідомі поля не викидаються |

## Що не можна гарантувати «без втрат»

Повної семантичної тотожності між двома task manager немає. Можуть не мати аналога:

- workflow scripts, automations і permissions;
- saved searches, dashboards та agile board presentation;
- історія зміни кожного поля, якщо API не повертає її повністю;
- специфічний YouTrack markup, reactions або типи work items;
- приватні вкладення/коментарі, яких не бачить integration token.

Тому критерій якості — не «нуль відмінностей», а **жодної тихої втрати**: усе неперенесене входить у machine-readable та людський звіт.

## Захист від майбутніх багів

- Імпортер має версію (`adapterVersion`, `mappingVersion`) у кожному run.
- Epic із YouTrack мапиться у `Фіча`, а оригінальний тип залишається в import metadata.
- `depends on` нормалізується у напрямлений `blocks` зі зміною напрямку; парний inverse-документ не створюється.
- Ієрархічні зв’язки YouTrack зберігаються як `relates-to` з `requiresReview`, доки адміністратор явно не призначить `parentIssueId`.
- Commit працює чанками з checkpoint і може продовжитися після падіння.
- Зовнішні API викликаються з timeout, pagination і bounded limits.
- Вкладення перевіряються за розміром і MIME.
- Видалення в YouTrack ніколи автоматично не видаляє дані QuickTeam.
- Перший реліз — тільки one-way import. Двостороння синхронізація є окремим продуктом із конфліктами та ownership rules.

## Межі поточної версії

Не імпортуються sprints/boards, saved searches, dashboards, permissions, workflow scripts, automations і повна activity history. Немає delta sync, двосторонньої синхронізації та окремого CSV/JSON reconciliation report. Це наступний етап після тестових міграцій на копіях реальних організацій.
