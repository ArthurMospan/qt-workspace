import 'server-only';

import { createQTicketSignedRequest, QTICKET_CONTRACT_VERSION } from '@/lib/integrations/qticketContract.mjs';

async function callQTicket(path, payload) {
  const signed = createQTicketSignedRequest(payload);
  const response = await fetch(`${signed.origin}${path}`, {
    method: 'POST',
    headers: signed.headers,
    body: signed.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `qTicket returned ${response.status}`);
    error.code = data.code || 'QTICKET_UPSTREAM';
    error.status = response.status;
    throw error;
  }
  return data;
}

export function provisionQTicket(payload) {
  return callQTicket('/api/integrations/quickteam/provision', {
    version: QTICKET_CONTRACT_VERSION,
    ...payload,
  });
}

export function createQTicketLaunch(payload) {
  return callQTicket('/api/integrations/quickteam/launch', {
    version: QTICKET_CONTRACT_VERSION,
    ...payload,
  });
}

// How many unread qTicket notifications this QuickTeam person has waiting.
// The answer is a number and nothing else — see docs/integrations/QTICKET.md,
// «Unread badge»: a badge is a reason to open the other product, not a copy of
// its bell. Callers treat a failure as «unknown», never as «none».
export function fetchQTicketUnread(payload) {
  return callQTicket('/api/integrations/quickteam/unread', {
    version: QTICKET_CONTRACT_VERSION,
    ...payload,
  });
}
