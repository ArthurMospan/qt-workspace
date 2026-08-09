const WORKSPACE_ORIGIN = 'https://quickteam.local';
const BLOCKED_NOTIFICATION_DESTINATIONS = ['/api', '/login', '/oauth2'];

export function normalizeNotificationLink(link) {
  if (typeof link !== 'string') return '';
  const value = link.trim();
  if (!value || value.includes('\\') || !value.startsWith('/') || value.startsWith('//')) return '';

  try {
    const url = new URL(value, WORKSPACE_ORIGIN);
    if (url.origin !== WORKSPACE_ORIGIN) return '';
    const pathname = url.pathname === '/workspace'
      ? '/'
      : url.pathname.startsWith('/workspace/')
        ? url.pathname.slice('/workspace'.length)
        : url.pathname;
    const isBlocked = BLOCKED_NOTIFICATION_DESTINATIONS.some(prefix =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (isBlocked) return '';
    return `${pathname}${url.search}${url.hash}`;
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

export function notificationDestination(notification) {
  if (!notification || typeof notification !== 'object') return '';
  const projectId = typeof notification.projectId === 'string' ? notification.projectId.trim() : '';
  const issueId = typeof notification.issueId === 'string' ? notification.issueId.trim() : '';
  // New notifications carry the human issue key in their safe internal link.
  // Prefer it over the structured legacy document id, while retaining the
  // latter as a fallback for notifications created before human URLs existed.
  const explicitLink = normalizeNotificationLink(notification.link);
  if (explicitLink) return explicitLink;
  if (projectId && issueId) {
    return `/${encodeURIComponent(projectId)}/issue/${encodeURIComponent(issueId)}`;
  }
  if (projectId) return `/${encodeURIComponent(projectId)}`;
  return '';
}

export function notificationDestinationWithOrganization(notification) {
  return withNotificationOrganization(
    notificationDestination(notification),
    notification?.organizationId,
  );
}
