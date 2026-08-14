import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { DEFAULT_STATUS_IDS, workflowIds } from '@/lib/utils/workflowDefaults.mjs';
import {
  suggestAvailableIssuePrefix,
} from '@/lib/utils/issueKeys.mjs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, description, visibility, organizationId, team = [], hiddenColumns = [] } = body;

    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    if (
      !normalizedName
      || normalizedName.length > 160
      || normalizedDescription.length > 10_000
      || !organizationId
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const authorization = await authorizeOrgRequest(req, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('project-create', authorization.user.uid, 10, 60))) {
      return NextResponse.json({ error: 'Too many project creation requests' }, { status: 429 });
    }

    const userId = authorization.user.uid;
    const db = getAdminDb();
    const workflowSnap = await db.collection('organizations').doc(organizationId)
      .collection('settings').doc('workflow').get();
    const statusIds = workflowIds(workflowSnap.data()?.statuses, DEFAULT_STATUS_IDS);
    const backlogStatusId = statusIds.includes('backlog') ? 'backlog' : statusIds[0];
    const requestedHidden = Array.isArray(hiddenColumns)
      ? [...new Set(hiddenColumns.filter(value => typeof value === 'string'))]
      : [];
    if (
      requestedHidden.some(statusId => !statusIds.includes(statusId))
      || requestedHidden.includes(backlogStatusId)
      || requestedHidden.length >= statusIds.length
    ) {
      return NextResponse.json({ error: 'Некоректна конфігурація колонок' }, { status: 400 });
    }
    const requestedTeam = [...new Set(
      (Array.isArray(team) ? team : [])
        .filter(memberId => typeof memberId === 'string' && memberId.trim())
        .map(memberId => memberId.trim())
    )].slice(0, 100);
    const memberRefs = requestedTeam.map(memberId =>
      db.collection('organizations').doc(organizationId).collection('members').doc(memberId)
    );
    const memberSnaps = memberRefs.length ? await db.getAll(...memberRefs) : [];
    const validTeam = memberSnaps.filter(snapshot => snapshot.exists).map(snapshot => snapshot.id);

    const orgRef = db.collection('organizations').doc(organizationId);
    const projectRef = db.collection('projects').doc();
    const payload = {
      name: normalizedName,
      description: normalizedDescription,
      visibility: visibility === 'shared' ? 'shared' : 'internal',
      organizationId,
      team: [...new Set([userId, ...validTeam])],
      hiddenColumns: requestedHidden,
      status: 'active',
      stagesCount: 4,
      issueCounter: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId,
    };
    
    const stageNames = ['Брифінг & Аналіз', 'Дизайн & UI/UX', 'Розробка', 'Тестування & Реліз'];
    await db.runTransaction(async transaction => {
      const orgSnap = await transaction.get(orgRef);
      if (!orgSnap.exists) throw new Error('ORGANIZATION_NOT_FOUND');

      // Reading and then updating the org document serializes concurrent project
      // creations. A retried transaction sees the project created by the winner.
      const organizationProjectsQuery = db.collection('projects')
        .where('organizationId', '==', organizationId);
      const organizationProjectsSnap = await transaction.get(organizationProjectsQuery);
      const organizationProjects = organizationProjectsSnap.docs.map(document => ({
        id: document.id,
        ...document.data(),
      }));
      const issuePrefix = suggestAvailableIssuePrefix(
        { name: normalizedName },
        organizationProjects,
      );
      const activeProjectsCount = organizationProjects
        .filter(project => project.status === 'active').length;
      if ((orgSnap.data().plan || 'free') !== 'pro' && activeProjectsCount >= 3) {
        throw new Error('PROJECT_LIMIT_REACHED');
      }

      transaction.create(projectRef, { ...payload, issuePrefix });
      stageNames.forEach((stageName, index) => {
        transaction.create(db.collection('stages').doc(), {
          label: `${String(index + 1).padStart(2, '0')}. ${stageName}`,
          status: index === 0 ? 'in-progress' : 'todo',
          projectId: projectRef.id,
          order: index,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      transaction.update(orgRef, {
        projectMutationVersion: FieldValue.increment(1),
      });
    });
    
    return NextResponse.json({ success: true, id: projectRef.id });
  } catch (error) {
    if (error.message === 'PROJECT_LIMIT_REACHED') {
      return NextResponse.json({ error: 'Ліміт проєктів вичерпано. Перейдіть на Pro план.' }, { status: 403 });
    }
    if (error.message === 'ORGANIZATION_NOT_FOUND') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    return routeErrorResponse(error, { context: 'API Projects Create', fallbackMessage: 'Internal Server Error' });
  }
}
