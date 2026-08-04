import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import {
  canRestoreIssueTombstone,
  issueTombstoneId,
} from '@/lib/utils/issueTrash.mjs';

function restoreError(code, status, message) {
  const error = new Error(code);
  error.restoreApi = { code, status, message };
  return error;
}

export async function POST(request, context) {
  try {
    const { issueId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const organizationId = typeof body.organizationId === 'string'
      ? body.organizationId.trim().slice(0, 200)
      : '';
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const db = getAdminDb();
    const tombstoneRef = db.collection('deletedIssues').doc(
      issueTombstoneId(organizationId, issueId),
    );
    const initialTombstone = await tombstoneRef.get();
    if (!initialTombstone.exists) {
      return NextResponse.json({ error: 'Задачу не знайдено в кошику', code: 'TOMBSTONE_NOT_FOUND' }, { status: 404 });
    }
    const initial = initialTombstone.data();
    if (
      initial.organizationId !== organizationId
      || initial.issueId !== issueId
      || initial.issue?.organizationId !== organizationId
      || initial.issue?.id !== issueId
    ) {
      return NextResponse.json({ error: 'Пошкоджена область задачі в кошику', code: 'INVALID_TOMBSTONE_SCOPE' }, { status: 409 });
    }

    const result = await db.runTransaction(async transaction => {
      const tombstoneSnap = await transaction.get(tombstoneRef);
      if (!tombstoneSnap.exists) {
        throw restoreError('TOMBSTONE_NOT_FOUND', 404, 'Задачу не знайдено в кошику');
      }
      const tombstone = tombstoneSnap.data();
      if (!canRestoreIssueTombstone(tombstone)) {
        throw restoreError('UNDO_EXPIRED', 409, 'Час для скасування видалення минув');
      }
      const issue = tombstone.issue;
      if (
        tombstone.organizationId !== organizationId
        || tombstone.issueId !== issueId
        || issue.organizationId !== organizationId
        || issue.id !== issueId
      ) {
        throw restoreError('INVALID_TOMBSTONE_SCOPE', 409, 'Пошкоджена область задачі в кошику');
      }

      const issueRef = db.collection('issues').doc(issueId);
      const projectRef = db.collection('projects').doc(issue.projectId);
      const liveIssue = await transaction.get(issueRef);
      const project = await transaction.get(projectRef);
      if (liveIssue.exists) {
        throw restoreError('ISSUE_ALREADY_EXISTS', 409, 'Задачу вже відновлено');
      }
      if (
        !project.exists
        || project.data().organizationId !== organizationId
        || project.data().deletionPending === true
      ) {
        throw restoreError('PROJECT_NOT_AVAILABLE', 409, 'Проєкт задачі більше недоступний');
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const restoredIssue = { ...issue };
      delete restoredIssue.id;
      transaction.create(issueRef, {
        ...restoredIssue,
        deletionPending: false,
        updatedAt: now,
        lastActivityType: 'restored',
        lastActivityAt: now,
        lastActivityActorId: authorization.user.uid,
        lastActivityActorName: authorization.user.name || authorization.user.email || '',
        lastActivityActorAvatar: authorization.user.picture || null,
      });
      transaction.delete(tombstoneRef);
      transaction.update(projectRef, {
        issueHierarchyVersion: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });
      transaction.create(issueRef.collection('audit').doc(), {
        userId: authorization.user.uid,
        userName: authorization.user.name || authorization.user.email || '',
        action: 'restored',
        from: 'deleted',
        to: issue.issueKey || issueId,
        createdAt: now,
      });
      return { projectId: issue.projectId };
    });

    return NextResponse.json({ success: true, issueId, projectId: result.projectId });
  } catch (error) {
    if (error?.restoreApi) {
      return NextResponse.json({
        error: error.restoreApi.message,
        code: error.restoreApi.code,
      }, { status: error.restoreApi.status });
    }
    return routeErrorResponse(error, {
      context: 'Issue restore',
      fallbackMessage: 'Не вдалося відновити задачу',
    });
  }
}
