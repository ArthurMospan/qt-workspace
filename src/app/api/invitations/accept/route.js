import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { authenticateRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

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

      // Projects the inviter scoped this invitation to. They are re-checked
      // here rather than trusted: a project can be deleted or moved between the
      // invitation being written and the invitee signing in.
      const invitedProjectIds = Array.isArray(invitation.projectIds)
        ? [...new Set(invitation.projectIds.filter(id => typeof id === 'string' && id.trim()))].slice(0, 20)
        : [];
      if (invitedProjectIds.length) {
        const projectSnaps = await db.getAll(
          ...invitedProjectIds.map(id => db.collection('projects').doc(id)),
        );
        projectSnaps
          .filter(snapshot => snapshot.exists && snapshot.data().organizationId === organizationId)
          .forEach(snapshot => {
            batch.update(snapshot.ref, {
              team: FieldValue.arrayUnion(uid),
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
      }

      const membershipId = `${organizationId}_${uid}`;
      const role = invitation.role === 'admin' ? 'admin' : 'member';
      batch.set(db.collection('orgMemberships').doc(membershipId), {
        id: membershipId,
        orgId: organizationId,
        userId: uid,
        role,
        joinedAt: FieldValue.serverTimestamp(),
        hourlyRate: 0,
      }, { merge: false });
      batch.update(invitationDoc.ref, {
        status: 'accepted',
        acceptedBy: uid,
        acceptedAt: FieldValue.serverTimestamp(),
      });
      accepted += 1;
    }

    if (accepted > 0) await batch.commit();
    return NextResponse.json({ accepted });
  } catch (error) {
    return routeErrorResponse(error, { context: 'Invitation Accept', fallbackMessage: 'Internal Server Error' });
  }
}
