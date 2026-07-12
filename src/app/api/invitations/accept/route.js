import { NextResponse } from 'next/server';
import { admin, authenticateRequest, getAdminDb } from '@/lib/server/firebaseAdmin';

export async function POST(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const { uid, email, email_verified: emailVerified } = authorization.user;
    if (!email || !emailVerified) {
      return NextResponse.json({ error: 'A verified email is required' }, { status: 403 });
    }

    const db = getAdminDb();
    const invitationsSnap = await db.collection('invitations')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .get();

    if (invitationsSnap.empty) return NextResponse.json({ accepted: 0 });

    const batch = db.batch();
    let accepted = 0;

    for (const invitationDoc of invitationsSnap.docs) {
      const invitation = invitationDoc.data();
      const organizationId = invitation.organizationId;
      if (!organizationId) continue;

      const organizationSnap = await db.collection('organizations').doc(organizationId).get();
      if (!organizationSnap.exists) continue;

      const membershipId = `${organizationId}_${uid}`;
      const role = invitation.role === 'admin' ? 'admin' : 'member';
      batch.set(db.collection('orgMemberships').doc(membershipId), {
        id: membershipId,
        orgId: organizationId,
        userId: uid,
        role,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        hourlyRate: 0,
      }, { merge: false });
      batch.update(invitationDoc.ref, {
        status: 'accepted',
        acceptedBy: uid,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      accepted += 1;
    }

    if (accepted > 0) await batch.commit();
    return NextResponse.json({ accepted });
  } catch (error) {
    console.error('[Invitation Accept]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
