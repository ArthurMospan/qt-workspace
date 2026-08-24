// src/lib/utils/organizationList.mjs
// The workspaces a person belongs to, assembled from their memberships.

/**
 * One entry per membership, always.
 *
 * A membership is the proof that a workspace exists for this person — access is
 * `orgMemberships` and nothing else. The organization document only supplies the
 * name, the logo and the branding, so a document that did not come back is a
 * read that fell short, never a workspace that stopped existing: organization
 * deletion is disabled in the rules, and the membership naming it was just read
 * from the same database.
 *
 * Building the list out of the documents instead let a short read delete a
 * workspace from the switcher — and leave it deleted, because nothing re-runs
 * until a membership changes. `getDocs` answers from the local cache whenever
 * the SDK believes it is offline, and a cache that never held one of those
 * documents answers short without failing, so there is nothing to catch.
 *
 * An entry whose document is missing keeps whatever was last known about it and
 * is marked `pending`, so the workspace stays reachable and the caller can go
 * back for the document rather than pretend the workspace is gone.
 *
 * @param {Array<{orgId?: string, role?: string}>} memberships the `orgMemberships` documents' data, in snapshot order
 * @param {Array<{id?: string}>} organizationDocuments whatever the organizations read returned
 * @param {Array<{id?: string}>} knownOrganizations the list published last, so a name survives a short read
 */
export function buildOrganizationList(
  memberships = [],
  organizationDocuments = [],
  knownOrganizations = [],
) {
  const byId = new Map();
  for (const organization of knownOrganizations) {
    if (organization?.id) byId.set(organization.id, organization);
  }
  for (const organization of organizationDocuments) {
    if (organization?.id) byId.set(organization.id, organization);
  }

  const organizations = [];
  const roles = {};
  const seen = new Set();

  for (const membership of memberships) {
    const orgId = membership?.orgId;
    if (!orgId || seen.has(orgId)) continue;
    seen.add(orgId);
    if (membership.role) roles[orgId] = membership.role;
    const known = byId.get(orgId);
    organizations.push(known ? { ...known, id: orgId } : { id: orgId, pending: true });
  }

  return { organizations, roles };
}
