# Класифікація видимості календарного часу

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
