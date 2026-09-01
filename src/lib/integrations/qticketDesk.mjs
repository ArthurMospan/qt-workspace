// What the support desk is, as distinct from what the workspace is.
//
// Three small decisions that used not to exist, kept out of the route so they
// can be tested as the rules they are rather than as the text of a handler:
// which qTicket role a person holds, which brand a customer sees, and what a
// sync actually changed.

// How many syncs the card remembers. «Хто зняв Олю з підтримки» is a question
// about the last change, not about the year, and an unbounded array on a
// document every rail mount reads is a bill that grows on its own.
export const QTICKET_HISTORY_LIMIT = 20;

export const QTICKET_PORTAL_THEMES = Object.freeze(['dark', 'light', 'custom']);

// The owner is deliberately absent: the organization document names exactly
// one, and qTicket refuses a snapshot that disagrees.
export const QTICKET_OVERRIDABLE_ROLES = Object.freeze(['admin', 'member']);

const cleanText = (value, max) => String(value || '').trim().slice(0, max);

/**
 * Which qTicket role each selected person gets, where it is not the one they
 * hold in QuickTeam.
 *
 * A QuickTeam admin was a qTicket admin and there was no way to say otherwise:
 * the desk's hierarchy was the workspace's hierarchy, so putting somebody in
 * charge of support meant promoting them in the whole product, and a support
 * manager could not be an administrator of support alone.
 *
 * An override for somebody who is not selected is dropped rather than stored —
 * a role for a person with no seat is a claim about nothing, and keeping it
 * would quietly re-grant them the role if they were ever added back.
 */
export function normalizeStaffRoles(value, { selectedUserIds = [], ownerId = '' } = {}) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([userId, role]) => (
      userId !== ownerId
      && selectedUserIds.includes(userId)
      && QTICKET_OVERRIDABLE_ROLES.includes(role)
    )));
}

/**
 * The brand a customer sees, when it is not the brand the staff see.
 *
 * `null` means «the same one» and is the default. An empty field inside a
 * present override inherits that one field from the organization — qTicket
 * applies the same fallback in `quickTeamPortalBranding` — so renaming the desk
 * does not cost you your logo. An override where every field is empty is not an
 * override at all and collapses back to `null`, because a stored object of
 * blanks would read as «somebody configured this» to the next person.
 */
export function normalizePortal(value) {
  if (!value || typeof value !== 'object') return null;
  const portal = {
    name: cleanText(value.name, 160),
    logo: cleanText(value.logo, 2000),
    sidebarTheme: QTICKET_PORTAL_THEMES.includes(value.sidebarTheme) ? value.sidebarTheme : '',
    sidebarColor: cleanText(value.sidebarColor, 80),
  };
  return Object.values(portal).some(Boolean) ? portal : null;
}

/**
 * What one sync changed, in the terms the card reads back.
 *
 * Written from ids alone: the names belong to the roster the screen already
 * has, and a copy of them here would be a second directory to keep true.
 */
export function historyEntry({ before = {}, after = {}, actorId = '', revision = 0, at = new Date() }) {
  const had = new Set(before.selectedUserIds || []);
  const has = new Set(after.selectedUserIds || []);
  return {
    at: at.toISOString(),
    by: actorId,
    revision,
    added: [...has].filter(userId => !had.has(userId)),
    removed: [...had].filter(userId => !has.has(userId)),
    rolesChanged: JSON.stringify(before.staffRoles || {}) !== JSON.stringify(after.staffRoles || {}),
    brandChanged: JSON.stringify(before.portal || null) !== JSON.stringify(after.portal || null),
  };
}
