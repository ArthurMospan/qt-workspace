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
    "timezone": "Europe/Kyiv"
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
- Selected QuickTeam admins may map to qTicket `admin`; selected ordinary team
  members map to `member`, shown in qTicket as «Менеджер підтримки».
- Never send `client_admin` or `client_member`. External accounts belong to
  qTicket and its project-scoped invitation flow.
- Removing someone from the selection removes qTicket access on the next
  complete snapshot; it does not delete their historical work.
- QuickTeam sends only profile/branding facts it already owns. It never sends
  its tasks or projects during activation.
- Disabling the add-on sends a newer complete snapshot with
  `entitlement: "inactive"`. qTicket refuses new launches and existing qTicket
  sessions lose organization access on their next read, while client accounts,
  incidents, discussion and history remain preserved for later reactivation.

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

## Ownership table

| Data | Authority |
| --- | --- |
| Internal organization, branding, entitlement | QuickTeam |
| Staff available to qTicket | QuickTeam memberships and owner selection |
| Client projects, client users, incidents and workflow | qTicket |
| qTicket-to-QuickTeam exported task | QuickTeam after explicit export |

Incident-to-task export is a later, separate idempotent API contract. It must
not reuse the launch flow or imply shared database ownership.
