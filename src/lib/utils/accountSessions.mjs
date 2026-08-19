// Where a person's account has been signed in from.
//
// One document, `users/{uid}/settings/sessions`, holding a map keyed by a device
// id the browser keeps in its own storage — not a subcollection. A security
// panel is read on demand by one person about themselves, and a map costs one
// read to answer «which devices are these» no matter how many there are; a
// subcollection costs one per device on a project that has a daily read budget.
//
// Everything here is pure so the route, the panel and the tests all agree on
// what a session record is.

/** At most this many devices are remembered; the oldest fall off the end. */
export const MAX_REMEMBERED_SESSIONS = 10;

const BROWSERS = [
  // Order matters: Edge and Opera both claim to be Chrome, and Chrome claims to
  // be Safari. The most specific claim has to be tested first or every browser
  // in this list reads as the last one.
  [/edg(?:e|ios|a)?\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/samsungbrowser/i, 'Samsung Internet'],
  [/firefox\/|fxios/i, 'Firefox'],
  [/crios\/|chrome\//i, 'Chrome'],
  [/safari\//i, 'Safari'],
];

const PLATFORMS = [
  [/windows nt/i, 'Windows'],
  [/iphone|ipad|ipod/i, 'iOS'],
  [/android/i, 'Android'],
  [/mac os x/i, 'macOS'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];

function firstMatch(table, value) {
  for (const [pattern, label] of table) {
    if (pattern.test(value)) return label;
  }
  return null;
}

/**
 * «Chrome · Windows» — what the reader recognises their own machine by. Neither
 * half is guessed at: an unreadable user agent says so rather than inventing a
 * browser nobody is using.
 */
export function describeDevice(userAgent) {
  const value = typeof userAgent === 'string' ? userAgent : '';
  const browser = firstMatch(BROWSERS, value);
  const platform = firstMatch(PLATFORMS, value);
  if (browser && platform) return `${browser} · ${platform}`;
  return browser || platform || 'Невідомий пристрій';
}

/**
 * The place the request came from, as the hosting platform reports it. Absent
 * locally and behind proxies that strip it, and absent is what it then says —
 * a session with no known origin must not claim one.
 */
export function describePlace({ city, region, country } = {}) {
  const parts = [city, region && region !== city ? region : null, country]
    .map(part => (typeof part === 'string' ? decodeURIComponent(part).trim() : ''))
    .filter(Boolean);
  if (parts.length === 0) return null;
  return [...new Set(parts)].join(', ');
}

function millisOf(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The stored map as a list a panel can render: newest first, the device asking
 * marked as itself, and never more rows than the cap.
 */
export function listSessions(stored, { currentSessionId = null } = {}) {
  const map = stored && typeof stored === 'object' ? stored : {};
  return Object.entries(map)
    .filter(([, record]) => record && typeof record === 'object')
    .map(([id, record]) => ({
      id,
      device: record.device || describeDevice(record.userAgent),
      place: record.place || null,
      firstSeenMillis: millisOf(record.firstSeenAt),
      lastSeenMillis: millisOf(record.lastSeenAt),
      isCurrent: Boolean(currentSessionId) && id === currentSessionId,
    }))
    .sort((a, b) => {
      // The device you are reading this on belongs at the top: it is the one
      // row whose answer the reader already knows, and it is what the other
      // rows are compared against.
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.lastSeenMillis - a.lastSeenMillis;
    })
    .slice(0, MAX_REMEMBERED_SESSIONS);
}

/** Ids to drop so a write never grows the document past the cap. */
export function expiredSessionIds(stored, { keepId = null } = {}) {
  const kept = new Set(
    listSessions(stored, { currentSessionId: keepId }).map(session => session.id),
  );
  return Object.keys(stored && typeof stored === 'object' ? stored : {})
    .filter(id => !kept.has(id));
}

/** A session id is device-local and opaque; anything else is not one. */
export function isSessionId(value) {
  return typeof value === 'string' && /^[a-z0-9-]{8,64}$/i.test(value);
}

const PROVIDER_LABELS = {
  'google.com': 'Google',
  'github.com': 'GitHub',
  password: 'Пошта і пароль',
  'custom-token': 'Службовий вхід',
};

/** How this account can be signed into, named the way the sign-in page names it. */
export function describeSignInMethods(providerData = []) {
  const ids = (Array.isArray(providerData) ? providerData : [])
    .map(provider => provider?.providerId)
    .filter(Boolean);
  return [...new Set(ids)].map(id => ({ id, label: PROVIDER_LABELS[id] || id }));
}
