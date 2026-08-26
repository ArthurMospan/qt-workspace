# QuickTeam roadmap

This file contains current owner guardrails and confirmed open work. Completed implementation history belongs in Git, not in long-lived task documents. If this document conflicts with current code, rules, or tests, the implementation wins and this file should be corrected.

## Product guardrails

- QuickTeam Workspace is an internal team product. Organization roles are `owner`, `admin`, and `member`; do not add a client/viewer role to the workspace.
- Client collaboration belongs to the separate QuickTeam+ portal. The two products integrate through the documented OAuth and project-link flow; do not couple their primary Firebase sessions or data models.
- `issues` is the canonical task collection. `tasks` is legacy/read-only and must not receive new features.
- Subscription billing will be supplied by the wider product ecosystem. The
  owner has since made the product decision the old wording was waiting for:
  two plans, `free` and `pro`, described once in `src/lib/utils/plans.mjs` and
  rendered by «Налаштування» → «Тарифний план» rather than restated there.
  Branding and the project ceiling are enforced; everything else the registry
  lists carries `enforced: false` and the screen shows it under «Скоро», which
  is the whole point of the flag. Do not add a capability without deciding which
  of the two it is — a pricing page listing something nobody is stopped from
  using is a bug with a price beside it, and `tests/plans.test.mjs` holds every
  `enforced: true` to a named place in the code.
- Money is not connected. Switching plans is a field on the organization
  document, written the way branding is, so today the plan gates how the
  workspace looks and not who may use it. When billing is real, `plan` moves
  behind a server route and joins `apiKeys` among the fields firestore.rules
  refuses from a client — until that happens, no plan check is a security
  boundary and none of them should be described as one.
- Organization deletion stays disabled until an owner-only, idempotent server cascade safely handles Firestore and external files and has integration coverage.
- Multi-tenant isolation and server-authorized privileged writes take precedence over UI convenience.

## Confirmed open work

### Safe organization deletion

- Implement an owner-only server API with a resumable/idempotent cascade.
- Delete all organization-scoped Firestore data and external files safely.
- Cover authorization, partial failure, and retry behavior before enabling the Settings action.

### QuickTeam+ convergence and hardening

- Converge the modern OAuth/secondary-Firebase flow and the legacy portal route instead of growing both independently.
- Remove the split configuration between `NEXT_PUBLIC_QTPLUS_URL` and `NEXT_PUBLIC_PORTAL_URL`.
- Enforce a clear uniqueness policy for portal-project links.
- Provide a reconnect path for revoked/invalid grants on already linked projects.
- Tighten provider rules and add live cross-repository smoke coverage before a broad client rollout.

### Status categories — the remaining step

A status has a local label and a shared category (see the README). Two notes and
one follow-up.

**«Скасовано» is no longer a category.** Dropped work is `cancelledAt` on the
task, because a status puts a task in a column and a task in a column is still
one of the tasks every report has to remember to subtract. An organization that
had created a status under the old «Скасовано» section keeps it as an ordinary
open status — deliberately visible rather than silently re-read as «Готово»,
which is what its stored `isDone: true` would otherwise have meant. The one-time
cleanup is by hand and takes a minute: cancel those tasks with the new action,
then delete the status in «Налаштування» → «Статуси завдань». No script.

**«На перевірці» is new**, and it is not added to a workflow anybody has already
saved: the editor shows an empty section instead, so nobody's board grows a
column overnight. The three ids the product shipped for it — `code-review`,
`qa`, `client-approval` — move into the category automatically, which is the
meaning they always had.

One follow-up is deliberately not built:

- Let one column of a project board hold several statuses, mapped explicitly. That
  is what "hidden columns" are really reaching for: today a status a project does
  not want is switched off per project, and a column that could gather «Код-ревʼю»
  and «QA» under one heading would express it directly. `hiddenColumns` and its
  server-side refusal stay correct in the meantime.

A project board briefly offered a per-person "group by category" toggle instead,
and it was removed rather than moved into project settings. Grouping is not a
view preference there: a drop on a category column lets the category pick the
status, so two people looking at one board would mean different things by the
same gesture. A project board has a shared status vocabulary — that is what makes
it a project board — and «fewer columns» is what hiding a column is for, at no
cost in precision. Only «Мої завдання» groups by category, because across
projects no shared vocabulary exists.

