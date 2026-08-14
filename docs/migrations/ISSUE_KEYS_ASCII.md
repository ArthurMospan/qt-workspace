# Historical issue-key migration

QuickTeam now creates URL-safe ASCII issue prefixes containing at least one
Latin letter. Older organizations may still contain Cyrillic keys such as
`МАЧ-1` or numeric-only prefixes such as `111-1`.

The product recognizes these historical keys immediately and canonicalizes an
opened URL. The migration makes that result durable: it updates the project
prefix when the stored prefix is no longer valid, replaces each affected
`issues.issueKey`, and appends the previous key to `legacyIssueKeys`. Old links
therefore continue to resolve and are replaced in the address bar by the new
ASCII URL.

Run one dry-run per explicit organization. The command never writes by default:

```powershell
npm run migrate:issue-keys -- --project quickteam-prod --organization org-id
```

Review every project and issue operation in the JSON report. In particular,
`collisions` must be empty. Stop project creation and all task writers for that
organization, then apply with exact confirmations:

```powershell
npm run migrate:issue-keys -- --project quickteam-prod --organization org-id --apply `
  --confirm-project quickteam-prod --confirm-organization org-id `
  --confirm-writes-frozen
```

The script uses Firebase Admin credentials from the environment. It never runs
from a browser or login flow. Targets come from the same canonicalizer used by
task links, target collisions stop apply before any write, and each live
document is rechecked transactionally. Re-running an interrupted apply is safe.

After apply, run the dry-run again before lifting the write freeze.
`projectPrefixesPlanned` and `issueKeysPlanned` must both be zero. Keep the
reported `legacyIssueKeys`; they are the redirect aliases for links already in
chat, notifications, email, or browser history.
