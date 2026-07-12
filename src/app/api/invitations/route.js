import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';

export async function POST(request) {
  try {
    const { organizationId, email, role } = await request.json();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('invitation', authorization.user.uid, 20, 3600))) {
      return NextResponse.json({ error: 'Too many invitations' }, { status: 429 });
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    const safeRole = role === 'admin' ? 'admin' : 'member';
    const db = getAdminDb();

    const userSnap = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (!userSnap.empty) {
      const userId = userSnap.docs[0].id;
      const membershipId = `${organizationId}_${userId}`;
      const membershipRef = db.collection('orgMemberships').doc(membershipId);
      if ((await membershipRef.get()).exists) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
      }
      await membershipRef.set({
        id: membershipId,
        orgId: organizationId,
        userId,
        role: safeRole,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        hourlyRate: 0,
        invitedBy: authorization.user.uid,
      });
      return NextResponse.json({ type: 'added_directly' }, { status: 201 });
    }

    const pendingSnap = await db.collection('invitations')
      .where('organizationId', '==', organizationId)
      .where('email', '==', normalizedEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!pendingSnap.empty) {
      return NextResponse.json({ error: 'Invitation is already pending' }, { status: 409 });
    }

    await db.collection('invitations').add({
      email: normalizedEmail,
      organizationId,
      invitedBy: authorization.user.uid,
      role: safeRole,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ type: 'invitation_sent' }, { status: 201 });
  } catch (error) {
    console.error('[Invitation POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
