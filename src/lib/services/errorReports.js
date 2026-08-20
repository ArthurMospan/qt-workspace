'use client';

import { auth } from '@/lib/firebase';

/**
 * Send one failure to the people who can fix it.
 *
 * Written through the server rather than straight into Firestore: the browser
 * cannot be trusted with who it says it is, the rate limit belongs on the
 * server, and the collection stays unreadable from any client — an error report
 * carries somebody's screen and path, and that is not workspace content.
 *
 * @param {string} options.organizationId Which workspace it happened in.
 * @param {string} options.message What the person was shown.
 * @param {string} options.detail What actually happened underneath, if known.
 * @param {string} options.context Which operation asked for it.
 * @param {string} options.path Where they were.
 * @param {string} options.note Anything they chose to add.
 */
export async function reportError({
  organizationId,
  message,
  detail = '',
  context = '',
  path = '',
  note = '',
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch('/api/error-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizationId, message, detail, context, path, note }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Failed to send the report');
  return result;
}

/**
 * The newest hundred reports, from every workspace.
 *
 * Behind a password rather than a role, and the password travels in the body of
 * a POST rather than in the address: a query string is written down by every
 * proxy and every browser history along the way. There is no session here on
 * purpose — /errors is not a workspace screen and does not ask anyone to log in.
 *
 * @param {string} password Read from the field on /errors.
 */
export async function fetchErrorReports(password) {
  const response = await fetch('/api/error-reports/inbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не вдалося прочитати звіти');
  return result.reports || [];
}
