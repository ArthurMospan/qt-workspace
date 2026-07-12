import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';

function scoreIssue(issue, term) {
  const key = (issue.issueKey || '').toLowerCase();
  const title = (issue.title || '').toLowerCase();
  const description = (issue.description || '').toLowerCase();
  const projectId = (issue.projectId || '').toLowerCase();
  if (key === term) return 100;
  if (key.startsWith(term)) return 80;
  if (title.startsWith(term)) return 60;
  if (key.includes(term)) return 50;
  if (title.includes(term)) return 40;
  if (projectId.includes(term)) return 30;
  if (description.includes(term)) return 20;
  return 0;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || '';
    const term = (searchParams.get('q') || '').trim().toLowerCase().slice(0, 100);
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    if (term.length < 2) return NextResponse.json({ results: [] });
    if (!(await enforceRateLimit('search', authorization.user.uid, 60, 60))) {
      return NextResponse.json({ error: 'Too many search requests' }, { status: 429 });
    }

    const snap = await getAdminDb().collection('issues')
      .where('organizationId', '==', organizationId)
      .select('issueKey', 'title', 'description', 'projectId', 'type', 'assigneeIds', 'createdAt')
      .get();
    const results = snap.docs
      .map(item => {
        const issue = item.data();
        return { id: item.id, ...issue, score: scoreIssue(issue, term) };
      })
      .filter(issue => issue.score > 0)
      .sort((a, b) => b.score - a.score || (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 50)
      .map(issue => ({
        id: issue.id,
        issueKey: issue.issueKey || '',
        title: issue.title || '',
        projectId: issue.projectId || '',
        type: issue.type || 'task',
        assigneeIds: Array.isArray(issue.assigneeIds) ? issue.assigneeIds : [],
      }));

    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[search]', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
