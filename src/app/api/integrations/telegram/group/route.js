import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { refuseWithoutCapability } from '@/lib/server/planLimits';
import {
  ensureTelegramWebhook,
  telegramStatus,
  telegramTokenId,
} from '@/lib/server/telegram';

function organizationIdFrom(request) {
  return new URL(request.url).searchParams.get('organizationId')?.trim() || '';
}

function groupRef(db, organizationId) {
  return db.collection('organizations').doc(organizationId).collection('private').doc('telegram');
}

// What the screen reads about the group: the link, the project it feeds, and
// what it has produced. The last four are the row that answers «а воно
// працює?» with a task instead of a status word; the webhook stamps them after
// every task it creates.
function groupView(data = {}) {
  return {
    ...telegramStatus(),
    connected: Boolean(data.chatId),
    chatTitle: data.chatTitle || '',
    defaultProjectId: data.defaultProjectId || '',
    lastIssueKey: data.lastIssueKey || '',
    lastIssueId: data.lastIssueId || '',
    lastProjectId: data.lastProjectId || '',
    lastTaskAt: data.lastTaskAt?.toDate?.().toISOString?.() || null,
    taskCount: Number(data.taskCount) || 0,
  };
}

// A project the group may feed: this organization's, and not archived.
async function activeProject(db, organizationId, projectId) {
  if (!projectId) return null;
  const project = await db.collection('projects').doc(projectId).get();
  if (!project.exists) return null;
  const data = project.data();
  if (data.organizationId !== organizationId || data.status === 'archived') return null;
  return { id: project.id, ...data };
}

export async function GET(request) {
  try {
    const organizationId = organizationIdFrom(request);
    // Any member may read which group feeds which project: a person in that
    // group needs the commands, and the screen used to draw them a form that
    // could only fail. Linking, moving and unlinking stay owner/admin.
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const snapshot = await groupRef(getAdminDb(), organizationId).get();
    return NextResponse.json(groupView(snapshot.exists ? snapshot.data() : {}));
  } catch (error) {
    return routeErrorResponse(error, { context: 'telegram group status', fallbackMessage: 'Не вдалося перевірити Telegram-групу' });
  }
}

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const status = telegramStatus();
    if (!status.configured) return NextResponse.json({ error: 'Telegram bot is not configured' }, { status: 503 });
    const refusal = await refuseWithoutCapability(getAdminDb(), organizationId, 'integrations');
    if (refusal) return refusal;
    if (!(await activeProject(getAdminDb(), organizationId, projectId))) {
      return NextResponse.json({ error: 'Оберіть активний проєкт цієї організації' }, { status: 400 });
    }

    await ensureTelegramWebhook();
    const token = randomBytes(24).toString('base64url');
    const payload = `qtg_${token}`;
    await getAdminDb().collection('telegramConnectTokens').doc(telegramTokenId(token)).set({
      type: 'organization',
      organizationId,
      projectId,
      createdBy: authorization.user.uid,
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({
      addGroupLink: `https://t.me/${status.username}?startgroup=${payload}`,
      command: `/quickteam_connect ${payload}`,
      expiresInSeconds: 1800,
    });
  } catch (error) {
    return routeErrorResponse(error, { context: 'telegram group connect', fallbackMessage: 'Не вдалося підготувати Telegram-групу' });
  }
}

// The group's project can change without re-linking.
//
// It was read-only once linked: to send the group's tasks elsewhere you had to
// disconnect the group and add the bot again. The webhook reads the project
// from the routing record, the screen from the organization's, so both move
// in one batch — two records that disagree would send a task one way and
// describe it the other.
export async function PATCH(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const db = getAdminDb();
    const ref = groupRef(db, organizationId);
    const snapshot = await ref.get();
    const current = snapshot.exists ? snapshot.data() : {};
    if (!current.chatId) return NextResponse.json({ error: 'Групу ще не підключено' }, { status: 400 });
    if (!(await activeProject(db, organizationId, projectId))) {
      return NextResponse.json({ error: 'Оберіть активний проєкт цієї організації' }, { status: 400 });
    }
    const batch = db.batch();
    batch.set(ref, { defaultProjectId: projectId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(
      db.collection('telegramChats').doc(String(current.chatId)),
      { defaultProjectId: projectId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await batch.commit();
    return NextResponse.json(groupView({ ...current, defaultProjectId: projectId }));
  } catch (error) {
    return routeErrorResponse(error, { context: 'telegram group project', fallbackMessage: 'Не вдалося змінити проєкт для Telegram-групи' });
  }
}

export async function DELETE(request) {
  try {
    const organizationId = organizationIdFrom(request);
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const db = getAdminDb();
    const ref = groupRef(db, organizationId);
    const snapshot = await ref.get();
    const batch = db.batch();
    batch.delete(ref);
    if (snapshot.exists && snapshot.data().chatId) {
      batch.delete(db.collection('telegramChats').doc(String(snapshot.data().chatId)));
    }
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, { context: 'telegram group disconnect', fallbackMessage: 'Не вдалося відключити Telegram-групу' });
  }
}
