import 'server-only';

import { admin, getAdminDb } from '@/lib/server/firebaseAdmin';
import { deliverEmail } from '@/lib/server/email';
import { deliverTelegramNotification } from '@/lib/server/telegram';
import { generateEmailTemplate } from '@/lib/utils/sendEmail';
import { shouldDeliver } from '@/lib/utils/notificationChannels.mjs';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';
import {
  DEADLINE_FLOOR_MS,
  DEADLINE_HORIZON_MS,
  REMINDER_LOOKBACK_MS,
  calendarReminderCandidates,
  clampReminderLookback,
  dayKeyInTimeZone,
  deadlineReminderCandidates,
} from '@/lib/utils/reminderCandidates.mjs';
import { telegramAppLink } from '@/lib/server/telegram';
import { resolveDoneStatusIds } from '@/lib/utils/workflowDefaults.mjs';

const DELIVERY_CONCURRENCY = 10;
// The sweep's own memory of when it last ran. Server-written only; Firestore
// rules have no `system` match, so the browser cannot read or forge it.
const SWEEP_STATE_PATH = ['system', 'notificationSweep'];
// How far ahead a calendar reminder can be configured. Bounds the query that
// used to read the entire calendarEvents collection on every pass — 288 passes a
// day against a Spark project with a 50k daily read cap.
const CALENDAR_LEAD_MS = 8 * 24 * 60 * 60 * 1000;
const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

