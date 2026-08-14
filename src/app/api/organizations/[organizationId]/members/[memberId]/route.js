import { NextResponse } from 'next/server';
import {
  authorizeOrgRequest,
  FieldValue,
  getAdminDb,
} from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

function memberMutationError(code, status, message) {
  const error = new Error(code);
  error.memberMutation = { status, message };
  return error;
}

function validMemberId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && !value.includes('/')
    && !value.includes('\0');
}

async function authorizeManager(request, organizationId) {
  return authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
}

function errorResponse(error) {
  if (!error?.memberMutation) return null;
  return NextResponse.json(
    { error: error.memberMutation.message },
    { status: error.memberMutation.status },
  );
}

async function removalImpact(db, organizationId, memberId) {
  const [projects, assignedIssues, watchedIssues] = await Promise.all([
    db.collection('projects')
      .where('organizationId', '==', organizationId)
      .where('team', 'array-contains', memberId)
      .get(),
    db.collection('issues')
      .where('organizationId', '==', organizationId)
      .where('assigneeIds', 'array-contains', memberId)
      .get(),
    db.collection('issues')
      .where('organizationId', '==', organizationId)
      .where('watcherIds', 'array-contains', memberId)
      .get(),
  ]);
  return { projects, assignedIssues, watchedIssues };
}

