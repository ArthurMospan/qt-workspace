import { NextResponse } from 'next/server';
import {
  admin,
  authorizeOrgRequest,
  enforceRateLimit,
  getAdminDb,
} from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { localizedIssueAuthorizationMessage } from '@/lib/utils/issueApiMessages.mjs';
import {
  introducedIssueExecutionViolations,
} from '@/lib/utils/issueStatusTransition.mjs';
import {
  DEFAULT_STATUS_IDS,
  resolveDoneStatusIds,
  workflowIds,
} from '@/lib/utils/workflowDefaults.mjs';
import {
  normalizeWorkflowMutationInput,
  sameStringSet,
  WORKFLOW_MUTATION_SECTIONS,
} from '@/lib/utils/workflowMutation.mjs';

const MAX_TRANSACTION_WRITES = 450;

function workflowError(code, status, message, details = {}) {
  const error = new Error(code);
  error.workflow = { code, status, message, ...details };
  return error;
}

function serializedLink(document) {
  return { id: document.id, ...document.data() };
}

function statusIdOf(issue) {
  return issue?.columnId || issue?.status || null;
}

function owns(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function workflowSectionsEqual(current, next) {
  return WORKFLOW_MUTATION_SECTIONS.every(section => (
    JSON.stringify(current?.[section] || []) === JSON.stringify(next[section])
  ));
}

function sameIssueScope(left, right) {
  return left?.organizationId === right?.organizationId
    && left?.projectId === right?.projectId;
}

export async function PATCH(request, context) {
  try {
    const { organizationId } = await context.params;
    const authorization = await authorizeOrgRequest(
      request,
      organizationId,
      ['owner', 'admin'],
    );
    if (authorization.error) {
      return NextResponse.json({
        error: localizedIssueAuthorizationMessage(authorization.error),
      }, { status: authorization.status });
    }
    if (!(await enforceRateLimit(
      'workflow-update',
      authorization.user.uid,
      30,
      60,
    ))) {
      return NextResponse.json({
        error: 'Забагато змін workflow. Спробуйте ще раз за хвилину',
        code: 'RATE_LIMITED',
      }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        error: 'Тіло запиту має бути коректним JSON',
        code: 'INVALID_JSON',
      }, { status: 400 });
    }
    const normalized = normalizeWorkflowMutationInput(body);
    if (normalized.error) {
      const { status, ...payload } = normalized.error;
      return NextResponse.json({
        error: payload.message,
        ...Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== 'message'),
        ),
      }, { status });
    }

    const { workflow: nextWorkflow, statusMigrations } = normalized.value;
    const nextStatusIds = nextWorkflow.statuses.map(status => status.id);
    const nextDoneStatusIds = resolveDoneStatusIds(nextWorkflow.statuses);
    const migrationTargetIds = new Set(
      statusMigrations.map(migration => migration.toStatusId),
    );
    const invalidMigrationTargets = [...migrationTargetIds]
      .filter(statusId => !nextStatusIds.includes(statusId));
    if (invalidMigrationTargets.length > 0) {
      return NextResponse.json({
        error: 'Ціль міграції має існувати в новому workflow',
        code: 'STATUS_MIGRATION_TARGET_NOT_FOUND',
        statusIds: invalidMigrationTargets,
      }, { status: 400 });
    }

    const db = getAdminDb();
    const workflowRef = db.collection('organizations')
      .doc(organizationId)
      .collection('settings')
      .doc('workflow');
    const migrationBySource = new Map(
      statusMigrations.map(migration => [
        migration.fromStatusId,
        migration.toStatusId,
      ]),
    );
    const result = await db.runTransaction(async transaction => {
      const currentWorkflowSnap = await transaction.get(workflowRef);
      const currentWorkflow = currentWorkflowSnap.data() || {};
      const currentStatusIds = workflowIds(
        currentWorkflow.statuses,
        DEFAULT_STATUS_IDS,
      );
      const currentDoneStatusIds = resolveDoneStatusIds(
        currentWorkflow.statuses,
      );
      const executionSemanticsChanged = (
        !sameStringSet(currentStatusIds, nextStatusIds)
        || !sameStringSet(currentDoneStatusIds, nextDoneStatusIds)
        || statusMigrations.length > 0
      );

      if (!executionSemanticsChanged) {
        if (workflowSectionsEqual(currentWorkflow, nextWorkflow)) {
          return {
            changed: false,
            migratedIssues: 0,
            changedTerminalSemantics: false,
            updatedProjects: 0,
          };
        }
        transaction.set(workflowRef, {
          ...nextWorkflow,
          schemaVersion: 2,
          updatedBy: authorization.user.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
          changed: true,
          migratedIssues: 0,
          changedTerminalSemantics: false,
          updatedProjects: 0,
        };
      }

      const issuesSnapshot = await transaction.get(
        db.collection('issues').where('organizationId', '==', organizationId),
      );
      const linksSnapshot = await transaction.get(
        db.collection('issueLinks').where('organizationId', '==', organizationId),
      );
      const projectsSnapshot = await transaction.get(
        db.collection('projects').where('organizationId', '==', organizationId),
      );
      const currentIssues = issuesSnapshot.docs.map(document => ({
        id: document.id,
        ...document.data(),
      }));
      const missingMigrationCounts = new Map();
      const nextIssues = currentIssues.map(issue => {
        const currentStatusId = statusIdOf(issue);
        if (nextStatusIds.includes(currentStatusId)) return issue;
        const targetStatusId = migrationBySource.get(currentStatusId);
        if (!targetStatusId) {
          missingMigrationCounts.set(
            currentStatusId || '(empty)',
            (missingMigrationCounts.get(currentStatusId || '(empty)') || 0) + 1,
          );
          return issue;
        }
        return {
          ...issue,
          columnId: targetStatusId,
          status: targetStatusId,
        };
      });
      if (missingMigrationCounts.size > 0) {
        throw workflowError(
          'STATUS_MIGRATION_REQUIRED',
          409,
          'Для видалених або застарілих статусів потрібно вибрати ціль міграції',
          {
            statuses: [...missingMigrationCounts].map(([statusId, issueCount]) => ({
              statusId,
              issueCount,
            })),
          },
        );
      }

      const issueById = new Map(currentIssues.map(issue => [issue.id, issue]));
      const scopedLinks = linksSnapshot.docs
        .map(serializedLink)
        .filter(link => {
          const source = issueById.get(link.sourceIssueId);
          const target = issueById.get(link.targetIssueId);
          return source && target && sameIssueScope(source, target);
        });
      const violations = introducedIssueExecutionViolations({
        currentIssues,
        nextIssues,
        issueLinks: scopedLinks,
        currentDoneStatusIds,
        nextDoneStatusIds,
      });
      if (violations.length > 0) {
        throw workflowError(
          'WORKFLOW_EXECUTION_CONFLICT',
          409,
          'Нові завершальні статуси суперечать ієрархії або залежностям',
          {
            violationCount: violations.length,
            violations: violations.slice(0, 50),
          },
        );
      }

      const currentDoneSet = new Set(currentDoneStatusIds);
      const nextDoneSet = new Set(nextDoneStatusIds);
      const issueChanges = [];
      nextIssues.forEach((nextIssue, index) => {
        const currentIssue = currentIssues[index];
        const currentStatusId = statusIdOf(currentIssue);
        const nextStatusId = statusIdOf(nextIssue);
        const statusChanged = (
          currentIssue.columnId !== nextStatusId
          || currentIssue.status !== nextStatusId
        );
        const wasDone = currentDoneSet.has(currentStatusId);
        const willBeDone = nextDoneSet.has(nextStatusId);
        const completedAtNeedsSet = willBeDone
          && (!wasDone || (statusChanged && !currentIssue.completedAt));
        const completedAtNeedsClear = !willBeDone
          && (wasDone || statusChanged)
          && owns(currentIssue, 'completedAt');
        if (
          statusChanged
          || completedAtNeedsSet
          || completedAtNeedsClear
        ) {
          issueChanges.push({
            currentIssue,
            nextStatusId,
            wasDone,
            willBeDone,
            completedAtNeedsSet,
            completedAtNeedsClear,
          });
        }
      });

      const projectsById = new Map(
        projectsSnapshot.docs.map(document => [document.id, document]),
      );
      const projectChanges = new Map();
      const removedStatusIds = currentStatusIds.filter(
        statusId => !nextStatusIds.includes(statusId),
      );
      for (const projectDocument of projectsSnapshot.docs) {
        const project = projectDocument.data();
        const hiddenColumns = Array.isArray(project.hiddenColumns)
          ? project.hiddenColumns
          : [];
        const nextHiddenColumns = hiddenColumns.filter(
          statusId => (
            !removedStatusIds.includes(statusId)
            && !migrationTargetIds.has(statusId)
          ),
        );
        if (nextHiddenColumns.length !== hiddenColumns.length) {
          if (project.deletionPending === true) {
            throw workflowError(
              'PROJECT_DELETING',
              409,
              'Один із проєктів уже видаляється',
              { projectId: projectDocument.id },
            );
          }
          projectChanges.set(projectDocument.id, {
            document: projectDocument,
            hiddenColumns: nextHiddenColumns,
          });
        }
      }
      for (const change of issueChanges) {
        if (change.currentIssue.deletionPending === true) {
          throw workflowError(
            'ISSUE_DELETING',
            409,
            'Одне із завдань уже видаляють. Дочекайтеся завершення й повторіть зміну workflow',
            { issueId: change.currentIssue.id },
          );
        }
        const projectDocument = projectsById.get(change.currentIssue.projectId);
        if (!projectDocument) continue;
        if (projectDocument.data().deletionPending === true) {
          throw workflowError(
            'PROJECT_DELETING',
            409,
            'Один із проєктів уже видаляється',
            { projectId: projectDocument.id },
          );
        }
        if (!projectChanges.has(projectDocument.id)) {
          projectChanges.set(projectDocument.id, {
            document: projectDocument,
            hiddenColumns: null,
          });
        }
      }

      const plannedWrites = (
        issueChanges.length * 2
        + projectChanges.size
        + 1
      );
      if (plannedWrites > MAX_TRANSACTION_WRITES) {
        throw workflowError(
          'WORKFLOW_MIGRATION_TOO_LARGE',
          409,
          'Забагато завдань для однієї безпечної транзакції. Виконайте окрему адміністративну міграцію',
          {
            affectedIssues: issueChanges.length,
            affectedProjects: projectChanges.size,
            maxTransactionWrites: MAX_TRANSACTION_WRITES,
          },
        );
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      for (const change of issueChanges) {
        const issueRef = db.collection('issues').doc(change.currentIssue.id);
        const updates = {
          columnId: change.nextStatusId,
          status: change.nextStatusId,
          updatedAt: now,
        };
        if (change.completedAtNeedsSet) {
          updates.completedAt = now;
        } else if (change.completedAtNeedsClear) {
          updates.completedAt = admin.firestore.FieldValue.delete();
        }
        transaction.update(issueRef, updates);
        transaction.create(issueRef.collection('audit').doc(), {
          userId: authorization.user.uid,
          userName: authorization.user.name || authorization.user.email || '',
          action: 'workflow-status-migrated',
          from: statusIdOf(change.currentIssue),
          to: change.nextStatusId,
          fromCompleted: change.wasDone,
          toCompleted: change.willBeDone,
          createdAt: now,
        });
      }
      for (const change of projectChanges.values()) {
        transaction.update(change.document.ref, {
          ...(change.hiddenColumns
            ? { hiddenColumns: change.hiddenColumns }
            : {}),
          issueStatusVersion: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        });
      }
      transaction.set(workflowRef, {
        ...nextWorkflow,
        schemaVersion: 2,
        updatedBy: authorization.user.uid,
        updatedAt: now,
      }, { merge: true });
      return {
        changed: true,
        migratedIssues: issueChanges.length,
        changedTerminalSemantics: !sameStringSet(
          currentDoneStatusIds,
          nextDoneStatusIds,
        ),
        updatedProjects: projectChanges.size,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
      doneStatusIds: nextDoneStatusIds,
    });
  } catch (error) {
    if (error?.workflow) {
      const { message, status, ...details } = error.workflow;
      return NextResponse.json({
        error: message,
        ...details,
      }, { status });
    }
    return routeErrorResponse(error, {
      context: 'Workflow PATCH',
      fallbackMessage: 'Не вдалося оновити workflow',
    });
  }
}
