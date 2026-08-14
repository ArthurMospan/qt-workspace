# Member access and rate migration

This migration removes legacy payroll fields from member-readable documents,
moves them to server-only paths, and cleans stale member ids from project teams,
issue assignees, and issue watchers.

Run a dry-run first against one explicit organization:

```bash
npm run migrate:member-access -- --project quickteam-prod --organization org-id
```

Review the JSON counts, stop membership, workflow, project-team, and issue
assignment writes for that organization, then apply with exact confirmations:

```bash
npm run migrate:member-access -- --project quickteam-prod --organization org-id --apply --confirm-project quickteam-prod --confirm-organization org-id --confirm-writes-frozen
```

The script is idempotent. Re-run the dry-run after apply; every migration and
cleanup count should be zero. Repeat explicitly for each organization. Never run
it from a browser or login flow.
