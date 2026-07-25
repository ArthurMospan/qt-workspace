# Імпорт із YouTrack без дублювання й «тихих» втрат

## Рекомендована модель

Імпорт має бути окремим конвеєром, а не прямим копіюванням у `projects` та `issues`:

1. **Підключення й інвентаризація** — read-only token, перевірка доступних проєктів, користувачів, custom fields, work items, коментарів, вкладень і зв’язків.
2. **Staging** — нормалізований знімок джерела зберігається в `imports/{importId}` та його серверних підколекціях. На цьому етапі QuickTeam ще не змінюється.
3. **Мапінг** — адміністратор підтверджує відповідність користувачів, статусів, типів, пріоритетів і полів.
4. **Dry-run** — звіт: що буде створено, пропущено, обрізано або потребує ручного рішення.
5. **Commit** — порційний і повторюваний запис із журналом прогресу.
6. **Delta sync** — необов’язкове дочитування змін, зроблених у YouTrack після початкового знімка.

## Ідемпотентність

Кожен імпортований об’єкт повинен мати серверний зовнішній ключ:

```text
sourceSystem: "youtrack"
sourceConnectionId: "<connection>"
externalId: "<YouTrack entity id>"
externalUpdatedAt: "<source timestamp>"
```

Унікальність визначається трійкою `sourceSystem + sourceConnectionId + externalId`. Повторний запуск оновлює той самий об’єкт, а не створює копію. Окрема таблиця `externalObjectLinks` краща за пошук цих полів у кожній бізнес-колекції: вона дозволить додати Jira, Linear та інші джерела без зміни основної схеми.

## Користувачі

Не можна автоматично запрошувати або зливати акаунти лише за display name.

- Точний збіг підтвердженої email-адреси пропонується як мапінг, але адміністратор його підтверджує.
- Користувач без збігу імпортується як `external actor`: ім’я, аватар і YouTrack ID зберігаються в історичних записах, але він не отримує доступу до організації.
- Адміністратор може: зіставити з чинним учасником, запросити нового або залишити історичним автором.
- Після майбутнього прийняття запрошення external actor можна зв’язати з реальним UID без переписування всієї історії.

Це прибирає головний ризик: випадково віддати доступ не тій людині або втратити автора старих коментарів/worklogs.

## Що переносити

| YouTrack | QuickTeam | Примітка |
|---|---|---|
| Project | Project | key зберігається як alias/external key |
| Issue | Issue | original readable ID показується в metadata |
| Description | Markdown description | HTML/YouTrack markup конвертується зі звітом про втрати |
| State/Type/Priority | Workflow values | мапінг перед commit |
| Assignee/Reporter | Member або external actor | без автоматичного злиття за ім’ям |
| Comments | Issue comments | оригінальний автор і час |
| Work items | Time logs | тип роботи можна лишити metadata |
| Links/subtasks | Issue links/parent relations | записувати після створення всіх issues |
| Attachments | Attachments | checksum, retry, quarantine для помилок |
| Tags | Labels | нормалізація та дедуплікація |
| Sprints/boards | Sprints | board settings не завжди мають прямий аналог |
| Custom fields | mapped field або import metadata | невідомі поля не викидати |

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
- Сирий source snapshot зберігається обмежений час для відтворення проблем.
- Commit працює чанками з checkpoint і може продовжитися після падіння.
- Зовнішні API викликаються з rate limit, retry/backoff і bounded concurrency.
- Вкладення перевіряються за size, MIME та checksum.
- Після commit запускаються reconcile-перевірки кількості й контрольних сум.
- Видалення в YouTrack ніколи автоматично не видаляє дані QuickTeam: воно позначається як source-deleted і потребує рішення адміністратора.
- Перший реліз — тільки one-way import. Двостороння синхронізація є окремим продуктом із конфліктами та ownership rules.

## MVP

Перший корисний реліз: projects, issues, users mapping, comments, attachments, links і worklogs; один dry-run; ідемпотентний повторний запуск; CSV/JSON звіт помилок. Sprints, custom-field constructors та delta sync варто додавати після реальних імпортів на копіях організацій.
