// src/lib/utils/faviconBadge.mjs
// What the browser tab's icon says when something is waiting.
//
// The tab title already carries the unread count, but a title is only legible
// while the tab is the active one; with eight tabs open every QuickTeam tab is
// an icon and about nine characters. The icon is the part that stays readable,
// so the count belongs there too.
//
// Pure, and separate from the component that paints it, for the same reason
// `documentTitle.mjs` is: the arithmetic of "what does the badge say and where
// does it sit" can be asserted without a canvas.

// Above this the number stops being readable at 16 physical pixels, and the
// exact figure stops mattering — "a lot" is the whole message.
export const BADGE_MAX = 9;

/**
 * What the badge reads. Anything past `BADGE_MAX` is «9+»: two glyphs is the
 * most that fits, and a squeezed "23" is a smudge rather than a number.
 */
export function badgeLabel(count) {
  const value = Math.floor(Number(count) || 0);
  if (value <= 0) return '';
  return value > BADGE_MAX ? `${BADGE_MAX}+` : String(value);
}

/**
 * Where the badge sits on a square icon of `size` device pixels, and how big
 * its parts are. One place holds these numbers so the ring, the disc and the
 * type cannot drift apart at a different canvas size.
 *
 * The disc is deliberately large — 40% of the icon. A badge drawn to look
 * balanced at 64px disappears at the 16px the browser actually renders.
 */
export function badgeGeometry(size = 64) {
  const radius = size * 0.3;
  // The transparent ring is what separates the badge from whatever the icon
  // has under it; without it a red disc on a colourful logo reads as part of
  // it. It grows outward from the disc, so the disc sits a full ring in from
  // the edge — otherwise the browser clips the halo and the badge looks bitten.
  const ringWidth = size * 0.06;
  return {
    size,
    radius,
    ringWidth,
    centerX: size - radius - ringWidth,
    centerY: size - radius - ringWidth,
    fontSize: radius * 1.15,
  };
}

/**
 * The sum the badge shows: everything unread, from wherever it is unread.
 * Chat and notifications are two lists in the product and one number in the
 * tab — a person looking at the icon is asking "is anything waiting", not
 * "which feature is it waiting in".
 */
export function badgeCount({ unreadChats = 0, unreadNotifications = 0 } = {}) {
  const chats = Math.max(0, Math.floor(Number(unreadChats) || 0));
  const notifications = Math.max(0, Math.floor(Number(unreadNotifications) || 0));
  return chats + notifications;
}
