import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, description, visibility, organizationId } = body;

    if (!name || !organizationId) {
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

    const orgRef = db.collection('organizations').doc(organizationId);
    const projectRef = db.collection('projects').doc();
    const payload = {
      name: name.trim(),
      description: description ? description.trim() : '',
      visibility: visibility === 'shared' ? 'shared' : 'internal',
      organizationId,
      team: [userId],
      status: 'active',
      stagesCount: 4,
      issueCounter: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    };
    
    const stageNames = ['Брифінг & Аналіз', 'Дизайн & UI/UX', 'Розробка', 'Тестування & Реліз'];
    await db.runTransaction(async transaction => {
      const orgSnap = await transaction.get(orgRef);
      if (!orgSnap.exists) throw new Error('ORGANIZATION_NOT_FOUND');

      // Reading and then updating the org document serializes concurrent project
      // creations. A retried transaction sees the project created by the winner.
      const activeProjectsQuery = db.collection('projects')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'active');
      const activeProjectsSnap = await transaction.get(activeProjectsQuery);
      if ((orgSnap.data().plan || 'free') !== 'pro' && activeProjectsSnap.size >= 3) {
        throw new Error('PROJECT_LIMIT_REACHED');
      }

      transaction.create(projectRef, payload);
      stageNames.forEach((stageName, index) => {
        transaction.create(db.collection('stages').doc(), {
          label: `${String(index + 1).padStart(2, '0')}. ${stageName}`,
          status: index === 0 ? 'in-progress' : 'todo',
          projectId: projectRef.id,
          order: index,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      transaction.update(orgRef, {
        projectMutationVersion: admin.firestore.FieldValue.increment(1),
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
    console.error('[API Projects Create Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