### Table view — what it deliberately does not do

The project board's third view shipped (see
[ARCHITECTURE.md](ARCHITECTURE.md)). Three omissions are choices, not gaps:

- **Column order is not in the address.** The picker says which columns, never
  where they sit. Reordering is a drag interaction whose whole value is local,
  and a link that carried a layout would be a second thing to keep in sync.
- **«Мої завдання» has no table.** That list spans projects, so its rows have no
  shared status vocabulary and a cell edit would write into whichever project
  owns the row. Both are solvable; neither is solved by copying this component.
- **Time logged is not a column.** It lives in `timeLogs`, and a table that read
  it would be one query per row.

### Product polish

- Add a “hide completed” toggle to My Tasks, enabled by default.
- Implement a verified email-change flow with recent re-authentication.
- Continue accessibility and mobile-layout checks on the main workspace flows.
- Ask for the Web Notification permission. In-app, email and Telegram exist;
  the one channel that reaches a laptop with the tab in the background is the
  one never requested.
- Recover from an expired session in one place. Two files translate an expired
  token into Ukrainian; everywhere else it surfaces as a generic failure, and a
  half-written form is lost with it.
- Give a failed background write a retry. The optimistic overlay rolls back
  correctly, and then the person is left to redo the action by hand with no
  record of what was lost.
- Set a bundle budget. Nothing fails today when a page's JavaScript doubles.

### Chat read state, and the card that announces it

One subject, two implementations, and that is why this area produces a new bug
report every few weeks. The workspace chat (`/chat`) keeps a per-room cursor in
`organizations/{orgId}/readState/{uid}_{channelId}` and carries the whole scroll
behaviour — jump-to-latest, a resize correction, an at-bottom threshold. The
task chat (`UnifiedTimeline`) keeps a `readBy` array on every comment and owns
the unread divider the workspace chat has never had. Repairing one leaves the
other holding its own half of the same defect.

All three passes are done — the git log carries what changed and why. The third
one was cost and hygiene: the task chat now asks the per-issue cursor what is
unread instead of a mark inside every message, and writes a mark only where the
✓✓ receipt genuinely needs one (the newest message of each author, which covers
everything older); the bell collapses a conversation into one row; read records
expire after thirty days without ever deleting a claim something could still
resend; and event-driven email and Telegram failures land in the same outbox the
reminders use.

One item of that list turned out to be wrong as written. **`birthday` is not a
dead type.** `ALLOWED_TYPES` does reject it, but that route is not how it is
sent: `createBirthdayNotifications` in `lib/server/reminderJobs.js` writes it
straight through the Admin SDK on the daily greeting sweep, and it reaches real
bells. The route rejects it on purpose — a greeting is addressed to a whole
organization on somebody else's behalf, and no browser should be able to send
one. What was actually wrong was that three lists disagreed in three files with
nothing holding them together; the registry in `notificationChannels.mjs`
(`REQUESTABLE_NOTIFICATION_TYPES` / `SYSTEM_NOTIFICATION_TYPES`) and
`tests/notification-types.test.mjs` now do.

**Still open in this area**

- One implementation of reading and scrolling for both chats. Wave 1 moved the
  scroll behaviour across and wave 3 moved the read model across; the two screens
  still hold two copies of the code that does it. The unread line and the ✓✓
  receipts are a layer above that, not a second chat.
- «Позначити непрочитаним» for a single message. It exists for a task as a
  whole.
- Reactions in the task chat. They exist in the workspace chat; this is taste,
  not mechanics.

### Notification delivery

See [ARCHITECTURE.md](ARCHITECTURE.md) for the two paths and their guarantees.

- Point an external HTTP cron (cron-job.org, one-minute granularity) at
  `/api/cron/notifications`. No code change; fixes latency today. GitHub Actions
  stays wired as a fallback only.
- Finish write-time outbox materialisation in every event/deadline mutation
  path. Dispatch already uses the scheduled outbox; the bounded twenty-minute
  source materialiser remains as a safety net until this invariant is complete.
- Surface sweep health and per-recipient delivery failures in Settings; both are
  recorded and neither is visible.
- When QuickTeam moves to its own server: run the worker in-process on a real
  interval and drop the external trigger.
