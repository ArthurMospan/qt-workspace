const SAFE_AUTH_PREFIXES = ['/workspace', '/onboarding', '/ui-kit', '/ui-diff'];

export function getSafeAuthRedirect(value, fallback = '/workspace') {
  if (typeof value !== 'string') return fallback;
  const destination = value.trim();
  if (!destination || destination === '/') return fallback;
  if (!destination.startsWith('/') || destination.startsWith('//')) return fallback;

  try {
    const parsed = new URL(destination, 'https://quickteam.local');
    if (parsed.origin !== 'https://quickteam.local') return fallback;
  } catch {
    return fallback;
  }

  const isAllowed = SAFE_AUTH_PREFIXES.some(prefix =>
    destination === prefix ||
    destination.startsWith(`${prefix}/`) ||
    destination.startsWith(`${prefix}?`)
  );

  return isAllowed ? destination : fallback;
}
