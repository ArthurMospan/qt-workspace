import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const QTICKET_CONTRACT_VERSION = 1;
// The same window qTicket allows us. Both directions of this contract are one
// envelope: same header names, same signed bytes, same five minutes.
export const QTICKET_SIGNATURE_WINDOW_SECONDS = 5 * 60;

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

export function qTicketNonceId(nonce) {
  return `qticket_${createHash('sha256').update(String(nonce || '').slice(0, 180)).digest('hex').slice(0, 48)}`;
}

/**
 * The other direction of the envelope: qTicket signs, QuickTeam verifies.
 *
 * Deliberately the mirror image of `verifyQuickTeamRequest` in the qTicket
 * repository, down to the refusal codes — one contract described twice is
 * already one too many, and the two halves at least refuse the same way. The
 * signature is compared in constant time, and a body that differs by one byte
 * from the signed one is not this request.
 */
export function verifyQTicketRequest({
  secret,
  timestamp,
  nonce,
  signature,
  body,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  // A missing header is a missing header: `Number('')` is 0 and 0 is a safe
  // integer, so an unsigned request used to be reported as «expired» and send
  // whoever was debugging it to look at clocks.
  if (!String(timestamp ?? '').trim()) return { ok: false, code: 'timestamp' };
  const numericTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(numericTimestamp)) return { ok: false, code: 'timestamp' };
  if (Math.abs(nowSeconds - numericTimestamp) > QTICKET_SIGNATURE_WINDOW_SECONDS) {
    return { ok: false, code: 'expired' };
  }
  if (!/^[A-Za-z0-9_-]{16,180}$/.test(String(nonce || ''))) return { ok: false, code: 'nonce' };
  if (!/^[a-f0-9]{64}$/i.test(String(signature || ''))) return { ok: false, code: 'signature' };

  let expected;
  try {
    expected = signQTicketRequest(secret, { timestamp: numericTimestamp, nonce, body });
  } catch {
    return { ok: false, code: 'configuration' };
  }
  const supplied = Buffer.from(String(signature).toLowerCase(), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer)
    ? { ok: true, timestamp: numericTimestamp, nonce: String(nonce) }
    : { ok: false, code: 'signature' };
}
