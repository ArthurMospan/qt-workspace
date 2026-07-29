import 'server-only';

import { admin, getAdminDb } from '@/lib/server/firebaseAdmin';
import { deliverEmail } from '@/lib/server/email';
import { deliverTelegramNotification } from '@/lib/server/telegram';
import { generateEmailTemplate } from '@/lib/utils/sendEmail';
import { shouldDeliver } from '@/lib/utils/notificationChannels.mjs';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';
import {
  calendarReminderCandidates,
  dayKeyInTimeZone,
  deadlineReminderCandidates,
} from '@/lib/utils/reminderCandidates.mjs';
import { resolveDoneStatusIds } from '@/lib/utils/workflowDefaults.mjs';

const DELIVERY_CONCURRENCY = 10;

async function mapWithConcurrency(values, concurrency, task) {
  const results = new Array(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await task(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function loadRecipientContext(candidates) {
  const db = getAdminDb();
  const userIds = [...new Set(candidates.map(candidate => candidate.userId).filter(Boolean))];
  const membershipKeys = [...new Set(candidates
    .filter(candidate => candidate.organizationId && candidate.userId)
    .map(candidate => `${candidate.organizationId}_${candidate.userId}`))];
  if (!userIds.length) {
    return { memberships: new Map(), preferences: new Map(), profiles: new Map() };
  }

  const [membershipSnapshots, preferenceSnapshots, profileSnapshots] = await Promise.all([
    membershipKeys.length
      ? db.getAll(...membershipKeys.map(key => db.collection('orgMemberships').doc(key)))
      : [],
    db.getAll(...userIds.map(uid =>
      db.collection('users').doc(uid).collection('settings').doc('notifications'))),
    db.getAll(...userIds.map(uid => db.collection('users').doc(uid))),
  ]);

  return {
    memberships: new Map(membershipKeys.map((key, index) => [
      key,
      membershipSnapshots[index]?.exists ? membershipSnapshots[index].data() : null,
    ])),
    preferences: new Map(userIds.map((uid, index) => [
      uid,
      preferenceSnapshots[index]?.exists ? preferenceSnapshots[index].data() : {},
    ])),
    profiles: new Map(userIds.map((uid, index) => [
      uid,
      profileSnapshots[index]?.exists ? profileSnapshots[index].data() : {},
    ])),
  };
}

async function claimAndDeliver(candidate, context, { allowEmail = true } = {}) {
  const membership = context.memberships.get(`${candidate.organizationId}_${candidate.userId}`);
  if (
    !membership ||
    membership.orgId !== candidate.organizationId ||
    membership.userId !== candidate.userId
  ) {
    return { claimed: 0, email: 0, telegram: 0 };
  }

  const preferences = context.preferences.get(candidate.userId) || {};
  const profile = context.profiles.get(candidate.userId) || {};
  const inapp = shouldDeliver(preferences, 'inapp', candidate.type);
  const email = allowEmail &&
    shouldDeliver(preferences, 'email', candidate.type) &&
    Boolean(profile.email);
  const telegram = shouldDeliver(preferences, 'telegram', candidate.type);
  if (!inapp && !email && !telegram) return { claimed: 0, email: 0, telegram: 0 };

  const db = getAdminDb();
  const ref = db.collection('notifications').doc(candidate.id);
  try {
    await ref.create({
      userId: candidate.userId,
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      link: candidate.link,
      issueId: candidate.issueId || '',
      projectId: candidate.projectId || '',
      organizationId: candidate.organizationId,
      ...(candidate.calendarEventId ? { calendarEventId: candidate.calendarEventId } : {}),
      actorId: candidate.actorId || 'quickteam-system',
      actorName: candidate.actorName || 'QuickTeam',
      actorAvatar: '',
      read: false,
      inapp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') {
      return { claimed: 0, email: 0, telegram: 0 };
    }
    throw error;
  }

  const [emailResult, telegramResult] = await Promise.all([
    email
      ? deliverEmail({
        to: profile.email,
        subject: candidate.title,
        html: generateEmailTemplate({
          type: candidate.type,
          title: candidate.title,
          body: candidate.body,
          link: candidate.link,
        }),
      }).then(() => 1).catch(error => {
        console.warn('[reminder-job] Email delivery failed:', error.message);
        return 0;
      })
      : 0,
    telegram
      ? deliverTelegramNotification({
        userIds: [candidate.userId],
        title: candidate.title,
        body: candidate.body,
        link: candidate.link,
        type: candidate.type,
      }).then(result => result.delivered || 0).catch(error => {
        console.warn('[reminder-job] Telegram delivery failed:', error.message);
        return 0;
      })
      : 0,
  ]);

  return { claimed: 1, email: emailResult, telegram: telegramResult };
}

function summarize(results) {
  return results.reduce(
    (summary, result) => ({
      claimed: summary.claimed + (result?.claimed || 0),
      email: summary.email + (result?.email || 0),
      telegram: summary.telegram + (result?.telegram || 0),
    }),
    { claimed: 0, email: 0, telegram: 0 },
  );
}

export async function runCalendarReminderSweep({
  nowMs = Date.now(),
  organizationId = '',
  recipientId = '',
} = {}) {
  const db = getAdminDb();
  let query = db.collection('calendarEvents');
  if (organizationId) query = query.where('organizationId', '==', organizationId);
  if (recipientId) query = query.where('participantIds', 'array-contains', recipientId);
  const snapshot = await query
    .select(
      'organizationId',
      'title',
      'startAt',
      'participantIds',
      'participantResponses',
      'reminderMinutes',
      'recurrence',
      'organizerId',
    )
    .get();
  const events = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  const candidates = calendarReminderCandidates(events, { nowMs, recipientId }).map(candidate => {
    const occurrence = new Date(candidate.occurrenceStart).toISOString();
    return {
      ...candidate,
      link: withNotificationOrganization(
        `/calendar/event/${encodeURIComponent(candidate.calendarEventId)}?occurrence=${encodeURIComponent(occurrence)}`,
        candidate.organizationId,
      ),
    };
  });
  if (!candidates.length) return { candidates: 0, claimed: 0, email: 0, telegram: 0 };

  const context = await loadRecipientContext(candidates);
  const results = await mapWithConcurrency(
    candidates,
    DELIVERY_CONCURRENCY,
    candidate => claimAndDeliver(candidate, context, { allowEmail: false }),
  );
  return { candidates: candidates.length, ...summarize(results) };
}

export async function runDeadlineReminderSweep({ nowMs = Date.now() } = {}) {
  const db = getAdminDb();
  const snapshot = await db.collection('issues')
    .where('dueDate', '<=', admin.firestore.Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000))
    .select(
      'organizationId',
      'projectId',
      'issueKey',
      'title',
      'dueDate',
      'assigneeIds',
      'columnId',
      'status',
    )
    .get();
  const issues = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  const organizationIds = [...new Set(issues.map(issue => issue.organizationId).filter(Boolean))];
  if (!organizationIds.length) return { candidates: 0, claimed: 0, email: 0, telegram: 0 };

  const [organizationSnapshots, workflowSnapshots] = await Promise.all([
    db.getAll(...organizationIds.map(id => db.collection('organizations').doc(id))),
    db.getAll(...organizationIds.map(id =>
      db.collection('organizations').doc(id).collection('settings').doc('workflow'))),
  ]);
  const doneStatusIdsByOrganization = new Map(organizationIds.map((id, index) => [
    id,
    new Set(resolveDoneStatusIds(workflowSnapshots[index]?.data()?.statuses)),
  ]));
  const timeZonesByOrganization = new Map(organizationIds.map((id, index) => [
    id,
    organizationSnapshots[index]?.data()?.timezone || 'Europe/Kyiv',
  ]));
  const candidates = deadlineReminderCandidates(issues, {
    nowMs,
    doneStatusIdsByOrganization,
    timeZonesByOrganization,
  }).map(candidate => ({
    ...candidate,
    actorId: 'quickteam-system',
    actorName: 'QuickTeam',
    link: withNotificationOrganization(
      `/${candidate.projectId}/issue/${candidate.issueId}`,
      candidate.organizationId,
    ),
  }));
  if (!candidates.length) return { candidates: 0, claimed: 0, email: 0, telegram: 0 };

  const context = await loadRecipientContext(candidates);
  const results = await mapWithConcurrency(
    candidates,
    DELIVERY_CONCURRENCY,
    candidate => claimAndDeliver(candidate, context),
  );
  return { candidates: candidates.length, ...summarize(results) };
}

function birthdayParts(nowMs, timeZone) {
  const [year, month, day] = dayKeyInTimeZone(nowMs, timeZone).split('-');
  return { year, month, day };
}

async function runOrganizationBirthdaySweep(organizationId, timeZone, nowMs) {
  const db = getAdminDb();
  const today = birthdayParts(nowMs, timeZone);
  const claimRef = db.collection('organizations').doc(organizationId)
    .collection('settings').doc(`birthdaySweep_${today.year}_${today.month}_${today.day}`);
  try {
    await claimRef.create({ claimedAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') return 0;
    throw error;
  }

  const membershipsSnapshot = await db.collection('orgMemberships')
    .where('orgId', '==', organizationId)
    .get();
  const memberships = membershipsSnapshot.docs.map(document => document.data());
  if (!memberships.length) return 0;
  const profiles = await db.getAll(...memberships.map(membership =>
    db.collection('users').doc(membership.userId)));
  let created = 0;

  await mapWithConcurrency(memberships, DELIVERY_CONCURRENCY, async (membership, index) => {
    const profile = profiles[index]?.exists ? profiles[index].data() : {};
    const birthday = typeof profile.birthday === 'string'
      ? profile.birthday
      : typeof profile.profile?.birthday === 'string'
        ? profile.profile.birthday
        : '';
    if (birthday.slice(5) !== `${today.month}-${today.day}`) return;

    const greetingId = `birthday_${today.year}_${today.month}_${today.day}_${membership.userId}`;
    const messageRef = db.collection('organizations').doc(organizationId)
      .collection('channels').doc('general').collection('messages').doc(greetingId);
    try {
      const name = profile.name || profile.email || 'нашого колеги';
      const text = `🎉 Сьогодні день народження у ${name}! Вітаємо, бажаємо натхнення, крутих результатів і чудового року попереду!`;
      await messageRef.create({
        text,
        attachments: [],
        senderId: 'quickteam-system',
        user: 'QuickTeam',
        avatar: null,
        system: true,
        type: 'birthday',
        birthdayUserId: membership.userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readBy: [],
      });
      await db.collection('organizations').doc(organizationId).collection('channels').doc('general').set({
        name: 'general',
        type: 'public',
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageText: text.slice(0, 80),
        lastMessageSender: 'QuickTeam',
        lastMessageSenderId: 'quickteam-system',
        messageCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true });
      created += 1;
    } catch (error) {
      if (error.code !== 6 && error.code !== 'already-exists') throw error;
    }
  });

  return created;
}

export async function runBirthdaySweep({ nowMs = Date.now(), organizationId = '' } = {}) {
  const db = getAdminDb();
  const snapshots = organizationId
    ? [await db.collection('organizations').doc(organizationId).get()]
    : (await db.collection('organizations').select('timezone').get()).docs;
  const organizations = snapshots
    .filter(snapshot => snapshot.exists)
    .map(snapshot => ({
      id: snapshot.id,
      timeZone: snapshot.data()?.timezone || 'Europe/Kyiv',
    }));
  const counts = await mapWithConcurrency(
    organizations,
    DELIVERY_CONCURRENCY,
    organization => runOrganizationBirthdaySweep(organization.id, organization.timeZone, nowMs),
  );
  return { created: counts.reduce((total, count) => total + (count || 0), 0) };
}

export async function runScheduledNotificationSweep({ nowMs = Date.now() } = {}) {
  const [calendar, deadlines, birthdays] = await Promise.all([
    runCalendarReminderSweep({ nowMs }),
    runDeadlineReminderSweep({ nowMs }),
    runBirthdaySweep({ nowMs }),
  ]);
  return { calendar, deadlines, birthdays };
}