function sweepStateRef() {
  const db = getAdminDb();
  return db.collection(SWEEP_STATE_PATH[0]).doc(SWEEP_STATE_PATH[1]);
}

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
    return { claimed: 0, email: 0, telegram: null };
  }

  const preferences = context.preferences.get(candidate.userId) || {};
  const profile = context.profiles.get(candidate.userId) || {};
  const inapp = shouldDeliver(preferences, 'inapp', candidate.type);
  const email = allowEmail &&
    shouldDeliver(preferences, 'email', candidate.type) &&
    Boolean(profile.email);
  const telegram = shouldDeliver(preferences, 'telegram', candidate.type);
  if (!inapp && !email && !telegram) return { claimed: 0, email: 0, telegram: null };

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
      return { claimed: 0, email: 0, telegram: null };
    }
    throw error;
  }

  const emailResult = email
    ? await deliverEmail({
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
    : 0;

  // Telegram is not sent here. A sweep that has been waiting three hours for the
  // scheduler routinely claims several reminders for one person at once, and
  // sending each on its own turned "you have things to look at" into six
  // near-identical pings. The claimed items are handed back and delivered as one
  // digest per recipient below.
  return {
    claimed: 1,
    email: emailResult,
    telegram: telegram
      ? {
        userId: candidate.userId,
        type: candidate.type,
        title: candidate.title,
        body: candidate.body,
        url: telegramAppLink(candidate.link),
      }
      : null,
  };
}

async function deliverTelegramDigests(results) {
  const itemsByUserId = new Map();
  for (const result of results) {
    if (!result?.telegram) continue;
    const list = itemsByUserId.get(result.telegram.userId) || [];
    list.push(result.telegram);
    itemsByUserId.set(result.telegram.userId, list);
  }
  if (!itemsByUserId.size) return 0;
  const delivery = await deliverTelegramNotification({
    userIds: [...itemsByUserId.keys()],
    itemsByUserId,
  }).catch(error => {
    console.warn('[reminder-job] Telegram delivery failed:', error.message);
    return { delivered: 0 };
  });
  return delivery.delivered || 0;
}

function summarize(results, telegramDelivered = 0) {
  return results.reduce(
    (summary, result) => ({
      claimed: summary.claimed + (result?.claimed || 0),
      email: summary.email + (result?.email || 0),
      telegram: summary.telegram,
    }),
    { claimed: 0, email: 0, telegram: telegramDelivered },
  );
}

const CALENDAR_FIELDS = [
  'organizationId',
  'title',
  'startAt',
  'participantIds',
  'participantResponses',
  'reminderMinutes',
  'recurrence',
  'organizerId',
];

// Two bounded queries instead of one unbounded scan. A one-off event only
// matters while its start is inside the reminder window; a recurring one has a
// start in the past forever, so it is fetched by its recurrence instead. Every
// event the old full scan returned is still covered, at a fraction of the reads.
//
// Only the global sweep takes this path. The authenticated diagnostic route
// already narrows to one organization and one participant — both covered by an
// existing composite index — and adding a range on top would need two more.
async function loadReminderEvents({ nowMs, lookBackMs, organizationId, recipientId }) {
  const db = getAdminDb();
  if (organizationId || recipientId) {
    let query = db.collection('calendarEvents');
    if (organizationId) query = query.where('organizationId', '==', organizationId);
    if (recipientId) query = query.where('participantIds', 'array-contains', recipientId);
    const snapshot = await query.select(...CALENDAR_FIELDS).get();
    return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  }

  const [upcoming, recurring] = await Promise.all([
    db.collection('calendarEvents')
      .where('startAt', '>=', admin.firestore.Timestamp.fromMillis(nowMs - lookBackMs))
      .where('startAt', '<=', admin.firestore.Timestamp.fromMillis(nowMs + CALENDAR_LEAD_MS))
      .select(...CALENDAR_FIELDS)
      .get(),
    db.collection('calendarEvents')
      .where('recurrence.frequency', 'in', RECURRING_FREQUENCIES)
      .select(...CALENDAR_FIELDS)
      .get(),
  ]);

  const events = new Map();
  for (const document of [...upcoming.docs, ...recurring.docs]) {
    events.set(document.id, { id: document.id, ...document.data() });
  }
  return [...events.values()];
}

export async function runCalendarReminderSweep({
  nowMs = Date.now(),
  organizationId = '',
  recipientId = '',
  lookBackMs = REMINDER_LOOKBACK_MS,
} = {}) {
  const events = await loadReminderEvents({ nowMs, lookBackMs, organizationId, recipientId });
  const candidates = calendarReminderCandidates(events, { nowMs, lookBackMs, recipientId }).map(candidate => {
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
  return { candidates: candidates.length, ...summarize(results, await deliverTelegramDigests(results)) };
}

export async function runDeadlineReminderSweep({ nowMs = Date.now() } = {}) {
  const db = getAdminDb();
  const snapshot = await db.collection('issues')
    // Bounded on both sides. Without the floor this read every issue that had
    // ever slipped its deadline, on every pass, and those issues no longer
    // produce candidates anyway.
    .where('dueDate', '>=', admin.firestore.Timestamp.fromMillis(nowMs - DEADLINE_FLOOR_MS))
    .where('dueDate', '<=', admin.firestore.Timestamp.fromMillis(nowMs + DEADLINE_HORIZON_MS))
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
  return { candidates: candidates.length, ...summarize(results, await deliverTelegramDigests(results)) };
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

// A greeting has to land on the right day, not the right minute. Scanning every
// organization on all 288 passes of a day bought nothing and cost a full
// collection read each time; every half hour still puts the greeting in the
// channel within thirty minutes of local midnight, in any timezone.
export const BIRTHDAY_SCAN_INTERVAL_MS = 30 * 60 * 1000;

export async function runBirthdaySweep({
  nowMs = Date.now(),
  organizationId = '',
  lastScanAtMs = null,
} = {}) {
  const db = getAdminDb();
  if (!organizationId && Number.isFinite(lastScanAtMs) &&
      nowMs - lastScanAtMs < BIRTHDAY_SCAN_INTERVAL_MS) {
    return { created: 0, skipped: true };
  }
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
  return {
    created: counts.reduce((total, count) => total + (count || 0), 0),
    skipped: false,
    scannedAtMs: nowMs,
  };
}

// Reads the sweep's watermark and reports how much time the next pass has to
// cover. A first run, or one whose state document was lost, gets the floor.
export async function readSweepState(nowMs) {
  const snapshot = await sweepStateRef().get().catch(() => null);
  const data = snapshot?.data() || {};
  const lastRunAt = Number(data.lastRunAtMs);
  const lastBirthdayScanAt = Number(data.lastBirthdayScanAtMs);
  const elapsedMs = Number.isFinite(lastRunAt) && lastRunAt <= nowMs
    ? nowMs - lastRunAt
    : REMINDER_LOOKBACK_MS;
  return {
    lastRunAtMs: Number.isFinite(lastRunAt) ? lastRunAt : null,
    lastBirthdayScanAtMs: Number.isFinite(lastBirthdayScanAt) ? lastBirthdayScanAt : null,
    elapsedMs,
  };
}

export async function runScheduledNotificationSweep({ nowMs = Date.now() } = {}) {
  const state = await readSweepState(nowMs);
  const lookBackMs = clampReminderLookback(state.elapsedMs);

  const [calendar, deadlines, birthdays] = await Promise.all([
    runCalendarReminderSweep({ nowMs, lookBackMs }),
    runDeadlineReminderSweep({ nowMs }),
    runBirthdaySweep({ nowMs, lastScanAtMs: state.lastBirthdayScanAtMs }),
  ]);

  // Written last and unconditionally after a successful pass: a sweep that
  // throws must not advance the watermark, or the reminders it failed to deliver
  // would fall into the gap the watermark exists to close.
  await sweepStateRef().set({
    lastRunAtMs: nowMs,
    lastRunAt: admin.firestore.Timestamp.fromMillis(nowMs),
    lookBackMs,
    previousRunAtMs: state.lastRunAtMs,
    ...(birthdays.skipped ? {} : { lastBirthdayScanAtMs: nowMs }),
    counts: {
      calendar: calendar.claimed,
      deadlines: deadlines.claimed,
      birthdays: birthdays.created,
      telegram: calendar.telegram + deadlines.telegram,
    },
  }, { merge: true }).catch(error => {
    console.warn('[reminder-job] Could not record sweep state:', error.message);
  });

  return {
    lookBackMs,
    sinceLastRunMs: state.lastRunAtMs === null ? null : nowMs - state.lastRunAtMs,
    calendar,
    deadlines,
    birthdays,
  };
}
