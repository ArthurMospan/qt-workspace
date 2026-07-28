<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# QuickTeam repository instructions

This is a single Next.js 16.2.6 App Router application with React 19 and Firebase. Read [README.md](README.md) before changing the project and consult the relevant document under `docs/` for integration or product-specific work.

## Framework and commands

- This is not the older Next.js API you may remember. Before changing routes, rendering, caching, metadata, proxy behavior, or other framework APIs, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecations.
- Authenticated routes live under `src/app/(app)`. API routes live under `src/app/api`. Request interception lives in `src/proxy.js`; do not reintroduce `middleware.js`.
- Use `npm run lint`, `npm run test:unit`, and `npm run build` as separate checks. Next.js does not run lint as part of the build.
- Firestore rule changes require `npm run test:rules:emulator`.
- After changing shared UI usage, run `npm run kit:scan` and commit the generated report when it changes.

## Architecture and security invariants

- `issues` is the canonical task collection. `tasks` is legacy/read-only; do not build new functionality on it.
- The organization roles are `owner`, `admin`, and `member`. Client collaboration lives in QuickTeam+, not in the internal workspace.
- Firestore rules are authoritative. Client permission checks and hidden UI are only defensive.
- Privileged creation/deletion of projects, issues, memberships, invitations, and API keys must go through authenticated server routes.
- Keep all organization-scoped reads and writes constrained by membership and organization/project scope.
- Run data migrations only through reviewed, idempotent Admin SDK scripts against an explicit Firebase project. Never trigger migrations during browser login.
- Keep organization deletion disabled until a tested owner-only server cascade safely handles Firestore and external assets.
- Drag-and-drop writes must update the optimistic overlay before awaiting Firestore and must roll back on failure.
- Use the shared UI in `src/components/ui`. `Dialog` is the common modal shell; the live `/ui-kit` route and its generated usage report are the component source of truth.
- QuickTeam+ uses a secondary Firebase app and a sealed server-side grant. Follow [docs/integrations/QUICKTEAM_PLUS.md](docs/integrations/QUICKTEAM_PLUS.md).

## Repository hygiene

- Never commit `.env*`, service-account keys, build output, logs, or local agent scratch data.
- Keep durable setup and architecture documentation under `docs/`. Do not add generated reports, session notes, or temporary plans to the repository root.
- Preserve user changes and verify references before deleting source files.
