# What a complete QuickTeam still needs

The things a product is expected to have that nobody writes a ticket for, because
each one is invisible until it is missing. Every entry below was verified against
this repository rather than recalled from a checklist. Items marked **done** were
closed while this list was written and are kept for the reasoning; the rest are
open.

`docs/ROADMAP.md` holds product direction. This file holds the tail.

## Delivery and notifications

- **done — the scheduler was silently eating most reminders.** The sweep asked
  GitHub Actions for a run every five minutes; measured over 59 runs it started
  one roughly every 60–90 minutes by day and every 2–3.5 hours overnight. Against
  a fixed ten-minute look-back that is not a delay, it is a filter: a reminder
  whose trigger fell in a gap was never delivered at all. The sweep now carries a
  watermark. **The durable fix is still open**: move the trigger to something
  that honours a schedule — an external free cron (cron-job.org, UptimeRobot) or
  a Vercel plan whose cron granularity is not one run per day.
- **done — overdue tasks renotified every day, forever.** Now: the day it slips,
  the day after, then weekly, and nothing at all past four months.
- **done — one Telegram message per notification, in plain text.** Now one
  digest per person per sweep, with a glyph per event type and a real button.
- **done — chat had no switch.** Connecting Telegram meant a push per message in
  every channel; the only remedy was to disconnect.
- **done — the sweep polled for due items instead of scheduling them.** Rows
  now carry their own delivery time; a pass costs one indexed query and nothing
  when nothing is due. See [NOTIFICATION_DELIVERY.md](NOTIFICATION_DELIVERY.md).
- **Open: no delivery receipt anywhere.** When a Telegram send fails the warning
  is now recorded on the outbox row and retried with backoff, but nothing shows
  it. A person whose bot was blocked, or whose
  chat id went stale, is silently unreachable forever. Settings should show the
  last successful delivery per channel, and a failed send should mark the
  connection as needing attention.
- **Open: no visible health for the sweep.** `system/notificationSweep` now
  records `lastRunAtMs` and per-pass counts. Nothing surfaces it. One line in
  Settings — «Останнє опитування: 4 хв тому» — converts "I don't trust these
  notifications" into a fact.
- **Open: no digest.** Every event is a separate interruption. A daily or
  end-of-day summary («3 задачі на завтра, 1 прострочена») is usually the only
  notification people keep switched on long-term.

## The browser tab and the window

- **done — every screen's title was "QuickTeam".** Now derived from the
  breadcrumb trail, so a detail screen names the thing you are looking at.
- **done — no manifest, no home-screen icon beyond a 32px favicon.**
- **Open: the favicon never changes.** The tab title carries the unread count;
  the icon does not. A canvas-drawn dot on the favicon is the signal people
  actually catch out of the corner of their eye.
- **Open: no Open Graph image or description.** Paste a QuickTeam link into any
  chat and it renders as a bare URL. An `opengraph-image` route plus a per-issue
  title would make a shared task read as a task.
- **Open: no notification permission flow.** The workspace has in-app, email and
  Telegram, but never asks for the Web Notification permission, which is the one
  channel that works on a laptop with the tab in the background and costs
  nothing to run.

## Load, failure and the states between

- **done — no 404 page**, no root error boundary, no `robots.txt`.
- **done — no `loading.js` anywhere.** The `(app)` group now has a skeleton
  shaped like the screen that is arriving.
- **done — nothing reacted to going offline.** A persistent strip now says so,
  driven by `navigator.onLine`.
- **Open: session expiry is handled per call site.** Two files translate an
  expired token into Ukrainian; everywhere else it surfaces as a generic
  failure. One interceptor that recognises an expired session and offers to
  re-authenticate in place, without losing the form, is the difference between
  an annoyance and lost work.
- **Open: a failed background write has no retry.** The optimistic overlay rolls
  back on failure, which is correct, but the person is left to redo the action by
  hand with no record of what was lost.

## Performance

- **Open: fonts load from Google over a render-blocking `@import`.**
  `globals.css` line 2 pulls Inter and Roboto Condensed from
  `fonts.googleapis.com` inside a CSS import, which is the slowest form: the
  browser must fetch and parse the stylesheet before it can even start the font
  request, and text is invisible or reflows until it lands. `next/font/google`
  self-hosts both, removes the third-party round trip and eliminates the layout
  shift. Deferred here only because it will move type by a pixel or two and the
  visual baselines need regenerating in the same change.
- **Open: a third-party script loads on every page including the login screen.**
  `buggy-bag-standalone.js` is fetched from another origin with its API key in
  the public HTML, before anyone has authenticated. It belongs behind the
  authenticated boundary at minimum.
- **Open: no bundle budget.** Nothing fails when a page's JavaScript doubles.

## Keyboard, focus and reach

- **done — no skip link.** Tab now reaches the content first.
- **done — focus-visible was styled in three places and nowhere else.** There is
  a default ring, with its own colour on the dark sidebar and bottom bar where
  the ink ring is invisible.
- **done — no keyboard shortcut help.** `?` opens the cheat sheet.
- **Open: no visible focus trap audit on the sheets.** The mobile «Ще» sheet is
  correctly `role="dialog"`, but nothing stops Tab from walking behind it.

## Repository and operations

- **The GitHub repository is public.** `ArthurMospan/qt-workspace` answers to an
  unauthenticated API call. Nothing secret is committed — the checks for that
  hold — but the full data model, the Firestore rules and every internal route
  are readable by anyone, which is a meaningful head start for someone probing
  the deployment. If that is deliberate, it should be written down here; if it
  is not, it is one setting.
- **The production project is on Firestore's free read quota**, and the sweep
  described above was its largest consumer. The queries are now bounded, but
  nothing measures the daily total or warns before it is spent.

## Ideas worth building, in the order I would build them

1. **done — Command palette (⌘K).** Navigation, actions, projects and live task
   search in one list, with the catalogue and its ranking as pure functions.
   Still worth adding: "start timer on QT-12" and jumping to a person.
2. **An "unread" concept for tasks, not just chat.** The chat badge is solid.
   Tasks have no equivalent, so "what changed while I was away" is unanswerable
   without opening each one. A per-issue last-seen cursor plus a dot in the board
   card is the same mechanism already written for channels.
3. **Undo on destructive actions.** A five-second «Скасувати» in the existing
   toast is worth more than any confirmation dialog, and lets several dialogs be
   deleted outright.
4. **Saved views.** Filters exist and evaporate on reload. Naming a filter set
   and pinning it to the sidebar is how a board becomes someone's daily screen.
5. **A real "my day".** `/my` is a task list. Merging today's calendar events,
   today's deadlines and the running timer into one first screen is the thing
   people would actually open the app to see.
6. **Bulk actions on the board.** Shift-select and one status/assignee change,
   instead of dragging cards one at a time.
7. **Telegram two-way.** Tasks can already be created from a group. Replying to
   a notification to comment, or pressing a button to take a task, closes the
   loop and makes the bot worth keeping connected.
8. **Weekly review email.** What you closed, what slipped, what is due — the one
   message that makes the time tracking pay off for the person entering it.
