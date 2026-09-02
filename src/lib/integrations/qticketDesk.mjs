// What the support desk is, as distinct from what the workspace is.
//
// Two small decisions that used not to exist, kept out of the route so they
// can be tested as the rules they are rather than as the text of a handler:
// which qTicket role a person holds, and which brand the desk wears.
//
// A third — what a sync changed, kept as a twenty-entry journal on the
// integration document — was built with them and removed on 2026-09-02: the
// owner opened the card, found a «Журнал змін» row on a screen that has three
// settings, and said it did not belong there. Nothing else ever read it.

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

