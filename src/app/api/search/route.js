import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

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

    const db = getAdminDb();
    // Search must honour the same per-project access model as the rest of the
    // app: a plain member could previously find the titles of tasks in projects
    // they are not on and cannot open. Owners/admins still see everything.
    const isPrivileged = ['owner', 'admin'].includes(authorization.membership?.role);
    const [snap, projectsSnapshot] = await Promise.all([
      db.collection('issues')
        .where('organizationId', '==', organizationId)
        .select('issueKey', 'title', 'description', 'projectId', 'type', 'assigneeIds', 'createdAt')
        .get(),
      isPrivileged
        ? Promise.resolve(null)
        : db.collection('projects')
          .where('organizationId', '==', organizationId)
          .where('team', 'array-contains', authorization.user.uid)
          .select()
          .get(),
    ]);
    const visibleProjectIds = projectsSnapshot
      ? new Set(projectsSnapshot.docs.map(document => document.id))
      : null;

    const results = snap.docs
      .map(item => {
        const issue = item.data();
        return { id: item.id, ...issue, score: scoreIssue(issue, term) };
      })
      .filter(issue => issue.score > 0)
      .filter(issue => !visibleProjectIds || visibleProjectIds.has(issue.projectId))
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
    return routeErrorResponse(error, { context: 'search', fallbackMessage: 'Search failed' });
  }
}
