import { NextResponse } from 'next/server';
import {
  admin,
  enforceRateLimit,
  getAdminDb,
} from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { invoiceEstimateReservationId } from '@/lib/server/invoicePayload.mjs';
import {
  applyTaskTimeLogMutation,
  authorizeTaskTimeLogRequest,
  readLiveTaskTimeLogContext,
  readTaskTimeLogJson,
  taskTimeLogError,
  taskTimeLogErrorResponse,
} from '@/lib/server/taskTimeLogs';
import {
  cleanTaskTimeLogId,
  exactTaskTimeLogMinutes,
  isTaskEstimateReservationIdentity,
  parseTaskTimeLogDescription,
  parseTaskTimeLogTimestamp,
} from '@/lib/utils/taskTimeLog.mjs';

export async function POST(request, context) {
  try {
    const { issueId: rawIssueId } = await context.params;
    const issueId = cleanTaskTimeLogId(rawIssueId);
    const body = await readTaskTimeLogJson(request);
    const organizationId = cleanTaskTimeLogId(body.organizationId);
    const projectId = cleanTaskTimeLogId(body.projectId);
    const spentMinutes = exactTaskTimeLogMinutes(body.spentMinutes);
    const description = parseTaskTimeLogDescription(body.description);
    const loggedAt = parseTaskTimeLogTimestamp(body.loggedAt);
    if (
      !issueId
      || !organizationId
      || !projectId
      || spentMinutes === null
      || !description.ok
      || !loggedAt.ok
    ) {
      throw taskTimeLogError(
        'TASK_TIME_INVALID',
        400,
        'Перевірте завдання, тривалість, опис і дату списання часу',
      );
    }

    const authorization = await authorizeTaskTimeLogRequest(request, organizationId);
    if (
      body.userId !== undefined
      && body.userId !== authorization.user.uid
    ) {
      throw taskTimeLogError(
        'TASK_TIME_USER_MISMATCH',
        403,
        'Не можна списувати час від імені іншого користувача',
      );
    }
    if (!(await enforceRateLimit(
      'task-time-log-create',
      authorization.user.uid,
      60,
      60,
    ))) {
      throw taskTimeLogError(
        'TASK_TIME_RATE_LIMIT',
        429,
        'Забагато записів часу за короткий проміжок',
      );
    }

    const db = getAdminDb();
    const issueRef = db.collection('issues').doc(issueId);
    const estimateReservationRef = db.collection('invoiceEstimateReservations').doc(
      invoiceEstimateReservationId(organizationId, projectId, issueId),
    );
    const logRef = db.collection('timeLogs').doc();
    await db.runTransaction(async transaction => {
      const {
        initializeSpentMinutesMirror,
        issue,
        projectRef,
      } = await readLiveTaskTimeLogContext({
        transaction,
        db,
        issueRef,
        issueId,
        organizationId,
        projectId,
        authorization,
      });
      const estimateReservationSnapshot = await transaction.get(
        estimateReservationRef,
      );
      if (estimateReservationSnapshot.exists) {
        const reservation = estimateReservationSnapshot.data();
        if (!isTaskEstimateReservationIdentity(reservation, {
          issueId,
          organizationId,
          projectId,
        })) {
          throw taskTimeLogError(
            'TASK_TIME_ESTIMATE_RESERVATION_SCOPE_CONFLICT',
            409,
            'Резерв оцінки завдання має некоректну область. Потрібна звірка рахунку перед списанням часу',
            { estimateReservationId: estimateReservationSnapshot.id },
          );
        }
        throw taskTimeLogError(
          'TASK_TIME_ESTIMATE_ALREADY_INVOICED',
          409,
          'Оцінку цього завдання вже включено до рахунку, тому додати фактичний час не можна',
          {
            estimateReservationId: estimateReservationSnapshot.id,
            invoiceIds: reservation.invoiceId ? [reservation.invoiceId] : [],
          },
        );
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      transaction.create(logRef, {
        organizationId,
        projectId,
        issueId,
        userId: authorization.user.uid,
        spentMinutes,
        description: description.value,
        loggedAt: loggedAt.millis === null
          ? now
          : admin.firestore.Timestamp.fromMillis(loggedAt.millis),
        createdAt: now,
        updatedAt: now,
      });
      applyTaskTimeLogMutation({
        transaction,
        issueRef,
        issue,
        projectRef,
        spentMinutesDelta: spentMinutes,
        initializeSpentMinutesMirror,
      });
    });

    return NextResponse.json({ id: logRef.id }, { status: 201 });
  } catch (error) {
    if (error?.taskTimeLog) return taskTimeLogErrorResponse(error);
    return routeErrorResponse(error, {
      context: 'task time log POST',
      fallbackMessage: 'Не вдалося списати час',
    });
  }
}
