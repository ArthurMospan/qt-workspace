import 'server-only';

import { FieldValue, Timestamp, getAdminDb } from '@/lib/server/firebaseAdmin';
import {
  QTICKET_SIGNATURE_WINDOW_SECONDS,
  qTicketIntegrationConfig,
  qTicketNonceId,
  verifyQTicketRequest,
} from '@/lib/integrations/qticketContract.mjs';

const MAX_SIGNED_BODY_BYTES = 256 * 1024;
const INTERNAL_ROLES = new Set(['owner', 'admin', 'member']);

/**
 * Read a request qTicket signed for us.
 *
 * The envelope is the one QuickTeam already sends in the other direction, so
 * the shared secret, the header names and the five-minute window are the same
 * three facts read from the opposite end. The nonce is recorded here because
 * everything qTicket asks of QuickTeam changes something: a replayed transfer
 * would be a second task about the same request.
 */
export async function readSignedQTicketRequest(request) {
  const config = qTicketIntegrationConfig();
  if (!config.configured) {
    return { error: 'qTicket інтеграцію не налаштовано', status: 503, code: 'not_configured' };
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_SIGNED_BODY_BYTES) {
    return { error: 'Payload too large', status: 413, code: 'payload_too_large' };
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_SIGNED_BODY_BYTES) {
    return { error: 'Payload too large', status: 413, code: 'payload_too_large' };
  }

  const verification = verifyQTicketRequest({
    secret: config.secret,
    timestamp: request.headers.get('x-qt-timestamp') || '',
    nonce: request.headers.get('x-qt-nonce') || '',
    signature: request.headers.get('x-qt-signature') || '',
    body: rawBody,
  });
  if (!verification.ok) {
    return { error: 'Invalid integration signature', status: 401, code: verification.code };
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { error: 'Invalid JSON', status: 400, code: 'invalid_json' };
  }

  const db = getAdminDb();
  const nonceRef = db.collection('integrationNonces').doc(qTicketNonceId(verification.nonce));
  try {
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(nonceRef);
      if (existing.exists) throw Object.assign(new Error('Replay'), { code: 'REPLAY' });
      transaction.create(nonceRef, {
        provider: 'qticket',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(
          (verification.timestamp + QTICKET_SIGNATURE_WINDOW_SECONDS * 2) * 1000,
        ),
      });
    });
  } catch (error) {
    if (error?.code === 'REPLAY') {
      return { error: 'Integration request was already used', status: 409, code: 'replay' };
    }
    throw error;
  }

  return { body };
}

/**
 * Who this request acts as, in QuickTeam's own terms.
 *
 * qTicket names a person by the `sourceUserId` QuickTeam gave it during
 * provisioning, and that is the whole trust chain: the signature says the
 * request is from qTicket, and this says qTicket is allowed to act for this
 * person here. Three things must still hold — the add-on is active, this
 * organization chose this person for qTicket, and they hold an internal seat —
 * because a staff selection that shrank must take the transfer right with it.
 */
export async function resolveQTicketActor(db, { sourceOrganizationId, sourceUserId }) {
  const organizationId = String(sourceOrganizationId || '').trim();
  const userId = String(sourceUserId || '').trim();
  if (!organizationId || !userId) {
    return { error: 'Некоректний запит', status: 400, code: 'invalid_payload' };
  }
  const [integrationSnap, membershipSnap, profileSnap] = await Promise.all([
    db.doc(`organizations/${organizationId}/private/qticket`).get(),
    db.doc(`orgMemberships/${organizationId}_${userId}`).get(),
    db.doc(`users/${userId}`).get(),
  ]);
  const integration = integrationSnap.data() || {};
  if (integration.active !== true) {
    return { error: 'qTicket не активний для цієї організації', status: 403, code: 'inactive' };
  }
  const selected = Array.isArray(integration.selectedUserIds) ? integration.selectedUserIds : [];
  const membership = membershipSnap.exists ? membershipSnap.data() : null;
  if (
    !selected.includes(userId)
    || !membership
    || membership.userId !== userId
    || membership.orgId !== organizationId
    || !INTERNAL_ROLES.has(membership.role)
    || membership.removalPending === true
  ) {
    return { error: 'Ця людина не має доступу до qTicket', status: 403, code: 'not_enabled' };
  }
  const profile = profileSnap.exists ? profileSnap.data() : {};
  return {
    organizationId,
    actor: {
      uid: userId,
      name: profile.name || membership.email || '',
      email: profile.email || membership.email || '',
      picture: profile.customAvatar || profile.avatar || profile.photoURL || null,
      role: membership.role,
    },
  };
}
