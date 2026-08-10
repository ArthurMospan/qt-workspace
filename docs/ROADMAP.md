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

A status has a local label and a shared category (see the README). One follow-up
is deliberately not built:

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

### Product polish

- Add a “hide completed” toggle to My Tasks, enabled by default.
- Implement a verified email-change flow with recent re-authentication.
- Continue accessibility and mobile-layout checks on the main workspace flows.
- Work the open items in [docs/PRODUCT_GAPS.md](PRODUCT_GAPS.md): the
  remaining reliability/performance pieces (self-hosted fonts, notification
  delivery receipts, session-expiry recovery) and the UX proposals behind them.

### Notification delivery

See [docs/NOTIFICATION_DELIVERY.md](NOTIFICATION_DELIVERY.md) for the analysis
and the target architecture.

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

## Unprioritized product backlog

Do not start these without an explicit owner decision:

- Mobile/PWA experience.
- Intake forms for external requests.
- Goals/OKR tracking.
- User-configurable automation rules.
- Table/spreadsheet view for issues.
- AI project summaries and task assistance.
- A client-safe AI status digest delivered through QuickTeam+.

Billing provider, checkout, subscriptions, invoices, and webhook contracts remain blocked on the external billing decision.
