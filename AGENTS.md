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
- Treat the authenticated workspace and `/ui-kit` as one UI contract. A change to a shared component must update its live workspace usage and its `/ui-kit` preview in the same change.
- A new reusable visual component must be created under `src/components/ui`, exported from `src/components/ui/index.js`, used by the product, and rendered in `/ui-kit` in the same change. Do not add unused showcase-only components.
- `/ui-kit` is the only reference page, and it is a catalogue of components. A report is a generated JSON file and a failing test, never a screen in the catalogue.
- A component the product does not use is deleted, not kept for later. `npm run test:unit` fails while anything in `src/components/ui` is unreachable. A component reached only through another kit component (TopHeader renders Breadcrumb) counts as used and is previewed by its host.
- A screen whose layout differs is a named context on a shared layout component, not hand-written markup. Settings, Team and Chat all render `SidebarLayout` with `context="settings" | "team" | "chat"`; the gutter, the rail width and the 56px header offset live in `CONTEXTS` and nowhere else.
- Do not introduce a local component or visual pattern that is merely similar to an existing UI Kit component. Reuse the shared component, add an explicit named context/size/preset, or mark and document the intentional local exception in `docs/UI_KIT_CONTRACT.md`.
- After changing product UI, shared UI, or UI Kit previews, run `npm run kit:scan`, then `npm run kit:drift`, then `npm run kit:audit` (that order — the later two read the earlier output), and commit all three generated reports when they change.
- A variant is declared by the implementation, never by a list. `scripts/kit-variants.mjs` derives the manifest from component lookup maps and `data-ui-*` rules in `globals.css`; `/ui-kit` → «Матриця варіантів» renders every declared value. Adding a variant therefore means adding a map entry or a CSS rule — never a hand-written preview.
- `kit:drift` enforces three zeros: no variant value the manifest does not declare, no component prop outside the manifest, and no `className` on a kit component that redefines its geometry or typography. `npm run test:unit` fails if any becomes non-zero.
- `kit:drift` enforces a fourth zero: every variant the product ships is visible in the catalogue. «Матриця варіантів» renders each declared value from the manifest, so adding a variant creates its preview; a component that cannot stand alone must be listed in `VARIANT_ELSEWHERE` with the section that does show it.
- Do not document a command, report, or screen that does not exist. `npm run test:unit` resolves every `npm run …` named in this file and in `docs/UI_KIT_CONTRACT.md` against `package.json`.
- The reports cannot see that a control moved four pixels. `npm run test:visual` photographs every `/ui-kit` section and diffs it against a committed baseline. Baselines live in `tests/visual/__screenshots__`, are rendered by the `UI Kit screenshots` workflow on Linux, and are never written from a developer machine — locally the same command runs as a smoke test with pixel comparison off. Accept a deliberate visual change by running that workflow with `update_baselines`, which commits the new PNGs.
- Geometry, spacing and type scales belong in `globals.css` behind a named `composition`; do not reintroduce a free-value prop (`iconSize`, a raw avatar pixel size) that lets a call site hold its own copy of a kit decision.
- Positioning a component in its parent (`flex-1`, `h-full`, margins) is legitimate composition and is reported as benign. Redefining the component itself is not.
- QuickTeam+ uses a secondary Firebase app and a sealed server-side grant. Follow [docs/integrations/QUICKTEAM_PLUS.md](docs/integrations/QUICKTEAM_PLUS.md).

## Repository hygiene

- Never commit `.env*`, service-account keys, build output, logs, or local agent scratch data.
- Keep durable setup and architecture documentation under `docs/`. Do not add generated reports, session notes, or temporary plans to the repository root.
- Preserve user changes and verify references before deleting source files.