- Send a digest instead of an interruption per event. A daily or end-of-day
  summary («3 задачі на завтра, 1 прострочена») is usually the only kind of
  notification people keep switched on.

### Задачі в аналітиці: лічильники замість повного набору

Час у звітах більше не читається сирим — денні підсумки в `analyticsRollups`
відповідають на «скільки годин за період» одним документом на проєкт на день
(див. ARCHITECTURE → «Аналітика»). Задачі так і лишились єдиною колекцією, яку
екран аналітики читає повністю.

Це не забули — це поки що не можна зробити чесно, і ось чому:

- Немає поля, за яким «відкриті» можна порахувати `count()`. Закритість задачі
  живе в категорії її статусу, а статуси налаштовуються по проєктах, тож запит
  мусив би бути `columnId in [...]` — а `in` тримає щонайбільше 30 значень.
- `archivedAt` і `cancelledAt` відсутні на документі, поки не виставлені, а
  Firestore не вміє питати «поля немає». `count()` без цього рахував би
  архівні й скасовані задачі, тобто давав би відповідь, гіршу за поточну.
- Дві знахідки з «Що потребує уваги» взагалі не виражаються запитом:
  «заблоковані залежностями» читає `issueLinks`, «без оцінки» — категорію
  статусу проєкту. Списки за ними доводиться будувати з повного набору.
- А `useIssues.js` і `issueCancel.mjs` навмисно фільтрують у місці читання, а
  не в запиті, саме тому, що кожен потік задач і так обмежений проєктом.

Щоб це зрушити, потрібне денормалізоване поле стану на самій задачі
(`open`/`delivered`), яке пишуть ті самі серверні маршрути, що вже пишуть
статус, плюс backfill `archivedAt`/`cancelledAt` у явний `null`. Це той самий
крок, що вже описаний в ARCHITECTURE → «Що лишилось дорогим навмисно» як
лічильники на документі проєкту, і робити його варто разом із переходом на
платний тариф: він змінює те, що картка може показувати наживо.

Поки цього немає, вартість обмежена вікном і тим, що задача — скінченна
множина: вона росте з обсягом роботи, а не з віком робочого простору.

### Operational facts worth knowing

- **The GitHub repository is public.** `ArthurMospan/qt-workspace` answers to an
  unauthenticated API call. Nothing secret is committed and the checks for that
  hold, but the data model, the Firestore rules and every internal route are
  readable by anyone. If that is deliberate it stays written down here; if it is
  not, it is one setting.
- **Production runs on Firestore's free read quota.** The queries are bounded
  now, and the day it is spent anyway the product says so instead of spinning —
  see `lib/utils/quotaState.mjs` and the test that holds the three surfaces to
  one sentence. The half before that now exists too: `lib/utils/readMeter.mjs`
  counts what each wide query is billed for and answers in the browser console
  as `qtReads()`. It counts deliveries from the server only, and only the
  documents that changed, because a listener after its first attach is charged
  for what moved rather than for what it emits — a meter reporting `docs.length`
  would read several times the bill and would be worse than none. Five hooks
  report: `useOrganizationIssues`, `useIssues`, `useAllMyTasks`, `useSprints`,
  `useWorkspaceAnalytics`. Rule stands regardless: scope and window every new
  read path.

  What it still cannot see is the rules engine. `canAccessProject` calls `get()`
  on the project and on the membership, and those are billed reads no client can
  observe — so the real figure is above whatever `qtReads()` says, by roughly
  two per query.
- **The dashboard is the widest read in the product and the screen people
  return to most.** Its subscription therefore lives in
  `lib/hooks/useOrganizationIssues.js`, refcounted and keyed by what it reads,
  not inside the screen: a listener rebuilt on the way back in is a fresh query
  against that daily cap. A new screen that wants the same set asks this hook
  rather than opening a second copy of it.

## Unprioritized product backlog

Do not start these without an explicit owner decision:

- Mobile/PWA experience.
- Intake forms for external requests.
- Goals/OKR tracking.
- User-configurable automation rules.
- AI project summaries and task assistance.
- A client-safe AI status digest delivered through QuickTeam+.

Billing provider, checkout, subscriptions, invoices, and webhook contracts remain blocked on the external billing decision.
