# Notification delivery

QuickTeam has two notification paths. They share channel preferences, but their
triggers and reliability guarantees are different.

## Event-driven notifications

Assignments, comments, mentions and chat messages originate in an authenticated
server request. That request writes the in-app notification and immediately
attempts the enabled external channels. No scheduler is involved.

This path is intentionally low-latency, but it does not yet have a durable retry
queue for a provider failure. Adding the immediate events to the same outbox is
remaining reliability work.

## Time-driven notifications

Calendar reminders and deadline notifications use
`scheduledNotifications/{id}`. Each row has its own delivery time, status,
attempt count, per-channel success timestamps and last error. Deterministic row
IDs make repeated materialisation and dispatch idempotent.

The worker is split into two modes:

- `materialise` runs the more expensive half. Every twenty minutes it performs
  bounded reads of upcoming calendar events and issues, fills the outbox three
  hours ahead, corrects moved reminders and cancels pending rows whose source is
  no longer valid.
- `dispatch` runs the cheap half. It reads at most 50 pending rows whose
  `nextAttemptAtMs` is due, sends them and records `sent`, `failed` or a backed-
  off retry. An idle pass is one bounded indexed query.
- `full` runs both halves; materialisation remains internally throttled.

Email and Telegram outcomes are tracked separately. If email succeeds and
Telegram fails, only Telegram is retried; a successful channel is not sent a
second time. Telegram failures are recorded per recipient, so one successful
digest cannot hide another recipient's blocked bot.

The dispatch and materialisation watermarks are also separate. A frequent
dispatch pass therefore cannot shorten the recovery window after the
materialiser was unavailable.

Materialisation is still a bounded periodic derivation, not yet a write-time
derivation. The final architecture is to rewrite affected outbox rows in every
server path that creates, moves or completes an event/deadline. Until that
invariant is implemented and tested, the twenty-minute materialiser is required.

## Trigger during hosted testing

`GET /api/cron/notifications` validates `Authorization: Bearer $CRON_SECRET` and
accepts `?mode=full|dispatch|materialise`.

The free external scheduler is an accepted temporary dependency while QuickTeam
is hosted on test infrastructure. Configure either:

- `?mode=full` every minute (the server self-throttles the expensive work); or
- `?mode=dispatch` every minute and `?mode=materialise` every twenty minutes.

Keep `.github/workflows/scheduled-notifications.yml` only as a fallback. GitHub
scheduled workflows are not punctual enough to be the primary production
trigger. `CRON_SECRET` must be identical in the deployed environment and in
every scheduler that calls the route.

## Trigger after moving to the own server

Run the same worker from a long-lived Node process under the service manager:
call `runScheduledNotificationSweep({ mode: 'full' })` every 30–60 seconds. The
outbox, idempotency and retry logic do not change; only the HTTP scheduler is
removed. For more than one application instance, ensure only one scheduler is
leader or let all instances call the idempotent endpoint with a distributed
claim before outbound delivery.

## Remaining operational visibility

- Show `system/notificationSweep` health and last successful materialisation in
  Settings.
- Show the last successful email/Telegram delivery and terminal channel errors.
- Mark a Telegram connection as needing attention after a permanent recipient
  error.
- Move event-driven external delivery onto a durable retry path.
