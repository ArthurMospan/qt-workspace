# Звірка фактично витраченого часу

`issues.spentMinutes` — денормалізоване дзеркало сирих документів
`timeLogs`. Нові записи, зміни й видалення оновлюють лог та дзеркало одним
batch/transaction. Для старих даних є окремий ідемпотентний Admin SDK скрипт.

Скрипт рахує лише валідні task-логи з точним збігом `issueId`,
`organizationId` і `projectId`. Календарні, міжпроєктні та невалідні записи не
вгадуються: їхні id потрапляють у JSON-звіт, а відповідна задача отримує
`manual-review` і не змінюється навіть у режимі apply. Спочатку виправте або
класифікуйте кожен такий лог і повторіть dry run.

## Версія дзеркала та порядок rollout

`spentMinutesMirrorVersion: 1` означає, що дзеркало вже звірене. Перед
увімкненням серверних мутацій часу в production спочатку запустіть migration
для всіх завдань з історією `timeLogs`.

Мутації навмисно відхиляють legacy-завдання, яке має логи без цієї версії.
Так rollout не закріпить помилкову історичну суму. Якщо завдання ще не має
жодного логу, API безпечно ініціалізує нульове дзеркало та версію під час
першого списання.

## Dry run

```powershell
npm run reconcile:issue-time -- --project quickteam-prod --report C:\tmp\issue-time-dry-run.json
```

Для однієї організації:

```powershell
npm run reconcile:issue-time -- --project quickteam-prod --organization ORG_ID --report C:\tmp\issue-time-org.json
```

Dry run є режимом за замовчуванням і нічого не записує.

## Apply

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
