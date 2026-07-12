import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';

const DEFAULT_PRIORITIES = ['blocker', 'high', 'medium', 'low'];
const DEFAULT_TYPES = ['epic', 'feature', 'task', 'bug'];
const DEFAULT_STATUSES = ['backlog', 'todo', 'in-progress', 'done'];
const DEFAULT_LABELS = ['bug', 'frontend', 'design'];

function projectPrefix(project) {
  if (project.issuePrefix) return String(project.issuePrefix).slice(0, 8).toUpperCase();
  const letters = String(project.name || 'WS').match(/\p{L}/gu)?.join('') || 'WS';
  return letters.slice(0, 3).toUpperCase();
}

function terminalStatusIds(workflow) {
  const statuses = workflow?.statuses || [];
  const explicit = statuses.filter(status => status.isDone === true).map(status => status.id);
  if (explicit.length) return explicit;
  if (statuses.some(status => status.id === 'done')) return ['done'];
  return statuses.length ? [statuses.at(-1).id] : ['done'];
}

function normalizedDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? admin.firestore.Timestamp.fromDate(date) : undefined;
}

function normalizedSubtasks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(item => {
    const title = typeof item?.title === 'string' ? item.title.trim().slice(0, 500) : '';
    return title ? [{ title, done: item.done === true }] : [];
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { organizationId, projectId, data = {} } = body;
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('issue-create', authorization.user.uid, 60, 60))) {
      return NextResponse.json({ error: 'Too many issue creation requests' }, { status: 429 });
    }
    if (!projectId || typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 240) {
      return NextResponse.json({ error: 'Valid project and title are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists || projectSnap.data().organizationId !== organizationId) {
      return NextResponse.json({ error: 'Project does not belong to this organization' }, { status: 400 });
    }

    const assigneeIds = Array.isArray(data.assigneeIds) ? [...new Set(data.assigneeIds)].slice(0, 20) : [];
    if (assigneeIds.length) {
      const refs = assigneeIds.map(uid => db.collection('orgMemberships').doc(`${organizationId}_${uid}`));
      const memberships = await db.getAll(...refs);
      if (memberships.some((snap, index) => !snap.exists || snap.data().userId !== assigneeIds[index])) {
        return NextResponse.json({ error: 'An assignee is not an organization member' }, { status: 400 });
      }
    }

    if (data.sprintId) {
      const sprintSnap = await db.collection('sprints').doc(data.sprintId).get();
      if (!sprintSnap.exists || sprintSnap.data().organizationId !== organizationId || sprintSnap.data().status === 'completed') {
        return NextResponse.json({ error: 'Invalid sprint' }, { status: 400 });
      }
    }

    if (data.parentEpicId) {
      const parentSnap = await db.collection('issues').doc(data.parentEpicId).get();
      const parent = parentSnap.data();
      if (!parentSnap.exists || parent.organizationId !== organizationId || parent.projectId !== projectId || parent.type !== 'epic') {
        return NextResponse.json({ error: 'Invalid parent epic' }, { status: 400 });
      }
    }

    const dueDate = normalizedDate(data.dueDate);
    if (dueDate === undefined) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    const workflowSnap = await db.collection('organizations').doc(organizationId)
      .collection('settings').doc('workflow').get();
    const workflow = workflowSnap.data() || {};
    const statusIds = (workflow.statuses?.length ? workflow.statuses.map(item => item.id) : DEFAULT_STATUSES);
    const priorityIds = new Set(workflow.priorities?.length ? workflow.priorities.map(item => item.id) : DEFAULT_PRIORITIES);
    const typeIds = new Set(workflow.types?.length ? workflow.types.map(item => item.id) : DEFAULT_TYPES);
    const labelIds = new Set(workflow.labels?.length ? workflow.labels.map(item => item.id) : DEFAULT_LABELS);
    const doneIds = terminalStatusIds(workflow);
    const status = typeof data.status === 'string' ? data.status : statusIds[0];
    if (!statusIds.includes(status)) {
      return NextResponse.json({ error: 'Invalid workflow status' }, { status: 400 });
    }
    const issueRef = db.collection('issues').doc();
    let issueKey;

    await db.runTransaction(async transaction => {
      const freshProjectSnap = await transaction.get(projectRef);
      if (!freshProjectSnap.exists || freshProjectSnap.data().organizationId !== organizationId) {
        throw new Error('PROJECT_NOT_FOUND');
      }
      const project = freshProjectSnap.data();
      const next = (project.issueCounter || 0) + 1;
      issueKey = `${projectPrefix(project)}-${next}`;
      const now = admin.firestore.FieldValue.serverTimestamp();
      const payload = {
        issueKey,
        organizationId,
        projectId,
        title: data.title.trim(),
        description: typeof data.description === 'string' ? data.description.slice(0, 50_000) : '',
        columnId: status,
        status,
        priority: priorityIds.has(data.priority) ? data.priority : (priorityIds.has('medium') ? 'medium' : [...priorityIds][0]),
        type: typeIds.has(data.type) ? data.type : (typeIds.has('task') ? 'task' : [...typeIds][0]),
        assigneeIds,
        labelIds: Array.isArray(data.labelIds) ? data.labelIds.filter(id => labelIds.has(id)).slice(0, 20) : [],
        dueDate,
        sprintId: data.sprintId || null,
        reporterId: authorization.user.uid,
        estimateMinutes: Number.isFinite(data.estimateMinutes) ? Math.max(0, data.estimateMinutes) : null,
        parentEpicId: data.parentEpicId || null,
        subtasks: normalizedSubtasks(data.subtasks),
        watcherIds: [],
        order: next,
        createdBy: authorization.user.uid,
        createdAt: now,
        updatedAt: now,
        ...(doneIds.includes(status) ? { completedAt: now } : {}),
      };
      transaction.create(issueRef, payload);
      transaction.update(projectRef, { issueCounter: next, updatedAt: now });
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
    console.error('[Issue POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
