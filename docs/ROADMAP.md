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

### Product polish

- Add a “hide completed” toggle to My Tasks, enabled by default.
- Implement a verified email-change flow with recent re-authentication.
- Continue accessibility and mobile-layout checks on the main workspace flows.
- Work the open items in [docs/PRODUCT_GAPS.md](PRODUCT_GAPS.md): the
  expected-but-absent pieces (loading states, offline handling, skip link,
  self-hosted fonts, notification delivery receipts) and the UX proposals behind
  them.

### Notification delivery

- Move the scheduled sweep off GitHub Actions. A `*/5 * * * *` schedule there
  actually starts a run every 60–210 minutes, so the sweep now covers the gap
  with a watermark rather than relying on the cadence. An external cron or a
  host whose cron granularity is better than one run per day is the real fix.
- Surface sweep health and per-channel delivery failures in Settings; both are
  recorded and neither is visible.

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
