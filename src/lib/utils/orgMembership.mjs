// src/lib/utils/orgMembership.mjs
// Where a membership lives, and what it means that it lives there.
//
// `orgMemberships/{orgId}_{uid}` is the access record: every Firestore rule
// proves membership by the mere existence of that document, which is why
// taking access away means deleting it rather than flagging it. A flag would
// have to be read on every single rule evaluation.
//
// `orgMembershipArchive/{orgId}_{uid}` is where that record goes when someone
// is deactivated or leaves. It holds the seat — role, position, the projects
// they were on — so the seat can be restored exactly; it grants nothing. The
// person's *work* (authored comments, logged time, assigned and watched tasks)
// is never moved or stripped: that is a record of what happened, not a
// permission, and rewriting it is how a workspace loses its own history.

export const MEMBERSHIP_COLLECTION = 'orgMemberships';
export const MEMBERSHIP_ARCHIVE = 'orgMembershipArchive';

export function membershipId(organizationId, userId) {
  return `${organizationId}_${userId}`;
}

export const MEMBER_STATUS = {
  active: 'active',
  deactivated: 'deactivated',
};

export function isActiveMember(member) {
  return (member?.status || MEMBER_STATUS.active) === MEMBER_STATUS.active;
}

/** The people who can still be given work: pickers and selects use this. */
export function activeMembers(members) {
  return (Array.isArray(members) ? members : []).filter(isActiveMember);
}
