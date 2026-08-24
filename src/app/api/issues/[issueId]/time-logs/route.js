import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import {
  enforceRateLimit,
  getAdminDb,
} from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { analyticsRollupDeltasFor } from '@/lib/server/analyticsRollups';
import { invoiceSourcelessReservationId } from '@/lib/server/invoicePayload.mjs';
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
        'Перевірте завдання, тривалість, опис і дату фіксації часу',
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
      invoiceSourcelessReservationId(organizationId, projectId, issueId),
    );
    const logRef = db.collection('timeLogs').doc();
    // Read outside the transaction: the timezone decides which day this hour is
    // filed under and changes approximately never, so it is not worth making
    // every time entry contend on the organization document.
    const rollupDeltas = await analyticsRollupDeltasFor(db, organizationId);
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
            'Резерв оцінки завдання має некоректну область. Потрібна звірка рахунку перед фіксацією часу',
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
      const now = FieldValue.serverTimestamp();
      // The day this hour is filed under. When the request carried no date the
      // stored `loggedAt` is the server's clock and this is the request's, which
      // differ by the round trip — enough to land either side of midnight only
      // in the rarest case, and the backfill re-derives the day from the stored
      // value when it does.
      const loggedAtMillis = loggedAt.millis === null ? Date.now() : loggedAt.millis;
      transaction.create(logRef, {
        organizationId,
        projectId,
        issueId,
        userId: authorization.user.uid,
        spentMinutes,
        description: description.value,
        loggedAt: loggedAt.millis === null
          ? now
          : Timestamp.fromMillis(loggedAt.millis),
        createdAt: now,
        updatedAt: now,
      });
      // Hours logged against a task somebody has already called off are counted
      // and corrected in the same breath, so that «logged» and «still counts»
      // stay two independent figures whichever order the two events happen in.
      rollupDeltas.add({
        organizationId,
        projectId,
        issueId,
        userId: authorization.user.uid,
        spentMinutes,
        loggedAt: new Date(loggedAtMillis),
      }, 1, { cancelled: Boolean(issue.cancelledAt) });
      applyTaskTimeLogMutation({
        transaction,
        db,
        issueRef,
        issue,
        projectRef,
        spentMinutesDelta: spentMinutes,
        rollupDeltas,
        initializeSpentMinutesMirror,
      });
    });

    return NextResponse.json({ id: logRef.id }, { status: 201 });
  } catch (error) {
    if (error?.taskTimeLog) return taskTimeLogErrorResponse(error);
    return routeErrorResponse(error, {
      context: 'task time log POST',
      fallbackMessage: 'Не вдалося зафіксувати час',
    });
  }
}