export async function GET(request, context) {
  try {
    const { organizationId, memberId } = await context.params;
    if (!validMemberId(memberId)) {
      return NextResponse.json({ error: 'Invalid organization member' }, { status: 400 });
    }
    const authorization = await authorizeManager(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const db = getAdminDb();
    const membershipSnap = await db.collection('orgMemberships')
      .doc(`${organizationId}_${memberId}`)
      .get();
    if (!membershipSnap.exists) {
      return NextResponse.json({ error: 'Organization member not found' }, { status: 404 });
    }
    const impact = await removalImpact(db, organizationId, memberId);
    return NextResponse.json({
      projectCount: impact.projects.size,
      assignedIssueCount: impact.assignedIssues.size,
      watchedIssueCount: impact.watchedIssues.size,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'organization-member-impact',
      fallbackMessage: 'Failed to inspect organization member',
    });
  }
}

export async function PATCH(request, context) {
  try {
    const { organizationId, memberId } = await context.params;
    if (!validMemberId(memberId)) {
      return NextResponse.json({ error: 'Invalid organization member' }, { status: 400 });
    }
    const authorization = await authorizeManager(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const action = body?.action;
    if (!['role', 'position', 'rate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid member update' }, { status: 400 });
    }
    if (action === 'role' && authorization.membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can change member roles' }, { status: 403 });
    }
    if (
      action === 'role'
      && (!['admin', 'member'].includes(body.role) || memberId === authorization.user.uid)
    ) {
      return NextResponse.json({ error: 'Invalid member role' }, { status: 400 });
    }
    const positionId = typeof body?.positionId === 'string' ? body.positionId.trim() : '';
    if (action === 'position' && (positionId.length > 120 || positionId.includes('/'))) {
      return NextResponse.json({ error: 'Invalid member position' }, { status: 400 });
    }
    const hourlyRate = Number(body?.hourlyRate);
    if (action === 'rate' && (!Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 1_000_000)) {
      return NextResponse.json({ error: 'Invalid hourly rate' }, { status: 400 });
    }

    const db = getAdminDb();
    const orgRef = db.collection('organizations').doc(organizationId);
    const membershipRef = db.collection('orgMemberships').doc(`${organizationId}_${memberId}`);
    const rateRef = orgRef.collection('memberRates').doc(memberId);
    await db.runTransaction(async transaction => {
      const membershipSnap = await transaction.get(membershipRef);
      if (!membershipSnap.exists) {
        throw memberMutationError('NOT_FOUND', 404, 'Organization member not found');
      }
      const membership = membershipSnap.data();
      if (membership.orgId !== organizationId || membership.userId !== memberId) {
        throw memberMutationError('FORBIDDEN', 403, 'Invalid organization member');
      }
      if (membership.removalPending === true) {
        throw memberMutationError('REMOVAL_PENDING', 409, 'This member is already being removed');
      }
      if (action === 'role' && membership.role === 'owner') {
        throw memberMutationError('OWNER_ROLE', 409, 'Transfer ownership before changing this role');
      }

      const now = FieldValue.serverTimestamp();
      if (action === 'role') transaction.update(membershipRef, { role: body.role, updatedAt: now });
      if (action === 'position') transaction.update(membershipRef, { positionId, updatedAt: now });
      if (action === 'rate') {
        transaction.set(rateRef, {
          userId: memberId,
          hourlyRate,
          updatedBy: authorization.user.uid,
          updatedAt: now,
        });
      }
      transaction.update(orgRef, {
        memberDirectoryVersion: FieldValue.increment(1),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = errorResponse(error);
    if (response) return response;
    return routeErrorResponse(error, {
      context: 'organization-member-update',
      fallbackMessage: 'Failed to update organization member',
    });
  }
}

export async function DELETE(request, context) {
  try {
    const { organizationId, memberId } = await context.params;
    if (!validMemberId(memberId)) {
      return NextResponse.json({ error: 'Invalid organization member' }, { status: 400 });
    }
    const authorization = await authorizeManager(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (memberId === authorization.user.uid) {
      return NextResponse.json({ error: 'Transfer ownership or ask another administrator to remove you' }, { status: 409 });
    }

    const db = getAdminDb();
    const orgRef = db.collection('organizations').doc(organizationId);
    const membershipRef = db.collection('orgMemberships').doc(`${organizationId}_${memberId}`);
    const rateRef = orgRef.collection('memberRates').doc(memberId);
    await db.runTransaction(async transaction => {
      const currentMembership = await transaction.get(membershipRef);
      if (!currentMembership.exists) return;
      const membership = currentMembership.data();
      if (membership.orgId !== organizationId || membership.userId !== memberId) {
        throw memberMutationError('FORBIDDEN', 403, 'Invalid organization member');
      }
      if (membership.role === 'owner') {
        throw memberMutationError('OWNER_ROLE', 409, 'Transfer ownership before removing the owner');
      }
      if (membership.removalPending !== true) {
        transaction.update(membershipRef, {
          removalPending: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    const impact = await removalImpact(db, organizationId, memberId);
    const writer = db.bulkWriter();
    for (const project of impact.projects.docs) {
      writer.update(project.ref, {
        team: FieldValue.arrayRemove(memberId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    const issueUpdates = new Map();
    for (const issue of impact.assignedIssues.docs) {
      issueUpdates.set(issue.id, {
        ref: issue.ref,
        update: { assigneeIds: FieldValue.arrayRemove(memberId) },
      });
    }
    for (const issue of impact.watchedIssues.docs) {
      const current = issueUpdates.get(issue.id) || { ref: issue.ref, update: {} };
      current.update.watcherIds = FieldValue.arrayRemove(memberId);
      issueUpdates.set(issue.id, current);
    }
    for (const issue of issueUpdates.values()) {
      writer.update(issue.ref, {
        ...issue.update,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    try {
      await writer.close();
    } catch (error) {
      await membershipRef.update({
        removalPending: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
      throw error;
    }

    await db.runTransaction(async transaction => {
      const currentMembership = await transaction.get(membershipRef);
      if (currentMembership.exists && currentMembership.data().role === 'owner') {
        throw memberMutationError('OWNER_ROLE', 409, 'Transfer ownership before removing the owner');
      }
      if (currentMembership.exists) transaction.delete(membershipRef);
      transaction.delete(rateRef);
      transaction.update(orgRef, {
        memberDirectoryVersion: FieldValue.increment(1),
      });
    });

    return NextResponse.json({
      success: true,
      projectCount: impact.projects.size,
      assignedIssueCount: impact.assignedIssues.size,
      watchedIssueCount: impact.watchedIssues.size,
    });
  } catch (error) {
    const response = errorResponse(error);
    if (response) return response;
    return routeErrorResponse(error, {
      context: 'organization-member-remove',
      fallbackMessage: 'Failed to remove organization member',
    });
  }
}
