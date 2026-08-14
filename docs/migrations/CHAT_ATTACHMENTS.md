# Private chat attachments

New chat attachments are uploaded with Cloudinary delivery type
`authenticated`. Firestore stores only the organization-owned public id and
format, not a delivery URL. The client asks
`POST /api/chat/attachments/access` for a five-minute signed URL; that route
checks Firebase authentication, organization membership, direct-message or
channel membership, and the exact attachment on the message before signing.

Existing chat files remain public until they are converted. Run the migration
once per organization. Dry-run is the default and does not call Cloudinary or
write Firestore:

```powershell
npm run migrate:chat-attachments -- --project quickteam-prod --organization org-id
```

Review every planned source and destination, freeze chat writes for that
organization, then apply with exact confirmations:

```powershell
npm run migrate:chat-attachments -- --project quickteam-prod --organization org-id --apply `
  --confirm-project quickteam-prod --confirm-organization org-id `
  --confirm-writes-frozen
```

The script requires Firebase Admin credentials and, for apply,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Destinations are deterministic. On a retry, an already-authenticated
destination is reused, and a Firestore document is updated only when its live
attachments still exactly match the reviewed value.

After apply, run dry-run again. `attachmentsPlanned`,
`otherOrganizationSkipped`, `unsupportedPathSkipped`, and
`missingFormatSkipped` must be zero before lifting the write freeze. This
repository does not run the migration during login or deployment.
