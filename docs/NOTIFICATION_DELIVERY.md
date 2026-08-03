# How notification delivery should work

Written because the current arrangement is not a design, it is an accumulation:
a job that scans two collections asking "is anything due?", triggered by a
scheduler that does not honour its own schedule. This file separates the two
decisions hiding inside that sentence, says which one is actually broken, and
gives the target for the move to a real server.

## The two problems people call "notifications"

They have nothing in common except the word, and conflating them is why the
whole thing looks broken.

**Event-driven.** Someone assigns you a task, comments, mentions you, writes in
a channel. The trigger is a human action that is already executing server code.
`/api/notifications` fires Telegram inside that same request. Latency is one
HTTP round trip. **This has never been broken and needs no scheduler.**

**Time-driven.** Fifteen minutes before a meeting. Twenty-four hours before a
deadline. A birthday at 09:00. Nobody is clicking anything at the moment these
must fire, so something has to wake up. **This is the only broken part**, and it
breaks in two independent places.

## Decision A — the query model (host-independent, and the part that is wrong)

### What it does now: poll for due items

Every pass reads calendar events and issues and asks the database "is anything
due right now?".

- Cost scales with **total data**, not with how many reminders are due. Ninety-
  nine passes out of a hundred find nothing and pay the full price anyway. This
  is what consumed the Firestore free read quota.
- A pass that does not run inside the look-back window loses the reminder
  outright. The watermark now closes that hole, but needing a watermark at all
  is a symptom: correctness depends on the scheduler's punctuality.
- There is no per-notification state. One Telegram send failing — a blocked bot,
  a stale chat id — cannot be retried, is not recorded, and is invisible.

### What it should do: a scheduled outbox

At the moment a reminder becomes *knowable* — the event is created, the deadline
is set — write one row:

```
scheduledNotifications/{id} = {
  deliverAt, userId, organizationId, channel, type, payload,
  status: 'pending' | 'sent' | 'failed' | 'cancelled',
  attempts, lastError, sourceKey
}
```

The worker then runs exactly one query, forever:

```
where('status', '==', 'pending')
  .where('deliverAt', '<=', now)
  .orderBy('deliverAt')
  .limit(50)
```

What that buys:

- **Cost is proportional to work.** An idle pass reads nothing. Polling every
  sixty seconds becomes affordable on the free tier — the cadence problem stops
  being a cost problem.
- **A late pass is late, never lossy.** Rows do not expire. No watermark, no
  look-back window, no arithmetic that can be wrong.
- **Retries and receipts fall out for free.** `attempts` and `lastError` are
  already in the row, so a failed send backs off and retries, and Settings can
  finally answer "did my last notification actually arrive?".
- **Cancellation becomes explicit.** Moving an event rewrites its pending rows;
  deleting it cancels them. Today that is implicit in re-reading live data,
  which works but cannot express "this reminder is no longer wanted".
- **It is host-independent.** Identical on Vercel + Firestore today and on a VPS
  + Postgres later. The migration changes the trigger, not the logic.

The cost of the model is the one thing to keep honest: a reminder is now derived
at write time, so every path that changes an event's start, its reminder list,
its participants or its deadline must rewrite the rows. That is a real
invariant, and it is worth a test rather than a comment.

## Decision B — the trigger, ranked for this project

### 1. The application's own scheduler — the target once QuickTeam has a server

One long-lived Node process with `setInterval` at 30–60 seconds, or `node-cron`
if the code should read like a schedule. Under `systemd` so a crash restarts it.

Zero external dependencies, zero cost, sub-minute precision, and with the outbox
above it is about fifteen lines. **This is the end state.** Everything below is
scaffolding for the period before it exists.

### 2. An external HTTP cron — what to do today, without changing anything

`/api/cron/notifications` already exists and already validates a bearer token.
Point a real scheduler at it:

- **cron-job.org** — free, one-minute granularity, honours it, sends custom
  headers, emails on failure. Five minutes of setup, zero code change.
- **UptimeRobot** — five-minute granularity, worth adding as a second trigger so
  one provider's outage is not an outage.

Two triggers hitting the same idempotent endpoint is not a problem; it is the
cheapest redundancy available.

### 3. Cloud Scheduler + Cloud Functions

The Google-native answer. Needs the Blaze plan, which is worth understanding
correctly: **Blaze is not "the paid plan"** — it keeps the same free quotas and
bills only above them, so at this project's volume it is roughly zero. Cloud
Scheduler includes three free jobs. It also unlocks Firestore triggers, which
would let a write to `scheduledNotifications` schedule its own delivery.

Costs a card on file and a second runtime to maintain.

### 4. Per-message scheduling, no polling at all

Cloud Tasks, Vercel Queues, or a workflow engine: when the reminder is created,
schedule **one** task for its exact timestamp. Perfect precision, zero idle cost,
no worker loop. Theoretically the best answer and unnecessary for a beta — but
note that the outbox above is the migration path to it, because the rows already
carry everything such a task would need.

### Last — GitHub Actions, where this started

Measured on this repository over 59 runs, a `*/5 * * * *` schedule actually
starts a run every 60–210 minutes. GitHub documents scheduled workflows as
best-effort and deprioritises them on free tiers; using Actions as production
infrastructure is also against the spirit of its terms. It stays wired up as a
fallback because a broken fallback is worse than none, but it should not be the
thing anyone relies on.

## What Telegram itself requires

Nothing that is currently wrong. `sendMessage` is synchronous and reliable, the
integration already uses webhooks rather than long polling, and the webhook is
already registered on connect. The failure mode that matters is a *recipient*
becoming unreachable — bot blocked, chat deleted — which Telegram reports as a
403 on send. That is a per-message fact, which is another argument for the
outbox: today it is a line in a log, and it should be a flag on the connection
that Settings can show.

## Order of work

1. Point cron-job.org at `/api/cron/notifications`. No code, five minutes,
   fixes the latency today.
2. Move time-driven notifications onto the outbox. Host-independent, kills the
   read cost, and delivers the retry/receipt work as a side effect.
3. When QuickTeam gets its own server: delete the external cron, run the worker
   in-process, keep everything else.
