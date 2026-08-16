// Deleting your own account.
//
// Until now the product had no way to do this at all: the help centre told
// people to email support, which is not an answer for the one action a person
// is unconditionally entitled to take about their own data.
//
// What this route will and will not do, and why:
//
//   • It detaches the person from every organization they belong to, using the
//     same cascade an administrator's «remove member» already performs — team
//     lists, assignees and watchers — so no board is left pointing at a user
//     document that no longer exists.
//   • It deletes the private user document and its settings, then the Firebase
//     Auth user, which is what actually ends the account.
//   • It refuses while the person still *owns* an organization. An owner is the
//     only role that can administer an organization, and there is no ownership
//     transfer in the product yet; deleting them would leave a workspace with
//     data, members and billing and nobody able to touch any of it. The refusal
//     names the organizations so the message is actionable rather than a wall.
//
// Authored content — tasks, comments, time logs — is deliberately left in
// place. It belongs to the organization's record of its own work, and removing
// it would silently rewrite other people's history; the author reference stops
// resolving to a live profile, which is what leaving looks like everywhere
// else in the product.

import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  enforceRateLimit,
  FieldValue,
  getAdminAuth,
  getAdminDb,
} from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

const USER_SUBCOLLECTIONS = ['settings', 'private'];

function accountError(status, message, details = {}) {
  const error = new Error(message);
  error.accountMutation = { status, message, details };
  return error;
}

async function membershipsOf(db, uid) {
  const snapshot = await db.collection('orgMemberships')
    .where('userId', '==', uid)
    .get();
  return snapshot.docs.map(document => ({ ref: document.ref, ...document.data() }));
}

async function organizationNames(db, organizationIds) {
  if (organizationIds.length === 0) return [];
  const documents = await db.getAll(
    ...organizationIds.map(id => db.collection('organizations').doc(id)),
  );
  return documents.map((document, index) => (
    document.exists ? (document.data().name || organizationIds[index]) : organizationIds[index]
  ));
}

/** What deleting this account would touch, so the confirmation can say it. */
async function deletionImpact(db, uid) {
  const memberships = await membershipsOf(db, uid);
  const ownedIds = memberships.filter(item => item.role === 'owner').map(item => item.orgId);
  const [ownedOrganizations, projects, assignedIssues] = await Promise.all([
    organizationNames(db, ownedIds),
    db.collection('projects').where('team', 'array-contains', uid).get(),
    db.collection('issues').where('assigneeIds', 'array-contains', uid).get(),
  ]);
  return {
    memberships,
    ownedOrganizations,
    organizationCount: memberships.length,
    projectCount: projects.size,
    assignedIssueCount: assignedIssues.size,
  };
}

export async function GET(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const db = getAdminDb();
    const impact = await deletionImpact(db, authorization.user.uid);
    return NextResponse.json({
      canDelete: impact.ownedOrganizations.length === 0,
      ownedOrganizations: impact.ownedOrganizations,
      organizationCount: impact.organizationCount,
      projectCount: impact.projectCount,
      assignedIssueCount: impact.assignedIssueCount,
    });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'account-deletion-impact',
      fallbackMessage: 'Не вдалося перевірити обліковий запис',
    });
  }
}

export async function DELETE(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const uid = authorization.user.uid;

    // Irreversible and cheap to trigger by accident from a script; three
    // attempts an hour is plenty for a person who means it.
    const allowed = await enforceRateLimit('account-delete', uid, 3, 3600);
    if (!allowed) {
      return NextResponse.json({
        error: 'Забагато спроб. Спробуйте за годину',
        code: 'RATE_LIMITED',
      }, { status: 429 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const memberships = await membershipsOf(db, uid);
    const ownedIds = memberships.filter(item => item.role === 'owner').map(item => item.orgId);
    if (ownedIds.length > 0) {
      throw accountError(
        409,
        'Ви власник організації. Передайте власність або зверніться до підтримки, щоб видалити організацію',
        { code: 'OWNS_ORGANIZATION', organizations: await organizationNames(db, ownedIds) },
      );
    }

    // Detach from the shared record first. If any of this fails the account is
    // still usable, which is the safe direction to fail in — the alternative is
    // an auth user that is gone while boards still point at them.
    const writer = db.bulkWriter();
    for (const organizationId of memberships.map(item => item.orgId)) {
      const [projects, assignedIssues, watchedIssues] = await Promise.all([
        db.collection('projects')
          .where('organizationId', '==', organizationId)
          .where('team', 'array-contains', uid)
          .get(),
        db.collection('issues')
          .where('organizationId', '==', organizationId)
          .where('assigneeIds', 'array-contains', uid)
          .get(),
        db.collection('issues')
          .where('organizationId', '==', organizationId)
          .where('watcherIds', 'array-contains', uid)
          .get(),
      ]);
      for (const project of projects.docs) {
        writer.update(project.ref, {
          team: FieldValue.arrayRemove(uid),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      const issueUpdates = new Map();
      for (const issue of assignedIssues.docs) {
        issueUpdates.set(issue.id, { ref: issue.ref, update: { assigneeIds: FieldValue.arrayRemove(uid) } });
      }
      for (const issue of watchedIssues.docs) {
        const current = issueUpdates.get(issue.id) || { ref: issue.ref, update: {} };
        current.update.watcherIds = FieldValue.arrayRemove(uid);
        issueUpdates.set(issue.id, current);
      }
      for (const issue of issueUpdates.values()) {
        writer.update(issue.ref, { ...issue.update, updatedAt: FieldValue.serverTimestamp() });
      }
      writer.delete(db.collection('organizations').doc(organizationId).collection('memberRates').doc(uid));
      writer.update(db.collection('organizations').doc(organizationId), {
        memberDirectoryVersion: FieldValue.increment(1),
      });
    }
    for (const membership of memberships) writer.delete(membership.ref);
    await writer.close();

    const userRef = db.collection('users').doc(uid);
    for (const name of USER_SUBCOLLECTIONS) {
      await db.recursiveDelete(userRef.collection(name)).catch(() => {});
    }
    await userRef.delete().catch(() => {});

    // Last, because it is the only step that cannot be retried by the same
    // caller: once the auth user is gone there is no token left to send.
    await auth.deleteUser(uid);
    await auth.revokeRefreshTokens(uid).catch(() => {});

    return NextResponse.json({
      success: true,
      organizationCount: memberships.length,
    });
  } catch (error) {
    if (error?.accountMutation) {
      return NextResponse.json({
        error: error.accountMutation.message,
        ...error.accountMutation.details,
      }, { status: error.accountMutation.status });
    }
    return routeErrorResponse(error, {
      context: 'account-delete',
      fallbackMessage: 'Не вдалося видалити обліковий запис',
    });
  }
}
