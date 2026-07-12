import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';

async function loadAuthorizedProject(request, projectId) {
  const db = getAdminDb();
  const ref = db.collection('projects').doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Project not found', status: 404 };
  const project = snap.data();
  const authorization = await authorizeOrgRequest(request, project.organizationId, ['owner', 'admin']);
  if (authorization.error) return authorization;
  return { db, ref, project, authorization };
}

export async function PATCH(request, context) {
  try {
    const { projectId } = await context.params;
    const loaded = await loadAuthorizedProject(request, projectId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { action } = await request.json();
    if (!['archive', 'restore'].includes(action)) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const { db, ref, project } = loaded;
    const orgRef = db.collection('organizations').doc(project.organizationId);
    await db.runTransaction(async transaction => {
      const [freshProject, orgSnap] = await Promise.all([transaction.get(ref), transaction.get(orgRef)]);
      if (!freshProject.exists || !orgSnap.exists) throw new Error('NOT_FOUND');
      if (action === 'restore' && freshProject.data().status !== 'active' && (orgSnap.data().plan || 'free') !== 'pro') {
        const activeQuery = db.collection('projects')
          .where('organizationId', '==', project.organizationId)
          .where('status', '==', 'active');
        const activeSnap = await transaction.get(activeQuery);
        if (activeSnap.size >= 3) throw new Error('PROJECT_LIMIT_REACHED');
      }
      transaction.update(ref, {
        status: action === 'archive' ? 'archived' : 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(orgRef, { projectMutationVersion: admin.firestore.FieldValue.increment(1) });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message === 'PROJECT_LIMIT_REACHED') {
      return NextResponse.json({ error: 'Ліміт активних проєктів вичерпано' }, { status: 403 });
    }
    console.error('[Project PATCH]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const { projectId } = await context.params;
    const loaded = await loadAuthorizedProject(request, projectId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { db, ref, project } = loaded;

    const [issues, stages, timeLogs, invoices, orgLinks] = await Promise.all([
      db.collection('issues').where('organizationId', '==', project.organizationId).where('projectId', '==', projectId).get(),
      db.collection('stages').where('projectId', '==', projectId).get(),
      db.collection('timeLogs').where('organizationId', '==', project.organizationId).where('projectId', '==', projectId).get(),
      db.collection('invoices').where('organizationId', '==', project.organizationId).where('projectId', '==', projectId).get(),
      db.collection('issueLinks').where('organizationId', '==', project.organizationId).get(),
    ]);
    const issueIds = new Set(issues.docs.map(document => document.id));
    const simpleRefs = [
      ...timeLogs.docs.map(document => document.ref),
      ...invoices.docs.map(document => document.ref),
      ...orgLinks.docs
        .filter(document => issueIds.has(document.data().sourceIssueId) || issueIds.has(document.data().targetIssueId))
        .map(document => document.ref),
    ];
    for (let offset = 0; offset < simpleRefs.length; offset += 400) {
      const batch = db.batch();
      simpleRefs.slice(offset, offset + 400).forEach(documentRef => batch.delete(documentRef));
      await batch.commit();
    }
    for (const issue of issues.docs) await db.recursiveDelete(issue.ref);
    for (const stage of stages.docs) await db.recursiveDelete(stage.ref);

    await db.collection('organizations').doc(project.organizationId).update({
      projectMutationVersion: admin.firestore.FieldValue.increment(1),
    });
    await db.recursiveDelete(ref);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Project DELETE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
