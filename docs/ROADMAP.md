# QuickTeam roadmap

This file contains current owner guardrails and confirmed open work. Completed implementation history belongs in Git, not in long-lived task documents. If this document conflicts with current code, rules, or tests, the implementation wins and this file should be corrected.

## Product guardrails

- QuickTeam Workspace is an internal team product. Organization roles are `owner`, `admin`, and `member`; do not add a client/viewer role to the workspace.
- Client collaboration belongs to the separate QuickTeam+ portal. The two products integrate through the documented OAuth and project-link flow; do not couple their primary Firebase sessions or data models.
- `issues` is the canonical task collection. `tasks` is legacy/read-only and must not receive new features.
- Subscription billing will be supplied by the wider product ecosystem. Do not expand placeholder Free/Lite/Pro logic without an explicit product decision.
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

The first pass is done — the git log carries what changed and why. What remains,
in the order it was agreed:

**Next: behaviour**

- Queue or stack the live notification cards. `showLiveNotif` replaces whatever
  is on screen, so three notifications in ten seconds show one.
- Respect tab visibility. Neither a card's six seconds nor a read receipt should
  be spent while the tab is hidden. `/chat` checks `document.visibilityState`;
  the task chat's two observers do not.
- Optimistic sending in the task chat: the message appears at once, marked as
  sending, and settles when the snapshot lands. Today it waits for Firestore.
- A typing indicator in the task chat. `activeTypingUserIds` and its render
  already exist on the workspace chat side.
- Mark a channel's bell records read while that channel is open. Direct messages
  and tasks already do it; a channel cannot yet, because a `chat_message`
  record carries no channel id — only its link does (`/chat?channel=…`), so
  either that link is parsed or the field is added first.

**After that: cost and hygiene**

- One cursor per conversation instead of a mark per message. Reading fifty
  messages costs fifty writes today where the workspace chat costs one; keep the
  per-message mark only for the ✓✓ receipt, which genuinely needs it. See the
  read-budget rules in «Вартість читання» in [ARCHITECTURE.md](ARCHITECTURE.md).
- Group bell records by task and conversation: one row saying «3 нові
  повідомлення в QT-12» rather than three identical ones.
- Expire read notifications. Nothing removes them but the manual «очистити
  прочитані», and each one is also a dedupe claim, so expiry has to leave the
  scheduled-outbox row as the guard against a resend.
- Drop the dead `birthday` notification type. It sits in the client's type table,
  the server's `ALLOWED_TYPES` rejects it, and nothing sends it.

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
  now, but nothing measures the daily total or warns before it is spent. Scope
  and window every new read path.

## Unprioritized product backlog

Do not start these without an explicit owner decision:

- Mobile/PWA experience.
- Intake forms for external requests.
- Goals/OKR tracking.
- User-configurable automation rules.
- AI project summaries and task assistance.
- A client-safe AI status digest delivered through QuickTeam+.

Billing provider, checkout, subscriptions, invoices, and webhook contracts remain blocked on the external billing decision.
