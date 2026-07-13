import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

export async function PATCH(request, context) {
  try {
    const { organizationId } = await context.params;
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

    const { action, targetUserId } = await request.json();
    if (action !== 'transfer-ownership' || typeof targetUserId !== 'string' || !targetUserId) {
      return NextResponse.json({ error: 'Invalid ownership transfer' }, { status: 400 });
    }
    if (targetUserId === authorization.user.uid) {
      return NextResponse.json({ error: 'Target user is already the owner' }, { status: 400 });
    }

    const db = getAdminDb();
    const orgRef = db.collection('organizations').doc(organizationId);
    const currentRef = db.collection('orgMemberships').doc(`${organizationId}_${authorization.user.uid}`);
    const targetRef = db.collection('orgMemberships').doc(`${organizationId}_${targetUserId}`);
    await db.runTransaction(async transaction => {
      const [orgSnap, currentSnap, targetSnap] = await Promise.all([
        transaction.get(orgRef), transaction.get(currentRef), transaction.get(targetRef),
      ]);
      if (!orgSnap.exists || !currentSnap.exists || !targetSnap.exists) throw new Error('NOT_FOUND');
      if (orgSnap.data().ownerId !== authorization.user.uid || currentSnap.data().role !== 'owner') throw new Error('FORBIDDEN');
      if (targetSnap.data().orgId !== organizationId || targetSnap.data().userId !== targetUserId) throw new Error('FORBIDDEN');

      transaction.update(currentRef, { role: 'admin' });
      transaction.update(targetRef, { role: 'owner' });
      transaction.update(orgRef, { ownerId: targetUserId });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Organization member not found' }, { status: 404 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Ownership changed; reload and try again' }, { status: 409 });
    return routeErrorResponse(error, { context: 'organization-transfer', fallbackMessage: 'Failed to transfer ownership' });
  }
}
