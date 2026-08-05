import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { projectIssuePrefix } from '@/lib/utils/issueKeys.mjs';
import {
  DEFAULT_LABEL_IDS,
  DEFAULT_PRIORITY_IDS,
  DEFAULT_STATUS_IDS,
  DEFAULT_TYPE_IDS,
  resolveDoneStatusIds,
  resolveEntryStatusId,
  workflowIds,
} from '@/lib/utils/workflowDefaults.mjs';
import {
  normalizeParentIssueId,
  validateIssueParentAssignment,
} from '@/lib/utils/issueHierarchyModel.mjs';
import { localizedIssueAuthorizationMessage } from '@/lib/utils/issueApiMessages.mjs';
import { resolveNewIssueType } from '@/lib/utils/issueCreationModel.mjs';
import { issueParentStatusConflict } from '@/lib/utils/issueStatusTransition.mjs';

function normalizedDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? admin.firestore.Timestamp.fromDate(date) : undefined;
}

function hierarchyTransactionError(details) {
  const error = new Error(details.code);
  error.hierarchy = details;
  return error;
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        error: 'Тіло запиту має бути коректним JSON',
        code: 'INVALID_JSON',
      }, { status: 400 });
    }
    const {
      organizationId: rawOrganizationId,
      projectId: rawProjectId,
      data: rawData,
    } = body || {};
    const organizationId = typeof rawOrganizationId === 'string'
      ? rawOrganizationId.trim()
      : '';
    const projectId = typeof rawProjectId === 'string' ? rawProjectId.trim() : '';
    const data = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? rawData
      : {};
    if (
      !organizationId
      || organizationId.length > 256
      || !projectId
      || projectId.length > 256
    ) {
      return NextResponse.json({
        error: 'Потрібні коректні організація та проєкт',
        code: 'INVALID_SCOPE',
      }, { status: 400 });
    }
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) {
      return NextResponse.json({
        error: localizedIssueAuthorizationMessage(authorization.error),
      }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('issue-create', authorization.user.uid, 60, 60))) {
      return NextResponse.json({ error: 'Забагато запитів на створення завдань' }, { status: 429 });
    }
    if (!projectId || typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 240) {
      return NextResponse.json({ error: 'Потрібні коректний проєкт і назва завдання' }, { status: 400 });
    }
    if (data.parentEpicId) {
      return NextResponse.json({
        error: 'Поле parentEpicId застаріло. Використовуйте parentIssueId',
        code: 'LEGACY_PARENT_FIELD',
      }, { status: 400 });
    }
    if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
      return NextResponse.json({
        error: 'Вкладені пункти треба додавати як чекліст в описі або як окремі підзадачі',
        code: 'LEGACY_SUBTASKS_UNSUPPORTED',
      }, { status: 400 });
    }
    if (data.type === 'epic') {
      return NextResponse.json({
        error: 'Епік є лише legacy-типом і недоступний для нових завдань',
        code: 'LEGACY_EPIC_TYPE',
      }, { status: 400 });
    }

    const db = getAdminDb();
    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists || projectSnap.data().organizationId !== organizationId) {
      return NextResponse.json({ error: 'Проєкт не належить цій організації' }, { status: 400 });
    }
    const projectData = projectSnap.data();

    // Per-project access: a plain member may only create tasks in projects they
    // belong to. Owners/admins can create in any project of the org. This is the
    // server-side counterpart to the team-gated `projects` read rule — without it
    // a member could POST an issue into a project they can't even see.
    const role = authorization.membership?.role;
    const isPrivileged = role === 'owner' || role === 'admin';
    const projectTeam = projectData.team;
    if (!isPrivileged && !(Array.isArray(projectTeam) && projectTeam.includes(authorization.user.uid))) {
      return NextResponse.json({ error: 'Ви не входите до команди цього проєкту' }, { status: 403 });
    }

    const assigneeIds = Array.isArray(data.assigneeIds) ? [...new Set(data.assigneeIds)].slice(0, 20) : [];
    if (assigneeIds.length) {
      const refs = assigneeIds.map(uid => db.collection('orgMemberships').doc(`${organizationId}_${uid}`));
      const memberships = await db.getAll(...refs);
      if (memberships.some((snap, index) => !snap.exists || snap.data().userId !== assigneeIds[index])) {
        return NextResponse.json({ error: 'Виконавець не є учасником організації' }, { status: 400 });
      }
    }

    if (data.sprintId) {
      const sprintSnap = await db.collection('sprints').doc(data.sprintId).get();
      if (
        !sprintSnap.exists
        || sprintSnap.data().organizationId !== organizationId
        || sprintSnap.data().status === 'completed'
      ) {
        return NextResponse.json({ error: 'Некоректний або вже завершений спринт' }, { status: 400 });
      }
    }

    const parentIssueId = normalizeParentIssueId(data.parentIssueId);
    if (parentIssueId === undefined) {
      return NextResponse.json({
        error: 'Некоректний ідентифікатор батьківського завдання',
        code: 'INVALID_PARENT_ID',
      }, { status: 400 });
    }

    const dueDate = normalizedDate(data.dueDate);
    if (dueDate === undefined) {
      return NextResponse.json({ error: 'Некоректний дедлайн' }, { status: 400 });
    }

    const workflowRef = db.collection('organizations').doc(organizationId)
      .collection('settings').doc('workflow');
    const workflowSnap = await workflowRef.get();
    const workflow = workflowSnap.data() || {};
    const statusIds = workflowIds(workflow.statuses, DEFAULT_STATUS_IDS);
    const typeSelection = resolveNewIssueType(
      data.type,
      workflowIds(workflow.types, DEFAULT_TYPE_IDS),
    );
    if (typeSelection.error) {
      return NextResponse.json({
        error: typeSelection.error.message,
        code: typeSelection.error.code,
      }, { status: typeSelection.error.status });
    }
    const requestedStatus = typeof data.status === 'string' ? data.status : null;
    if (requestedStatus && !statusIds.includes(requestedStatus)) {
      return NextResponse.json({ error: 'Некоректний статус процесу' }, { status: 400 });
    }
    const issueRef = db.collection('issues').doc();
    let issueKey;

    await db.runTransaction(async transaction => {
      const freshProjectSnap = await transaction.get(projectRef);
      const freshWorkflowSnap = await transaction.get(workflowRef);
      if (!freshProjectSnap.exists || freshProjectSnap.data().organizationId !== organizationId) {
        throw new Error('PROJECT_NOT_FOUND');
      }
      const project = freshProjectSnap.data();
      if (project.deletionPending === true) {
        throw hierarchyTransactionError({
          code: 'PROJECT_DELETING',
          status: 409,
          message: 'Проєкт уже видаляється',
        });
      }
      const freshWorkflow = freshWorkflowSnap.data() || {};
      const freshStatusIds = workflowIds(
        freshWorkflow.statuses,
        DEFAULT_STATUS_IDS,
      );
      const entryStatusId = resolveEntryStatusId(
        freshWorkflow.statuses,
        project.hiddenColumns,
      );
      const statusCandidate = requestedStatus || entryStatusId;
      if (!freshStatusIds.includes(statusCandidate)) {
        throw hierarchyTransactionError({
          code: 'INVALID_WORKFLOW_STATUS',
          status: 400,
          message: 'Статус не належить до поточного workflow',
        });
      }
      const status = (project.hiddenColumns || []).includes(statusCandidate)
        ? entryStatusId
        : statusCandidate;
      const doneIds = resolveDoneStatusIds(freshWorkflow.statuses);
      const freshPriorityIds = new Set(workflowIds(
        freshWorkflow.priorities,
        DEFAULT_PRIORITY_IDS,
      ));
      const freshTypeSelection = resolveNewIssueType(
        data.type,
        workflowIds(freshWorkflow.types, DEFAULT_TYPE_IDS),
      );
      if (freshTypeSelection.error) {
        throw hierarchyTransactionError(freshTypeSelection.error);
      }
      const freshLabelIds = new Set(workflowIds(
        freshWorkflow.labels,
        DEFAULT_LABEL_IDS,
      ));
      if (data.sprintId) {
        const sprintSnap = await transaction.get(
          db.collection('sprints').doc(data.sprintId),
        );
        if (
          !sprintSnap.exists
          || sprintSnap.data().organizationId !== organizationId
          || sprintSnap.data().status === 'completed'
        ) {
          throw hierarchyTransactionError({
            code: 'INVALID_SPRINT',
            status: 400,
            message: 'Некоректний або вже завершений спринт',
          });
        }
      }
      if (parentIssueId) {
        const parentSnap = await transaction.get(db.collection('issues').doc(parentIssueId));
        const parent = parentSnap.exists
          ? { id: parentSnap.id, ...parentSnap.data() }
          : null;
        const hierarchyError = validateIssueParentAssignment({
          issueId: issueRef.id,
          issue: {
            id: issueRef.id,
            organizationId,
            projectId,
            deletionPending: false,
            columnId: status,
            status,
          },
          requestedParentIssueId: parentIssueId,
          parent,
          childIds: [],
        });
        if (hierarchyError) throw hierarchyTransactionError(hierarchyError);
        const statusConflict = issueParentStatusConflict({
          issue: {
            id: issueRef.id,
            organizationId,
            projectId,
            columnId: status,
            status,
          },
          parentIssue: parent,
          doneStatusIds: doneIds,
        });
        if (statusConflict) throw hierarchyTransactionError(statusConflict);
      }
      const next = (project.issueCounter || 0) + 1;
      issueKey = `${projectIssuePrefix(project)}-${next}`;
      const now = admin.firestore.FieldValue.serverTimestamp();
      const payload = {
        issueKey,
        organizationId,
        projectId,
        title: data.title.trim(),
        description: typeof data.description === 'string' ? data.description.slice(0, 50_000) : '',
        columnId: status,
        status,
        priority: freshPriorityIds.has(data.priority)
          ? data.priority
          : (freshPriorityIds.has('medium') ? 'medium' : [...freshPriorityIds][0]),
        type: freshTypeSelection.type,
        assigneeIds,
        labelIds: Array.isArray(data.labelIds)
          ? data.labelIds.filter(id => freshLabelIds.has(id)).slice(0, 20)
          : [],
        dueDate,
        sprintId: data.sprintId || null,
        reporterId: authorization.user.uid,
        estimateMinutes: Number.isFinite(data.estimateMinutes) ? Math.max(0, data.estimateMinutes) : null,
        spentMinutes: 0,
        spentMinutesMirrorVersion: 1,
        timeLogMutationVersion: 0,
        parentIssueId,
        watcherIds: [],
        order: -next,
        createdBy: authorization.user.uid,
        createdAt: now,
        updatedAt: now,
        lastActivityType: 'created',
        lastActivityAt: now,
        lastActivityActorId: authorization.user.uid,
        lastActivityActorName: authorization.user.name || authorization.user.email || '',
        lastActivityActorAvatar: authorization.user.picture || null,
        ...(doneIds.includes(status) ? { completedAt: now } : {}),
      };
      transaction.create(issueRef, payload);
      transaction.update(projectRef, {
        issueCounter: next,
        updatedAt: now,
        ...(parentIssueId
          ? { issueHierarchyVersion: admin.firestore.FieldValue.increment(1) }
          : {}),
      });
      transaction.create(issueRef.collection('audit').doc(), {
        userId: authorization.user.uid,
        userName: authorization.user.name || authorization.user.email || '',
        action: 'created',
        from: null,
        to: issueKey,
        createdAt: now,
      });
    });

    return NextResponse.json({ id: issueRef.id, issueKey }, { status: 201 });
  } catch (error) {
    if (error?.hierarchy) {
      return NextResponse.json({
        error: error.hierarchy.message,
        code: error.hierarchy.code,
        ...(error.hierarchy.childCount ? { childCount: error.hierarchy.childCount } : {}),
      }, { status: error.hierarchy.status });
    }
    if (error?.message === 'PROJECT_NOT_FOUND') {
      return NextResponse.json({ error: 'Проєкт не знайдено', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
    }
    return routeErrorResponse(error, {
      context: 'Issue POST',
      fallbackMessage: 'Не вдалося створити завдання',
    });
  }
}
