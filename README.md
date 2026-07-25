# QuickTeam Workspace

Internal multi-tenant task and project workspace built with Next.js 16, React 19 and Firebase.

## Requirements

- Node.js 20+
- Java 21+ for the Firestore emulator
- A Firebase project for local development
- Cloudinary credentials for file uploads
- Optional Resend credentials for email notifications

## Environment

Create `.env.local` with:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PORTAL_URL=
RESEND_API_KEY=
EMAIL_FROM=

# Optional Telegram bot integration
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

`NEXT_PUBLIC_*` values are shipped to the browser. Never put Admin SDK, Cloudinary secret, email-provider secret, API keys or other credentials in a public variable.

For Telegram, create one bot through BotFather, put its token and username in the server-only variables above, and use a random webhook secret (32+ characters). The app registers `/api/integrations/telegram/webhook` when a user or organization starts a connection. `NEXT_PUBLIC_APP_URL` must therefore be a public HTTPS origin outside local development.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run test:rules:emulator
```

On Windows with Firebase CLI 15 and Node 24, the rules assertions can finish successfully while the CLI reports an error during emulator shutdown. Always check the Node test summary (`pass`, `fail`) separately from that known teardown error.

## Security model

- Firebase ID tokens authenticate API requests.
- `/api/auth/session` exchanges an ID token for an HTTP-only Firebase session cookie used by Next.js Proxy.
- Firestore rules remain authoritative for browser Firestore access.
- Memberships are created only by the onboarding bootstrap or authenticated invitation APIs; client self-join is forbidden.
- Projects and issues are created through server APIs so plan limits, sequential issue keys and audit records are atomic.
- API keys live under a server-only Firestore path and are stored as SHA-256 hashes. The clear-text token is returned only once.
- Cloudinary signing, notifications/email, invitations and integration endpoints are authenticated and rate-limited.
- User documents are private; shared team profile fields and presence are organization-scoped.

## Data model

Primary collections:

- `organizations` and `orgMemberships`
- `projects` and `stages`
- `issues`, with `comments` and `audit` subcollections
- `issueLinks`, `sprints`, `timeLogs`, `invoices`
- `notifications`; presence under `organizations/{orgId}/presence`
- organization-scoped `channels`, `messages` and `readState`

`tasks` is a legacy read-only collection. New development must use `issues`.

## Development rules

- Read the versioned Next.js guides in `node_modules/next/dist/docs/` before changing framework APIs.
- Do not run migrations from browser login flows. Use reviewed Admin SDK scripts against an explicit project.
- Do not add direct client creates/deletes for projects, issues, memberships or API keys.
- Any Firestore rule change must include or update emulator assertions in `tests/firestore.rules.test.mjs`.
