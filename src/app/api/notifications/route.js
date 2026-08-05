import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { generateEmailTemplate } from '@/lib/utils/sendEmail';
import { deliverEmail } from '@/lib/server/email';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';
import { deliverTelegramNotification } from '@/lib/server/telegram';
import { shouldDeliver } from '@/lib/utils/notificationChannels.mjs';

const ALLOWED_TYPES = new Set(['assigned', 'commented', 'status_changed', 'mentioned', 'deadline', 'chat_message', 'alert', 'emergency', 'calendar_invite', 'calendar_changed', 'calendar_reminder', 'test']);
const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

// Delivery (provider choice, no-op without keys) lives in lib/server/email.
async function sendEmail({ email, type, title, body, link }) {
  if (!email) return;
  await deliverEmail({
    to: email,
    subject: title,
    html: generateEmailTemplate({ type, title, body, link }),
  });
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

    // Nobody is told about their own action. Every caller already filters the
    // actor out of its audience, which means the guarantee rested on nine call
    // sites all remembering to — so it is made here, once, where the actor is
    // known for certain from the verified token. `test` is the one type that is
    // addressed to yourself on purpose.
    const audienceIds = type === 'test'
      ? userIds
      : userIds.filter(uid => uid !== authorization.user.uid);
    if (!audienceIds.length) return NextResponse.json({ delivered: 0, recipients: 0 });

    // A recipient who is no longer a member is dropped, not fatal. This used to
    // reject the whole request, so a single stale id — the external reporter an
    // imported task carries, a person who has since left — silenced the
    // notification for everyone else on the task too.
    const membershipSnaps = await db.getAll(...audienceIds.map(uid => db.collection('orgMemberships').doc(`${organizationId}_${uid}`)));
    const userIdsToNotify = audienceIds.filter((uid, index) => membershipSnaps[index].exists &&
      membershipSnaps[index].data().orgId === organizationId && membershipSnaps[index].data().userId === uid);
    if (!userIdsToNotify.length) {
      return NextResponse.json({ error: 'No recipient is an organization member' }, { status: 403 });
    }

    const [settingsSnaps, profileSnaps, senderSnap] = await Promise.all([
      db.getAll(...userIdsToNotify.map(uid => db.collection('users').doc(uid).collection('settings').doc('notifications'))),
      db.getAll(...userIdsToNotify.map(uid => db.collection('users').doc(uid))),
      db.collection('users').doc(authorization.user.uid).get(),
    ]);
    const sender = senderSnap.exists ? senderSnap.data() : {};
    // Each channel decides for itself. Previously one set of switches gated the
    // notification record and the other channels rode along on it, so muting an
    // event in the bell also silenced the email and the Telegram message — the
    // three are independent columns now.
    const recipients = userIdsToNotify.map((userId, index) => ({
      userId,
      prefs: settingsSnaps[index].exists ? settingsSnaps[index].data() : {},
      profile: profileSnaps[index].exists ? profileSnaps[index].data() : {},
    }));
    const audienceFor = channel => recipients.filter(item => shouldDeliver(item.prefs, channel, type));
    const inappAudience = audienceFor('inapp');
    const emailAudience = audienceFor('email');
    const telegramAudience = audienceFor('telegram');
    const reached = new Set([...inappAudience, ...emailAudience, ...telegramAudience].map(item => item.userId));

    const notificationData = (delivery, { inapp }) => ({
        userId: delivery.userId, type, title, body, link: scopedLink, issueId, projectId, organizationId,
        actorId: authorization.user.uid,
        actorName: sender.name || authorization.user.name || '',
        actorAvatar: sender.avatar || sender.photoURL || authorization.user.picture || '',
        read: false,
        // False when this recipient asked for the event on another channel only.
        // The document still has to exist as the dedupe claim below; the bell
        // filters it out.
        inapp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // One claim per recipient, covering every channel. The notification document
    // doubles as the "already told them" marker, so a repeated poll — the daily
    // deadline sweep is the real case — must not resend the email or the
    // Telegram message either. Claiming only for the bell would have let both
    // external channels fire on every pass for anyone who muted the bell.
    let delivered = reached;
    if (dedupeKey) {
      const claimants = recipients.filter(item => reached.has(item.userId));
      const claimResults = await Promise.all(claimants.map(async item => {
        const ref = db.collection('notifications').doc(`${dedupeKey}_${item.userId}`);
        try {
          await ref.create(notificationData(item, { inapp: inappAudience.includes(item) }));
          return true;
        } catch (error) {
          if (error.code === 6 || error.code === 'already-exists') return false;
          throw error;
        }
      }));
      delivered = new Set(claimants.filter((_, index) => claimResults[index]).map(item => item.userId));
    } else if (inappAudience.length) {
      const batch = db.batch();
      for (const delivery of inappAudience) {
        batch.set(db.collection('notifications').doc(), notificationData(delivery, { inapp: true }));
      }
      await batch.commit();
    }

    await Promise.allSettled(emailAudience
      .filter(item => delivered.has(item.userId))
      .map(item => sendEmail({ email: item.profile.email, type, title, body, link: scopedLink })));
    await deliverTelegramNotification({
      userIds: telegramAudience.filter(item => delivered.has(item.userId)).map(item => item.userId),
      title,
      body,
      link: scopedLink,
      type,
    }).catch(error => console.warn('[notifications] Telegram delivery failed:', error.message));

    return NextResponse.json({ delivered: delivered.size });
  } catch (error) {
    return routeErrorResponse(error, { context: 'notifications', fallbackMessage: 'Failed to send notification' });
  }
}
