import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { rolesFor } from '@/lib/utils/can';
import { localizedIssueAuthorizationMessage } from '@/lib/utils/issueApiMessages.mjs';
import { createIssueForActor, validateIssueCreationInput } from '@/lib/server/issueCreation';

export async function POST(request) {
  try {
    let body;
    try {
      body = await readJsonBody(request);
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
    const authorization = await authorizeOrgRequest(request, organizationId, rolesFor('create:issue'));
    if (authorization.error) {
      return NextResponse.json({
        error: localizedIssueAuthorizationMessage(authorization.error),
      }, { status: authorization.status });
    }
    // The body is judged before the limit is spent — see
    // `validateIssueCreationInput`, which is the same check the signed qTicket
    // transfer runs.
    const validated = validateIssueCreationInput({ projectId, data });
    // Invalid form submissions do not consume the creation budget. The limit
    // still protects every request that has a valid body and could reach the
    // project/workflow reads below: 60 attempts per user per 60 seconds.
    if (!(await enforceRateLimit('issue-create', authorization.user.uid, 60, 60))) {
      return NextResponse.json({
        error: 'Забагато запитів на створення завдань',
        code: 'RATE_LIMITED',
      }, { status: 429 });
    }

    const created = await createIssueForActor({
      organizationId,
      projectId,
      data,
      validated,
      actor: {
        uid: authorization.user.uid,
        name: authorization.user.name,
        email: authorization.user.email,
        picture: authorization.user.picture,
        role: authorization.membership?.role,
      },
    });
    return NextResponse.json(created, { status: 201 });
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
