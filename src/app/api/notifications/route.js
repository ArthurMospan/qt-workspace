import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { generateEmailTemplate } from '@/lib/utils/sendEmail';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';

const PREF_KEY_BY_TYPE = { assigned: 'assigned', commented: 'commented', status_changed: 'statusChanged', mentioned: 'mentioned', deadline: 'deadline' };
const PREF_DEFAULTS = { assigned: true, commented: true, statusChanged: false, deadline: true, mentioned: true };
const EMAIL_TYPES = new Set(['assigned', 'mentioned', 'deadline', 'alert']);
const ALLOWED_TYPES = new Set(['assigned', 'commented', 'status_changed', 'mentioned', 'deadline', 'alert', 'test']);
const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

async function sendEmail({ email, type, title, body, link }) {
  if (!process.env.RESEND_API_KEY || !email) return;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'notifications@quickteam.com',
      to: [email],
      subject: title,
      html: generateEmailTemplate({ type, title, body, link }),
    }),
  });
  if (!response.ok) console.error('[notifications] email provider rejected request', await response.text());
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const rawUserIds = Array.isArray(payload.userIds) ? payload.userIds : [];
    if (rawUserIds.length > 50) return NextResponse.json({ error: 'Too many recipients' }, { status: 400 });
    const userIds = [...new Set(rawUserIds)].filter(uid => typeof uid === 'string' && uid.length > 0);
    const projectId = cleanText(payload.projectId, 128);
    let organizationId = cleanText(payload.organizationId, 128);
    const db = getAdminDb();
    if (projectId) {
      const projectSnap = await db.collection('projects').doc(projectId).get();
      if (!projectSnap.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const projectOrganizationId = projectSnap.data().organizationId || '';
      if (organizationId && organizationId !== projectOrganizationId) {
        return NextResponse.json({ error: 'Project does not belong to organization' }, { status: 400 });
      }
      organizationId = projectOrganizationId;
    }

    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    if (!(await enforceRateLimit('notifications', authorization.user.uid, 60, 60))) {
      return NextResponse.json({ error: 'Too many notification requests' }, { status: 429 });
    }

    const type = cleanText(payload.type, 64);
    const title = cleanText(payload.title, 200);
    const body = cleanText(payload.body, 2000);
    const link = cleanText(payload.link, 500);
    const issueId = cleanText(payload.issueId, 128);
    const dedupeKey = cleanText(payload.dedupeKey, 180);
    if (!userIds.length || !ALLOWED_TYPES.has(type) || !title || !body) return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    const scopedLink = link ? withNotificationOrganization(link, organizationId) : '';
    if (link && !scopedLink) {
      return NextResponse.json({ error: 'Invalid notification link' }, { status: 400 });
    }
    if (dedupeKey && !/^[A-Za-z0-9_-]+$/.test(dedupeKey)) return NextResponse.json({ error: 'Invalid dedupe key' }, { status: 400 });
    if (issueId) {
      const issueSnap = await db.collection('issues').doc(issueId).get();
      const issue = issueSnap.exists ? issueSnap.data() : null;
      if (!issue || issue.organizationId !== organizationId || (projectId && issue.projectId !== projectId)) {
        return NextResponse.json({ error: 'Issue does not belong to notification scope' }, { status: 400 });
      }
    }

    const membershipSnaps = await db.getAll(...userIds.map(uid => db.collection('orgMemberships').doc(`${organizationId}_${uid}`)));
    const recipientsValid = userIds.every((uid, index) => membershipSnaps[index].exists &&
      membershipSnaps[index].data().orgId === organizationId && membershipSnaps[index].data().userId === uid);
    if (!recipientsValid) return NextResponse.json({ error: 'One or more recipients are not organization members' }, { status: 403 });

    const [settingsSnaps, profileSnaps, senderSnap] = await Promise.all([
      db.getAll(...userIds.map(uid => db.collection('users').doc(uid).collection('settings').doc('notifications'))),
      db.getAll(...userIds.map(uid => db.collection('users').doc(uid))),
      db.collection('users').doc(authorization.user.uid).get(),
    ]);
    const sender = senderSnap.exists ? senderSnap.data() : {};
    const prefKey = PREF_KEY_BY_TYPE[type];
    const deliveries = userIds.map((userId, index) => {
      const prefs = settingsSnaps[index].exists ? settingsSnaps[index].data() : {};
      return {
        userId,
        prefs,
        profile: profileSnaps[index].exists ? profileSnaps[index].data() : {},
        enabled: !prefKey || (prefs[prefKey] ?? PREF_DEFAULTS[prefKey]),
      };
    }).filter(item => item.enabled);

    const notificationData = delivery => ({
        userId: delivery.userId, type, title, body, link: scopedLink, issueId, projectId, organizationId,
        actorId: authorization.user.uid,
        actorName: sender.name || authorization.user.name || '',
        actorAvatar: sender.avatar || sender.photoURL || authorization.user.picture || '',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    let createdDeliveries = deliveries;
    if (dedupeKey) {
      const creationResults = await Promise.all(deliveries.map(async delivery => {
        const ref = db.collection('notifications').doc(`${dedupeKey}_${delivery.userId}`);
        try {
          await ref.create(notificationData(delivery));
          return true;
        } catch (error) {
          if (error.code === 6 || error.code === 'already-exists') return false;
          throw error;
        }
      }));
      createdDeliveries = deliveries.filter((_, index) => creationResults[index]);
    } else if (deliveries.length) {
      const batch = db.batch();
      for (const delivery of deliveries) {
        batch.set(db.collection('notifications').doc(), notificationData(delivery));
      }
      await batch.commit();
    }
    await Promise.allSettled(createdDeliveries
      .filter(item => item.prefs.emailEnabled && EMAIL_TYPES.has(type))
      .map(item => sendEmail({ email: item.profile.email, type, title, body, link: scopedLink })));

    return NextResponse.json({ delivered: createdDeliveries.length });
  } catch (error) {
    return routeErrorResponse(error, { context: 'notifications', fallbackMessage: 'Failed to send notification' });
  }
}
