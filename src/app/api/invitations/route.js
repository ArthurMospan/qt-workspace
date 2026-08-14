import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { deliverEmail, invitationEmailHtml } from '@/lib/server/email';

// The invitation must be created even when the email provider is down or not
// configured — the pending doc alone already works (it is auto-accepted on the
// invitee's first login with that address). Email is best-effort on top.
async function sendInvitationEmail(db, { email, organizationId, inviterUid, role }) {
  try {
    const [orgSnap, inviterSnap] = await Promise.all([
      db.collection('organizations').doc(organizationId).get(),
      db.collection('users').doc(inviterUid).get(),
    ]);
    const orgName = orgSnap.exists ? orgSnap.data().name : '';
    const inviter = inviterSnap.exists ? inviterSnap.data() : {};
    const delivered = await deliverEmail({
      to: email,
      subject: `Запрошення до «${orgName || 'QuickTeam'}»`,
      html: invitationEmailHtml({
        orgName,
        inviterName: inviter.name || inviter.email || '',
        role,
        ctaPath: '/login',
      }),
    });
    if (!delivered) console.error('[invitations] invitation email was not delivered', { email });
    return delivered;
  } catch (error) {
    console.error('[invitations] invitation email failed', error);
    return false;
  }
}

// Projects an invitation may pre-assign. Every id has to belong to the same
// organization the caller was authorized for, otherwise a project id from
// another workspace would add the invitee to a project nobody vetted.
async function resolveInvitedProjectIds(db, requested, organizationId) {
  const ids = [...new Set(
    (Array.isArray(requested) ? requested : [])
      .filter(id => typeof id === 'string' && id.trim())
      .map(id => id.trim()),
  )].slice(0, 20);
  if (!ids.length) return [];
  const snapshots = await db.getAll(...ids.map(id => db.collection('projects').doc(id)));
  if (snapshots.some(snapshot => (
    !snapshot.exists || snapshot.data().organizationId !== organizationId
  ))) {
    throw new Error('INVALID_PROJECT_SCOPE');
  }
  return snapshots.map(snapshot => snapshot.id);
}

export async function POST(request) {
  try {
    const { organizationId, email, role, projectIds } = await readJsonBody(request);
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
    const invitedProjectIds = await resolveInvitedProjectIds(db, projectIds, organizationId);

    const userSnap = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (!userSnap.empty) {
      const userId = userSnap.docs[0].id;
      const membershipId = `${organizationId}_${userId}`;
      const membershipRef = db.collection('orgMemberships').doc(membershipId);
      if ((await membershipRef.get()).exists) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
      }
      const batch = db.batch();
      batch.set(membershipRef, {
        id: membershipId,
        orgId: organizationId,
        userId,
        role: safeRole,
        joinedAt: FieldValue.serverTimestamp(),
        invitedBy: authorization.user.uid,
      });
      batch.set(db.collection('organizations').doc(organizationId)
        .collection('memberRates').doc(userId), {
        userId,
        hourlyRate: 0,
        updatedBy: authorization.user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(db.collection('organizations').doc(organizationId), {
        memberDirectoryVersion: FieldValue.increment(1),
      });
      // An existing QuickTeam account never sees a pending invitation, so the
      // project scope has to be applied here or it would be dropped silently.
      invitedProjectIds.forEach(projectId => {
        batch.update(db.collection('projects').doc(projectId), {
          team: FieldValue.arrayUnion(userId),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      const emailSent = await sendInvitationEmail(db, {
        email: normalizedEmail,
        organizationId,
        inviterUid: authorization.user.uid,
        role: safeRole,
      });
      return NextResponse.json({ type: 'added_directly', emailSent }, { status: 201 });
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
      projectIds: invitedProjectIds,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    const emailSent = await sendInvitationEmail(db, {
      email: normalizedEmail,
      organizationId,
      inviterUid: authorization.user.uid,
      role: safeRole,
    });
    return NextResponse.json({ type: 'invitation_sent', emailSent }, { status: 201 });
  } catch (error) {
    if (error.message === 'INVALID_PROJECT_SCOPE') {
      return NextResponse.json({ error: 'Проєкт недоступний для цієї організації' }, { status: 400 });
    }
    return routeErrorResponse(error, { context: 'Invitation POST', fallbackMessage: 'Internal Server Error' });
  }
}
