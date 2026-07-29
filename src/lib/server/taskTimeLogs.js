import 'server-only';

import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest } from '@/lib/server/firebaseAdmin';
import { isBilledTimeLog } from '@/lib/utils/issueDeletion.mjs';
import {
  exactTaskTimeLogMinutes,
  isTaskTimeLogIdentity,
  TASK_TIME_LOG_MIRROR_VERSION,
  taskTimeLogMirrorTransition,
} from '@/lib/utils/taskTimeLog.mjs';

export const MAX_TASK_TIME_LOG_JSON_BYTES = 16_384;

export function taskTimeLogError(code, status, message, details = {}) {
  const error = new Error(code);
  error.taskTimeLog = { code, status, message, ...details };
  return error;
}

export function taskTimeLogErrorResponse(error) {
  const {
    status,
    message,
    ...details
  } = error.taskTimeLog;
  return NextResponse.json({ error: message, ...details }, { status });
}

export async function readTaskTimeLogJson(request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_TASK_TIME_LOG_JSON_BYTES
  ) {
    throw taskTimeLogError(
      'TASK_TIME_PAYLOAD_TOO_LARGE',
      413,
      'Запит на списання часу завеликий',
    );
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('INVALID_BODY');
    }
    return body;
  } catch (error) {
    if (error?.taskTimeLog) throw error;
    throw taskTimeLogError(
      'TASK_TIME_INVALID_JSON',
      400,
      'Некоректний JSON для списання часу',
    );
  }
}

export async function authorizeTaskTimeLogRequest(request, organizationId) {
  const authorization = await authorizeOrgRequest(
    request,
    organizationId,
    ['owner', 'admin', 'member'],
  );
  if (authorization.error) {
    throw taskTimeLogError(
      authorization.status === 401
        ? 'TASK_TIME_UNAUTHORIZED'
        : 'TASK_TIME_FORBIDDEN',
      authorization.status,
      authorization.status === 401
        ? 'Потрібно увійти в акаунт'
        : 'Немає доступу до цієї організації',
    );
  }
  return authorization;
}

export async function readLiveTaskTimeLogContext({
  transaction,
  db,
  issueRef,
  issueId,
  organizationId,
  projectId,
  authorization,
}) {
  const projectRef = db.collection('projects').doc(projectId);
  const membershipRef = db.collection('orgMemberships')
    .doc(`${organizationId}_${authorization.user.uid}`);
  const [
    membershipSnapshot,
    projectSnapshot,
    issueSnapshot,
  ] = await Promise.all([
    transaction.get(membershipRef),
    transaction.get(projectRef),
    transaction.get(issueRef),
  ]);

  const membership = membershipSnapshot.exists
    ? membershipSnapshot.data()
    : null;
  if (
    !membership
    || membership.orgId !== organizationId
    || membership.userId !== authorization.user.uid
    || !['owner', 'admin', 'member'].includes(membership.role)
  ) {
    throw taskTimeLogError(
      'TASK_TIME_MEMBERSHIP_CHANGED',
      403,
      'Доступ до організації змінився. Оновіть сторінку',
    );
  }

  const project = projectSnapshot.exists ? projectSnapshot.data() : null;
  if (!project || project.organizationId !== organizationId) {
    throw taskTimeLogError(
      'TASK_TIME_PROJECT_NOT_FOUND',
      404,
      'Проєкт не знайдено',
    );
  }
  if (project.deletionPending === true) {
    throw taskTimeLogError(
      'TASK_TIME_PROJECT_DELETING',
      409,
      'Проєкт уже видаляється',
    );
  }
  if (project.status === 'archived') {
    throw taskTimeLogError(
      'TASK_TIME_PROJECT_ARCHIVED',
      409,
      'Не можна списувати час в архівний проєкт',
    );
  }

  const privileged = ['owner', 'admin'].includes(membership.role);
  if (
    !privileged
    && !(Array.isArray(project.team) && project.team.includes(authorization.user.uid))
  ) {
    throw taskTimeLogError(
      'TASK_TIME_PROJECT_FORBIDDEN',
      403,
      'Списувати час можуть лише учасники команди цього проєкту',
    );
  }

  const issue = issueSnapshot.exists ? issueSnapshot.data() : null;
  if (
    !issue
    || issue.organizationId !== organizationId
    || issue.projectId !== projectId
  ) {
    throw taskTimeLogError(
      'TASK_TIME_ISSUE_NOT_FOUND',
      404,
      'Завдання не знайдено в цьому проєкті',
    );
  }
  if (issue.deletionPending === true) {
    throw taskTimeLogError(
      'TASK_TIME_ISSUE_DELETING',
      409,
      'Завдання уже видаляється',
    );
  }

  let initializeSpentMinutesMirror = false;
  if (issue.spentMinutesMirrorVersion !== TASK_TIME_LOG_MIRROR_VERSION) {
    const existingLogs = await transaction.get(
      db.collection('timeLogs')
        .where('issueId', '==', issueId)
        .limit(1),
    );
    if (!existingLogs.empty) {
      throw taskTimeLogError(
        'TASK_TIME_MIRROR_RECONCILIATION_REQUIRED',
        409,
        'Історичні записи часу треба звірити перед новими змінами',
      );
    }
    initializeSpentMinutesMirror = true;
  }

  return {
    initializeSpentMinutesMirror,
    issue,
    issueSnapshot,
    membership,
    project,
    projectRef,
  };
}

