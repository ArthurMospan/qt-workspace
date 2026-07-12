import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';

export async function DELETE(request, context) {
  try {
    const { issueId } = await context.params;
    const db = getAdminDb();
    const issueRef = db.collection('issues').doc(issueId);
    const issueSnap = await issueRef.get();
    if (!issueSnap.exists) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const issue = issueSnap.data();
    const authorization = await authorizeOrgRequest(request, issue.organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const [sourceLinks, targetLinks, timeLogs] = await Promise.all([
      db.collection('issueLinks').where('organizationId', '==', issue.organizationId).where('sourceIssueId', '==', issueId).get(),
      db.collection('issueLinks').where('organizationId', '==', issue.organizationId).where('targetIssueId', '==', issueId).get(),
      db.collection('timeLogs').where('organizationId', '==', issue.organizationId).where('issueId', '==', issueId).get(),
    ]);

    const relatedRefs = new Map();
    [...sourceLinks.docs, ...targetLinks.docs, ...timeLogs.docs].forEach(document => {
      relatedRefs.set(document.ref.path, document.ref);
    });
    const refs = [...relatedRefs.values()];
    for (let offset = 0; offset < refs.length; offset += 400) {
      const batch = db.batch();
      refs.slice(offset, offset + 400).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // recursiveDelete removes comments/audit subcollections as well as the issue.
    await db.recursiveDelete(issueRef);
    if (issue.projectId) {
      await db.collection('projects').doc(issue.projectId).update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Issue DELETE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
