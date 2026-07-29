import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { localizedIssueAuthorizationMessage } from '@/lib/utils/issueApiMessages.mjs';
import {
  billedTimeLogDetails,
  isBilledTimeLog,
} from '@/lib/utils/issueDeletion.mjs';
import { invoiceEstimateReservationId } from '@/lib/server/invoicePayload.mjs';

const MAX_TRANSACTIONAL_CHILD_PROMOTION = 400;

function apiTransactionError(code, status, message, details = {}) {
  const error = new Error(code);
  error.api = { code, status, message, ...details };
  return error;
}

async function deleteRefsInBatches(db, refs) {
  const uniqueRefs = [...new Map(
    refs.map(ref => [ref.path, ref]),
  ).values()];
  for (let offset = 0; offset < uniqueRefs.length; offset += 400) {
    const batch = db.batch();
    uniqueRefs.slice(offset, offset + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return uniqueRefs.length;
}

async function deleteIssueRelationsAndTimeLogs(db, issue) {
  const [sourceLinks, targetLinks, timeLogs] = await Promise.all([
    db.collection('issueLinks').where('sourceIssueId', '==', issue.id).get(),
    db.collection('issueLinks').where('targetIssueId', '==', issue.id).get(),
    db.collection('timeLogs')
      .where('organizationId', '==', issue.organizationId)
      .where('issueId', '==', issue.id)
      .get(),
  ]);
  const refs = [
    ...sourceLinks.docs
      .filter(document => document.data().organizationId === issue.organizationId)
      .map(document => document.ref),
    ...targetLinks.docs
      .filter(document => document.data().organizationId === issue.organizationId)
      .map(document => document.ref),
    ...timeLogs.docs
      .filter(document => !isBilledTimeLog(document.data()))
      .map(document => document.ref),
  ];
  return deleteRefsInBatches(db, refs);
}

export async function DELETE(request, context) {
  try {
    const { issueId } = await context.params;
    const db = getAdminDb();
    const issueRef = db.collection('issues').doc(issueId);
    const issueSnap = await issueRef.get();
    if (!issueSnap.exists) {
      return NextResponse.json({
        error: 'Завдання не знайдено',
        code: 'ISSUE_NOT_FOUND',
      }, { status: 404 });
    }

    const issue = issueSnap.data();
    const authorization = await authorizeOrgRequest(
      request,
      issue.organizationId,
      ['owner', 'admin'],
    );
    if (authorization.error) {
      return NextResponse.json({
        error: localizedIssueAuthorizationMessage(authorization.error),
      }, { status: authorization.status });
    }

    const childPolicy = new URL(request.url).searchParams.get('childPolicy') || 'block';
    if (!['block', 'promote'].includes(childPolicy)) {
      return NextResponse.json({
        error: 'Некоректна політика для підзавдань',
        code: 'INVALID_CHILD_POLICY',
      }, { status: 400 });
    }

    const projectRef = db.collection('projects').doc(issue.projectId);
    const estimateReservationRef = db.collection('invoiceEstimateReservations').doc(
      invoiceEstimateReservationId(
        issue.organizationId,
        issue.projectId,
        issueId,
      ),
    );
    const deletion = await db.runTransaction(async transaction => {
      const currentSnap = await transaction.get(issueRef);
      const projectSnap = await transaction.get(projectRef);
      const estimateReservationSnap = await transaction.get(estimateReservationRef);
      if (!currentSnap.exists) {
        throw apiTransactionError(
          'ISSUE_NOT_FOUND',
          404,
          'Завдання не знайдено',
        );
      }
      const current = currentSnap.data();
      if (
        current.organizationId !== issue.organizationId
        || current.projectId !== issue.projectId
      ) {
        throw apiTransactionError(
          'ISSUE_SCOPE_CHANGED',
          409,
          'Область завдання змінилася. Оновіть сторінку',
        );
      }
      if (
        !projectSnap.exists
        || projectSnap.data().organizationId !== current.organizationId
      ) {
        throw apiTransactionError(
          'PROJECT_NOT_FOUND',
          404,
          'Проєкт завдання не знайдено',
        );
      }
      if (projectSnap.data().deletionPending === true) {
        throw apiTransactionError(
          'PROJECT_DELETING',
          409,
          'Проєкт уже видаляється',
        );
      }
      if (estimateReservationSnap.exists) {
        const reservation = estimateReservationSnap.data();
        throw apiTransactionError(
          'ISSUE_HAS_INVOICE_ESTIMATE',
          409,
          'Завдання вже входить у рахунок як оцінка і не може бути видалене',
          {
            invoiceIds: reservation.invoiceId ? [reservation.invoiceId] : [],
            estimateReservationId: estimateReservationSnap.id,
          },
        );
      }

      const timeLogs = await transaction.get(
        db.collection('timeLogs').where('issueId', '==', issueId),
      );
      const billedLogs = timeLogs.docs
        .filter(document => {
          const data = document.data();
          return data.organizationId === current.organizationId
            && data.projectId === current.projectId
            && isBilledTimeLog(data);
        })
        .map(document => ({ id: document.id, ...document.data() }));
      if (billedLogs.length > 0) {
        const details = billedTimeLogDetails(billedLogs);
        throw apiTransactionError(
          'ISSUE_HAS_BILLED_TIME',
          409,
          'Завдання має списаний у рахунок час і не може бути видалене',
          {
            billedTimeLogCount: billedLogs.length,
            ...details,
          },
        );
      }

      const canonicalChildren = await transaction.get(
        db.collection('issues').where('parentIssueId', '==', issueId),
      );
      const legacyChildren = await transaction.get(
        db.collection('issues').where('parentEpicId', '==', issueId),
      );
      const children = [...new Map(
        [...canonicalChildren.docs, ...legacyChildren.docs]
          .filter(child => {
            const data = child.data();
            return data.organizationId === current.organizationId
              && data.projectId === current.projectId;
          })
          .map(child => [child.id, child]),
      ).values()];

      if (children.length > 0 && childPolicy === 'block') {
        throw apiTransactionError(
          'ISSUE_HAS_CHILDREN',
          409,
          'Завдання має підзавдання. Підтвердьте їх перенесення на верхній рівень',
          { childCount: children.length, allowedChildPolicy: 'promote' },
        );
      }
      if (children.length > MAX_TRANSACTIONAL_CHILD_PROMOTION) {
        throw apiTransactionError(
          'TOO_MANY_CHILDREN_TO_PROMOTE',
          409,
          'Забагато підзавдань для безпечного автоматичного перенесення',
          {
            childCount: children.length,
            maxTransactionalPromotion: MAX_TRANSACTIONAL_CHILD_PROMOTION,
          },
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      children.forEach(child => {
        transaction.update(child.ref, {
          parentIssueId: null,
          parentEpicId: admin.firestore.FieldValue.delete(),
          updatedAt: now,
        });
      });
      transaction.update(issueRef, {
        deletionPending: true,
        updatedAt: now,
      });
      transaction.update(projectRef, {
        issueHierarchyVersion: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });
      return { promotedChildren: children.length };
    });

    const scopedIssue = {
      id: issueId,
      organizationId: issue.organizationId,
      projectId: issue.projectId,
    };
    let removedRelatedDocuments = await deleteIssueRelationsAndTimeLogs(db, scopedIssue);

    // recursiveDelete removes comments/audit subcollections as well as the issue.
    await db.recursiveDelete(issueRef);

    // Close the gap between the first cleanup query and the issue deletion. A
    // stale client can finish a time-log write that began before the deletion
    // marker became visible; the second sweep prevents an orphaned record.
    removedRelatedDocuments += await deleteIssueRelationsAndTimeLogs(db, scopedIssue);

    if (issue.projectId) {
      await db.collection('projects').doc(issue.projectId).update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      promotedChildren: deletion.promotedChildren,
      removedRelatedDocuments,
    });
  } catch (error) {
    if (error?.api) {
      return NextResponse.json({
        error: error.api.message,
        code: error.api.code,
        ...Object.fromEntries(
          Object.entries(error.api)
            .filter(([key]) => !['message', 'code', 'status'].includes(key)),
        ),
      }, { status: error.api.status });
    }
    return routeErrorResponse(error, {
      context: 'Issue DELETE',
      fallbackMessage: 'Не вдалося видалити завдання',
    });
  }
}
