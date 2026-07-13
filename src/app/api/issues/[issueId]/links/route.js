import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

const INVERSE = {
  blocks: 'is-blocked-by',
  'is-blocked-by': 'blocks',
  duplicates: 'duplicates',
  'relates-to': 'relates-to',
  'subtask-of': 'subtask-of',
};

function serialize(document) {
  const data = document.data();
  return {
    id: document.id,
    ...data,
    createdAt: data.createdAt?.toDate?.().toISOString() || null,
  };
}

async function loadIssueAndAuthorization(request, issueId) {
  const db = getAdminDb();
  const issueSnap = await db.collection('issues').doc(issueId).get();
  if (!issueSnap.exists) return { error: 'Issue not found', status: 404 };
  const issue = issueSnap.data();
  const authorization = await authorizeOrgRequest(request, issue.organizationId);
  if (authorization.error) return authorization;
  return { db, issue, authorization };
}

export async function GET(request, context) {
  try {
    const { issueId } = await context.params;
    const loaded = await loadIssueAndAuthorization(request, issueId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { db, issue } = loaded;
    const links = db.collection('issueLinks');
    const [source, target] = await Promise.all([
      links.where('sourceIssueId', '==', issueId).get(),
      links.where('targetIssueId', '==', issueId).get(),
    ]);
    const unique = new Map([...source.docs, ...target.docs]
      .filter(document => document.data().organizationId === issue.organizationId)
      .map(document => [document.id, serialize(document)]));
    return NextResponse.json({ links: [...unique.values()] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, { context: 'Issue links GET', fallbackMessage: 'Failed to load issue links' });
  }
}

export async function POST(request, context) {
  try {
    const { issueId } = await context.params;
    const loaded = await loadIssueAndAuthorization(request, issueId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { db, issue, authorization } = loaded;
    const { targetIssueId, relationType } = await request.json();
    if (!targetIssueId || targetIssueId === issueId || !INVERSE[relationType]) {
      return NextResponse.json({ error: 'Invalid issue relation' }, { status: 400 });
    }

    const targetSnap = await db.collection('issues').doc(targetIssueId).get();
    if (!targetSnap.exists || targetSnap.data().organizationId !== issue.organizationId) {
      return NextResponse.json({ error: 'Target issue not found' }, { status: 404 });
    }

    const links = db.collection('issueLinks');
    const [direct, inverse] = await Promise.all([
      links.where('sourceIssueId', '==', issueId).get(),
      links.where('sourceIssueId', '==', targetIssueId).get(),
    ]);
    const duplicateExists = direct.docs.some(document => document.data().organizationId === issue.organizationId && document.data().targetIssueId === targetIssueId)
      || inverse.docs.some(document => document.data().organizationId === issue.organizationId && document.data().targetIssueId === issueId);
    if (duplicateExists) {
      return NextResponse.json({ error: "Зв'язок між цими завданнями вже існує" }, { status: 409 });
    }

    const base = {
      organizationId: issue.organizationId,
      createdBy: authorization.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    batch.create(links.doc(), { ...base, sourceIssueId: issueId, targetIssueId, relationType });
    batch.create(links.doc(), { ...base, sourceIssueId: targetIssueId, targetIssueId: issueId, relationType: INVERSE[relationType] });
    await batch.commit();
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, { context: 'Issue links POST', fallbackMessage: 'Failed to create issue link' });
  }
}

export async function DELETE(request, context) {
  try {
    const { issueId } = await context.params;
    const loaded = await loadIssueAndAuthorization(request, issueId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    const { db, issue } = loaded;
    const { linkId } = await request.json();
    const linkSnap = await db.collection('issueLinks').doc(linkId).get();
    if (!linkSnap.exists) return NextResponse.json({ success: true });
    const link = linkSnap.data();
    if (link.organizationId !== issue.organizationId || ![link.sourceIssueId, link.targetIssueId].includes(issueId)) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const links = db.collection('issueLinks');
    const [forward, reverse] = await Promise.all([
      links.where('sourceIssueId', '==', link.sourceIssueId).get(),
      links.where('sourceIssueId', '==', link.targetIssueId).get(),
    ]);
    const batch = db.batch();
    [...forward.docs, ...reverse.docs]
      .filter(document => {
        const data = document.data();
        return data.organizationId === issue.organizationId
          && ((data.sourceIssueId === link.sourceIssueId && data.targetIssueId === link.targetIssueId)
            || (data.sourceIssueId === link.targetIssueId && data.targetIssueId === link.sourceIssueId));
      })
      .forEach(document => batch.delete(document.ref));
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, { context: 'Issue links DELETE', fallbackMessage: 'Failed to remove issue link' });
  }
}
