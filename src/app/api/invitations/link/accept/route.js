import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { authenticateRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { hashInviteToken } from '@/lib/server/inviteLinks';

// Accepting an invite link. The token is looked up by hash; the joiner gets
// exactly the role the admin fixed at creation — nothing in the request body
// can influence it. Expired/revoked/exhausted links are rejected the same way
// so a probing attacker learns nothing about which links exist.

const INVALID = () => NextResponse.json({ error: 'Посилання недійсне або протерміноване' }, { status: 404 });

export async function POST(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const { uid } = authorization.user;
    if (!(await enforceRateLimit('invitation-link-accept', uid, 10, 3600))) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const { token } = await request.json();
    if (typeof token !== 'string' || token.length < 20 || token.length > 128) return INVALID();

    const db = getAdminDb();
    const snap = await db.collection('invitations')
      .where('tokenHash', '==', hashInviteToken(token))
      .limit(1)
      .get();
    if (snap.empty) return INVALID();

    const inviteRef = snap.docs[0].ref;

    // Transaction: two users clicking the last remaining use at the same time
    // must not both pass the maxUses check.
    const result = await db.runTransaction(async tx => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) return { error: true };
      const invite = inviteSnap.data();
      if (invite.type !== 'link' || invite.status !== 'pending') return { error: true };
      if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) return { error: true };
      if ((invite.usedCount || 0) >= (invite.maxUses || 1)) return { error: true };

      const organizationId = invite.organizationId;
      if (!organizationId) return { error: true };

      const membershipId = `${organizationId}_${uid}`;
      const membershipRef = db.collection('orgMemberships').doc(membershipId);
      const membershipSnap = await tx.get(membershipRef);
      if (membershipSnap.exists) return { organizationId, alreadyMember: true };

      tx.set(membershipRef, {
        id: membershipId,
        orgId: organizationId,
        userId: uid,
        role: invite.role === 'admin' ? 'admin' : 'member',
        joinedAt: FieldValue.serverTimestamp(),
        invitedBy: invite.invitedBy || null,
        joinedVia: 'invite-link',
      });
      tx.set(db.collection('organizations').doc(organizationId)
        .collection('memberRates').doc(uid), {
        userId: uid,
        hourlyRate: 0,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(db.collection('organizations').doc(organizationId), {
        memberDirectoryVersion: FieldValue.increment(1),
      });
      tx.update(inviteRef, {
        usedCount: FieldValue.increment(1),
        lastUsedAt: FieldValue.serverTimestamp(),
        lastUsedBy: uid,
      });
      return { organizationId };
    });

    if (result.error) return INVALID();

    const orgSnap = await db.collection('organizations').doc(result.organizationId).get();
    return NextResponse.json({
      organizationId: result.organizationId,
      organizationName: orgSnap.exists ? orgSnap.data().name : '',
      alreadyMember: Boolean(result.alreadyMember),
    });
  } catch (error) {
    return routeErrorResponse(error, { context: 'Invitation link accept', fallbackMessage: 'Internal Server Error' });
  }
}
