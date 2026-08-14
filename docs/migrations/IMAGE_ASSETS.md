# Organization-scoped image assets

Legacy profile avatars and organization logos were uploaded below
`quickteam/avatars/`. That path does not prove tenant ownership, so the product
correctly refuses to delete those files. New uploads use
`quickteam/organizations/{organizationId}/avatars|logos` and persist the
Cloudinary public id beside the delivery URL.

Run the migration once per organization. It scans only that organization's
document and current member profiles. Dry-run is the default and does not call
Cloudinary:

```powershell
npm run migrate:image-assets -- --project quickteam-prod --organization org-id
```

Review the printed source/destination list, freeze avatar/logo changes for the
organization, then apply with exact confirmations:

```powershell
npm run migrate:image-assets -- --project quickteam-prod --organization org-id --apply `
  --confirm-project quickteam-prod --confirm-organization org-id `
  --confirm-writes-frozen
```

The script uses Firebase Admin credentials plus `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from the environment. Apply
is idempotent: destination ids are deterministic, an existing destination is
reused, and Firestore is updated only when the live URL still matches the
value classified by the script.

Re-run dry-run after apply. `legacyMovesPlanned` and
`metadataBackfillsPlanned` must both be zero before the write freeze is lifted.
