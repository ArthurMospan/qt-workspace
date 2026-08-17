# What is new to whom: one feed, one cursor

A task tells its reader two kinds of news — somebody said something, and somebody
changed something. The product used to treat them as unrelated: messages had a
boundary and a count, changes had a feed entry nobody marked, and the dot on a
card stood for both without saying which.

There is no second data model for this. Everything below rides on what already
existed: the `issues/{id}/audit` subcollection, the per-user cursor in
`organizations/{orgId}/issueReadState/{uid}_{issueId}`, and `lastActivityAt` on
the task document. No new field, no new query, and nothing extra read per row of
a list.

## The pieces

- `src/lib/utils/issueAuditEvents.mjs` — which field changes are worth logging
  (`AUDITED_ISSUE_FIELDS`) and how one reads out (`describeAuditEvent`). Pure, no
  React. Covered by `tests/issue-audit-events.test.mjs`.
- `src/lib/utils/issueReadState.mjs` — the cursor rules: `isIssueUnread` for a
  card, `isIssueChangeUnread` for one line of history, `unreadActivityLabel` for
  what the dot is about. Covered by `tests/issue-read-state.test.mjs`.
- `src/lib/services/issueReadState.js` — the writes: consume on leaving
  (`scheduleIssueSeen` / `cancelScheduledIssueSeen`) and `markIssueUnread`.
- `src/components/IssueReadStateBridge.jsx` — one organization-wide cursor
  listener at the workspace boundary. Unchanged, and the reason a board of five
  hundred cards costs no reads for any of this.

## The rules

1. **The list of audited fields lives next to the phrases that read it.** They
   were in different files and drifted: three fields were logged while the
   timeline knew how to say five, so a moved deadline left no trace anywhere in
   the product. Adding a field to `AUDITED_ISSUE_FIELDS` and giving it a label in
   the same module is the whole change.
2. **Nothing names a status, priority, type, label or sprint from a table of its
   own.** `describeAuditEvent` is handed the live workflow, and statuses resolve
   through `statusLabel`. A hard-coded map of seven status ids is what made a
   project that renamed «QA» read somebody else's word for it, and a project that
   added a status read a raw id.
3. **One boundary for the whole feed.** Messages and changes are two kinds of the
   same question — «що тут сталося без мене» — so `UnreadDivider` counts both.
4. **The two halves are consumed differently, on purpose.** A message is read
   when the boundary has been on screen for half a second (`readBy` per comment).
   A change is read when the reader *leaves the task*. Rendering the detail used
   to advance the cursor, which broke the one case the boundary exists for: open
   a task, get called away, come back to a task that already counts as read.
5. **Leaving is not the same as unmounting.** Opening a task through a
   non-canonical link replaces the address a beat later and remounts the detail,
   so the consume is scheduled with a short delay and a fresh mount of the same
   task cancels it. A browser killed with a task open leaves it unread — the
   forgiving direction of the two.
6. **Your own activity is never new to you.** The dot, the boundary and the count
   all drop the current user's own entries. It is also why «Позначити
   непрочитаним» is offered only when somebody else acted last: marking your own
   change unread would light nothing.
7. **Marking unread never resets a cursor that already sits further back.** The
   cursor moves to just before the newest activity, so the dot returns and the
   boundary lands on the change that made you want to come back — while older
   changes you never saw stay unseen.
8. **The comparison is server clock against server clock.** `audit.createdAt` is
   written by Firestore, and the cursor it is measured against was copied from the
   task's own `lastActivityAt`. That is why the boundary needs no cursor of its
   own and no per-entry timestamp written by a client.

## Deliberate omissions

- **Time logs do not move the boundary.** Logging time deliberately does not
  touch `lastActivityAt` (see the comment in `issueReadState.mjs`), so counting it
  here would draw a line for something no card ever announced.
- **Comments are not audit entries.** A message is its own thing in the feed with
  its own read receipts; mirroring it into the history would be a second copy of
  the same fact.
- **Creating a task is not a change to it.** A new task is new in full; it has no
  fields that changed.
- **Marking a selection read is not implemented.** `ISSUE_BULK_ACTIONS` is a
  server-validated registry of writes to task documents, and a read cursor is a
  document of the user's own in another collection. It would be a client-only
  action wearing a server action's clothes, and it is a separate change.

## Extending it

Add the field to `AUDITED_ISSUE_FIELDS`, give it a label (and a value formatter
if it is not a plain string) in the same module, and write it from wherever that
field is saved. Server routes that already write `lastActivity*` also write their
own audit entry in the same transaction — `api/issues/[issueId]/status` is the
example to copy.
