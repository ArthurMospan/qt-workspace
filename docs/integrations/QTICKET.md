# qTicket add-on contract

qTicket is a separate incident-management SaaS add-on. QuickTeam is the source
of truth for the internal organization, its branding, add-on entitlement and
the existing team members an owner may enable for support. qTicket owns its
client projects, incidents and external client accounts. The products do not
share Firebase projects, databases or primary browser sessions.

Both repositories implement version 1. QuickTeam has the owner-only activation,
existing-member selection, signed provisioning and authenticated launch routes;
qTicket consumes the complete snapshot and issues its own one-time Firebase
session. Production use still requires matching environment values on both
deployments and a live multi-account acceptance check.

## Environment

```text
NEXT_PUBLIC_QTICKET_URL=https://qticket.example.com
QUICKTEAM_QTICKET_SHARED_SECRET=<same random 32+ character server secret as qTicket>
```

The URL may be public because the browser is redirected to it. The shared
secret is server-only.

In the product the owner opens **Налаштування → Інтеграції → qTicket**, chooses
active QuickTeam members and clicks **Активувати**. The owner is always included.
After activation, selected people also get a qTicket row in desktop and mobile
navigation. Opening it requests a fresh single-use launch rather than reusing a
browser token.

## Request signing

For every server request generate a fresh base64url nonce and Unix timestamp.
Compute lowercase HMAC-SHA256 over the exact bytes:

```text
v1\n<Timestamp>\n<Nonce>\n<exact JSON body>
```

Send the digest as `X-QT-Signature`, plus `X-QT-Timestamp` and `X-QT-Nonce`.
qTicket uses a five-minute window and refuses nonce reuse.

## Activation and staff sync

The owner activates qTicket from QuickTeam and chooses staff only from the
organization's existing active memberships. QuickTeam sends the complete
desired snapshot to:

```text
POST <NEXT_PUBLIC_QTICKET_URL>/api/integrations/quickteam/provision
```

Payload version 1:

```json
{
  "version": 1,
  "sourceOrganizationId": "quickteam-org-id",
  "revision": 1,
  "entitlement": "active",
  "organization": {
    "name": "Organization name",
    "logo": "https://cdn.example/logo.png",
    "sidebarTheme": "dark",
    "sidebarColor": "",
    "timezone": "Europe/Kyiv",
    "portal": {
      "name": "OneB Підтримка",
      "logo": "",
      "sidebarTheme": "light",
      "sidebarColor": ""
    }
  },
  "staff": [
    {
      "sourceUserId": "quickteam-user-id",
      "email": "owner@example.com",
      "name": "Owner name",
      "avatar": "https://cdn.example/avatar.png",
      "role": "owner"
    }
  ]
}
```

- `revision` increases for every entitlement, branding or selected-staff
  change. Retrying the same revision is safe.
- The current QuickTeam owner is always selected as the one `owner`.
- Each selected person carries the qTicket role the owner chose for them on the
  card, which need not be the role they hold here: `admin`, or `member` shown
  in qTicket as «Менеджер підтримки». Absent an explicit choice it is their
  QuickTeam role, which is what the whole selection used to be — so running the
  desk meant a promotion in the whole product, and a support manager could not
  be an administrator of support alone. The owner is not overridable: the
  organization document names exactly one and qTicket refuses a snapshot that
  disagrees.
- `organization.portal` is optional and carries the brand qTicket wears — on
  the staff rail, the client portal, the organization picker and the tab title
  alike. The fields outside it are the organization as QuickTeam knows it, and
  they are what qTicket shows when `portal` is absent; a present `portal` is
  the desk allowed to look like «OneB Підтримка» rather than like the company.
  It was documented on 2026-09-01 as «the brand a customer sees» beside a staff
  shell that kept the organization's own name, and that split lasted one day:
  the owner set a desk name and found it on the customer's rail only. An empty
  field inside a present `portal` inherits that one field, so renaming the
  desk does not cost you your logo. QuickTeam still owns the value — qTicket
  does not edit it and overwrites its copy from every snapshot.
- Never send `client_admin` or `client_member`. External accounts belong to
  qTicket and its project-scoped invitation flow.
- Removing someone from the selection removes qTicket access on the next
  complete snapshot; it does not delete their historical work. The card asks
  before it sends one: it archives that person's seat and takes them off every
  client roster in the other product, and it used to happen on a chip's ×.
- The response may carry `conflicts`: people qTicket refused a seat because
  they already hold a *client* seat in that organization. One membership is one
  role, so a staff seat written over a customer would hand an external person
  every other customer's queue and move everything they ever wrote from «клієнт
  написав» to «підтримка відповіла». qTicket skips them; QuickTeam stores the
  list under `lastConflicts` and the card names them, because for one release
  this was returned and dropped and the owner saw a green toast over a colleague
  who got nothing.
- QuickTeam sends only profile/branding facts it already owns. It never sends
  its tasks or projects during activation.
- Disabling the add-on sends a newer complete snapshot with
  `entitlement: "inactive"`. qTicket refuses new launches and existing qTicket
  sessions lose organization access on their next read, while client accounts,
  incidents, discussion and history remain preserved for later reactivation.

## Connection probe

