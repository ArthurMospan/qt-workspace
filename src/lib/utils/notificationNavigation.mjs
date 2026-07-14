const WORKSPACE_ORIGIN = 'https://quickteam.local';

export function normalizeNotificationLink(link) {
  if (typeof link !== 'string') return '';
  const value = link.trim();
  if (!value || value.includes('\\') || value.startsWith('//')) return '';
  if (value !== '/workspace' && !value.startsWith('/workspace/') && !value.startsWith('/workspace?')) return '';

  try {
    const url = new URL(value, WORKSPACE_ORIGIN);
    if (url.origin !== WORKSPACE_ORIGIN || (url.pathname !== '/workspace' && !url.pathname.startsWith('/workspace/'))) {
      return '';
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

export function withNotificationOrganization(link, organizationId) {
  const safeLink = normalizeNotificationLink(link);
  if (!safeLink) return '';
  if (typeof organizationId !== 'string' || !organizationId.trim()) return safeLink;

  const url = new URL(safeLink, WORKSPACE_ORIGIN);
  url.searchParams.set('org', organizationId.trim());
  return `${url.pathname}${url.search}${url.hash}`;
}
