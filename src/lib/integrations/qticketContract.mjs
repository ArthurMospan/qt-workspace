import { createHmac, randomBytes } from 'node:crypto';

export const QTICKET_CONTRACT_VERSION = 1;

export function qTicketIntegrationConfig(environment = process.env) {
  const origin = String(environment.NEXT_PUBLIC_QTICKET_URL || '').trim().replace(/\/$/, '');
  const secret = String(environment.QUICKTEAM_QTICKET_SHARED_SECRET || '');
  return {
    origin,
    secret,
    configured: /^https?:\/\//.test(origin) && secret.length >= 32,
  };
}

export function signQTicketRequest(secret, { timestamp, nonce, body }) {
  const key = String(secret || '');
  if (key.length < 32) throw new Error('qTicket shared secret must contain at least 32 characters');
  return createHmac('sha256', key)
    .update(`v${QTICKET_CONTRACT_VERSION}\n${timestamp}\n${nonce}\n${body}`)
    .digest('hex');
}

export function createQTicketSignedRequest(payload, {
  environment = process.env,
  timestamp = Math.floor(Date.now() / 1000),
  nonce = randomBytes(24).toString('base64url'),
} = {}) {
  const config = qTicketIntegrationConfig(environment);
  if (!config.configured) throw new Error('qTicket integration is not configured');
  const body = JSON.stringify(payload);
  return {
    origin: config.origin,
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-QT-Timestamp': String(timestamp),
      'X-QT-Nonce': nonce,
      'X-QT-Signature': signQTicketRequest(config.secret, { timestamp, nonce, body }),
    },
  };
}