export function readMutableTaskTimeLog({
  snapshot,
  issueId,
  organizationId,
  projectId,
  authorization,
  membership,
}) {
  const log = snapshot.exists ? snapshot.data() : null;
  if (!isTaskTimeLogIdentity(log, { issueId, organizationId, projectId })) {
    throw taskTimeLogError(
      'TASK_TIME_LOG_NOT_FOUND',
      404,
      'Запис часу не знайдено для цього завдання',
    );
  }
  if (
    log.userId !== authorization.user.uid
    && !['owner', 'admin'].includes(membership.role)
  ) {
    throw taskTimeLogError(
      'TASK_TIME_LOG_FORBIDDEN',
      403,
      'Змінювати цей запис може лише його автор або адміністратор',
    );
  }
  if (isBilledTimeLog(log)) {
    throw taskTimeLogError(
      'TASK_TIME_LOG_BILLED',
      409,
      'Цей запис часу вже входить у рахунок і є незмінним',
    );
  }
  if (exactTaskTimeLogMinutes(log.spentMinutes) === null) {
    throw taskTimeLogError(
      'TASK_TIME_LOG_INVALID_STORED_DURATION',
      409,
      'Запис часу потребує звірки перед зміною',
    );
  }
  return log;
}

export function applyTaskTimeLogMutation({
  transaction,
  issueRef,
  issue,
  projectRef,
  spentMinutesDelta,
  initializeSpentMinutesMirror = false,
}) {
  const mirrorTransition = taskTimeLogMirrorTransition({
    currentSpentMinutes: issue.spentMinutes,
    spentMinutesDelta,
    initialize: initializeSpentMinutesMirror,
  });
  if (!mirrorTransition) {
    throw taskTimeLogError(
      'TASK_TIME_MIRROR_RECONCILIATION_REQUIRED',
      409,
      'Підсумок часу завдання потребує звірки перед зміною',
    );
  }

  const issueUpdates = {
    spentMinutesMirrorVersion: TASK_TIME_LOG_MIRROR_VERSION,
    timeLogMutationVersion: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (initializeSpentMinutesMirror) {
    issueUpdates.spentMinutes = mirrorTransition.next;
  } else if (spentMinutesDelta !== 0) {
    issueUpdates.spentMinutes = admin.firestore.FieldValue.increment(spentMinutesDelta);
  }
  transaction.update(issueRef, issueUpdates);
  transaction.update(projectRef, {
    invoiceMutationVersion: admin.firestore.FieldValue.increment(1),
  });
}
