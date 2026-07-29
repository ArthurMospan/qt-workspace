# Міграція ієрархії завдань v2

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

## 1. Dry run

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

## 2. Apply

Apply потребує окремого точного підтвердження project id:

```powershell
npm run migrate:issue-hierarchy -- --project quickteam-prod --apply --confirm-project quickteam-prod --report C:\tmp\issue-hierarchy-applied.json
```

Запускайте через Admin SDK з `GOOGLE_APPLICATION_CREDENTIALS` або
`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. Скрипт не запускається під
час логіну чи роботи вебзастосунку.

## Ідемпотентність і конкурентні зміни

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
