import { NextResponse } from 'next/server';
import { authorizeOrgRequest, FieldValue, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { firestoreDocumentData } from '@/lib/utils/firestoreDocument.mjs';
import {
  normalizePlan,
  projectsOverPlanLimit,
  storedPlanLimit,
} from '@/lib/utils/plans.mjs';

export async function PATCH(request, context) {
  try {
    const { organizationId } = await context.params;
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

    const body = await readJsonBody(request);
    const { action, targetUserId } = body;

    // ── Changing the plan ────────────────────────────────────────────────
    //
    // A server route rather than one field written from the browser, for the
    // reason the field itself is the smallest part of: moving down a plan has
    // to decide which projects the new ceiling no longer has room for, and mark
    // them, in the same write that changes the plan. A client that changed the
    // plan and then marked the projects would leave a window where the two
    // disagreed — and a client that simply did not mark them would leave a
    // workspace over its ceiling with nothing anywhere saying so.
    //
    // Nothing is deleted, here or downstream. A project past the ceiling goes
    // read-only and comes back untouched the moment the plan does.
    if (action === 'set-plan') {
      const plan = normalizePlan(body.plan);
      const db = getAdminDb();
      const projectsSnapshot = await db.collection('projects')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'active')
        .get();
      // The path's id, not whatever `id` the document happens to carry: a
      // stale denormalized copy would mark the wrong project read-only.
      const overLimit = new Set(projectsOverPlanLimit(
        plan,
        projectsSnapshot.docs.map(firestoreDocumentData),
      ));

      const batch = db.batch();
      batch.update(db.collection('organizations').doc(organizationId), {
        plan,
        // The ceilings the organization document carries are the registry's,
        // never a ternary — the same rule onboarding follows.
        limits: {
          maxProjects: storedPlanLimit(plan, 'projects'),
          maxMembers: storedPlanLimit(plan, 'members'),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      for (const document of projectsSnapshot.docs) {
        const next = overLimit.has(document.id);
        // Written only where it moves: a plan switch on a workspace with fifty
        // projects is otherwise fifty writes to say nothing changed.
        if (Boolean(document.data().overPlanLimit) === next) continue;
        batch.update(document.ref, {
          overPlanLimit: next,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();

      return NextResponse.json({ plan, readOnlyProjectIds: [...overLimit] });
    }

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
      if (targetSnap.data().removalPending === true) throw new Error('MEMBER_REMOVAL_PENDING');

      const now = FieldValue.serverTimestamp();
      transaction.update(currentRef, { role: 'admin', updatedAt: now });
      transaction.update(targetRef, { role: 'owner', updatedAt: now });
      transaction.update(orgRef, {
        ownerId: targetUserId,
        memberDirectoryVersion: FieldValue.increment(1),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Organization member not found' }, { status: 404 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Ownership changed; reload and try again' }, { status: 409 });
    if (error.message === 'MEMBER_REMOVAL_PENDING') return NextResponse.json({ error: 'This member is being removed' }, { status: 409 });
    return routeErrorResponse(error, { context: 'organization-transfer', fallbackMessage: 'Failed to transfer ownership' });
  }
}