`POST /api/integrations/qticket/ping` (QuickTeam, any member of the
organization) asks qTicket what it actually holds, and forwards:

```text
POST <NEXT_PUBLIC_QTICKET_URL>/api/integrations/quickteam/ping
{ "version": 1, "sourceOrganizationId": "quickteam-org-id" }
```

The card used to answer «а воно взагалі працює?» out of this database — the
revision QuickTeam believes it sent, which after a failed provisioning looks
exactly like a successful one. A reply proves the origin, the shared secret and
the two clocks agree as a side effect of arriving; `inSync` compares the
revision qTicket stored against the one recorded here.

The answer also carries `portalUrl` — where a customer of this tenant signs in.
QuickTeam cannot work that out, because the origin is qTicket's own deployment
setting, and until this existed «куди я відправляю клієнтів?» was answered by
asking somebody. An unreachable qTicket is reported as `reachable: false` with
the reason, not as a failed request: finding out is the point of the button.

## Opening qTicket

An enabled internal user clicks qTicket inside QuickTeam. The QuickTeam server
verifies its own session, then sends a signed request to:

```text
POST <NEXT_PUBLIC_QTICKET_URL>/api/integrations/quickteam/launch
```

```json
{
  "version": 1,
  "sourceOrganizationId": "quickteam-org-id",
  "sourceUserId": "quickteam-user-id",
  "returnTo": "/overview"
}
```

qTicket returns a short-lived `launchUrl`. Redirect the browser there without
placing the QuickTeam ID token, session cookie or shared secret in the URL. The
opaque code is single-use and expires after 90 seconds; qTicket consumes it on
its own origin and creates its own Firebase session.

## The unread badge on the rail

The qTicket row draws a number when that person has unread qTicket
notifications, so somebody working in QuickTeam sees that a client wrote
without opening the other product. `GET /api/integrations/qticket` — the call
the rail already makes on every mount — answers with `unread` beside the
integration status, and asks qTicket for it with the same signature:

```text
POST <NEXT_PUBLIC_QTICKET_URL>/api/integrations/quickteam/unread
```

```json
{
  "version": 1,
  "sourceOrganizationId": "quickteam-org-id",
  "sourceUserId": "quickteam-user-id"
}
```

qTicket answers `{ "version": 1, "unread": 3 }` and nothing else. No incident
title, no client name, no issue key: the badge is a reason to open qTicket, not
a copy of the bell that lives there, and the copy would be a second inbox to
keep truthful.

Three rules this side owns:

- **Ask only for a row that exists.** No request is sent unless the add-on is
  active and this user is in the synchronized staff selection.
- **One answer a minute per person**, cached in the server instance. The rail
  asks on every mount; a page reload must not become a cross-service request.
  The badge is allowed to be a minute stale.
- **A failure is an absent badge, never a zero that means «nothing new».** If
  qTicket cannot be reached the row still opens the product, and the miss is not
  cached — the next mount asks again.

qTicket refuses the same way it refuses a launch: `inactive` when the add-on is
off, `not_enabled` when the person holds no internal seat there.

## Receiving a task from qTicket

The only two endpoints in this contract that QuickTeam serves rather than calls.
qTicket signs them with the same shared secret, the same headers and the same
five-minute window; `verifyQTicketRequest` is the mirror of the verifier on the
other side, and the nonce is recorded here because everything qTicket asks of
QuickTeam changes something.

```text
POST /api/integrations/qticket/projects
POST /api/integrations/qticket/tasks
```

Both name a person the way provisioning did — `sourceUserId` — and both refuse
unless three things still hold: the add-on is active, this organization selected
this person for qTicket, and their internal seat is still there. A staff
selection that shrank takes the transfer right with it.

`projects` answers with the list that person would see here: every project of
the organization for an owner or an admin, the ones they are on for everybody
else, minus anything archived, being deleted, or read-only because the plan's
ceiling moved. A picker that offers what the next step refuses is worse than no
picker.

`tasks` creates one task through `createIssueForActor` — the same path
`POST /api/issues` uses, so the key, the counters, the audit row and the
reminder rows are the ones any task here would have. Nothing about it says
«imported»: it is a task, and the person who pressed the button in qTicket is
its author.

**One task per request, however many times it is sent.** `qticketTransfers/{id}`
is claimed before the task is written and deleted if the write fails, so a
repeat returns the first task (`status: "existing"`) and a failed attempt does
not lock the request out forever. A repeat that arrives while the first is still
in flight is refused with `transfer_in_progress` rather than queued.

`integrationNonces` and `qticketTransfers` are server-only; `firestore.rules`
denies both to browsers explicitly. On the qTicket side the answer is stored
where a customer cannot read it either — where their supplier tracks the work is
internal routing, not part of their request.

## Ownership table

| Data | Authority |
| --- | --- |
| Internal organization, branding, entitlement | QuickTeam |
| Staff available to qTicket | QuickTeam memberships and owner selection |
| Client projects, client users, incidents and workflow | qTicket |
| qTicket-to-QuickTeam exported task | QuickTeam after explicit export |

Incident-to-task export is the separate idempotent contract described above. It
reuses no session and no launch code, and implies no shared database ownership:
QuickTeam stores the id of the request a task came from, qTicket stores a link
to the task, and neither reads the other's records.
