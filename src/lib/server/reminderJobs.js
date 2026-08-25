import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import 'server-only';

import { getAdminDb } from '@/lib/server/firebaseAdmin';
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
import { dispatchDueNotifications, materialiseCandidates } from '@/lib/server/notificationOutbox';
import { MATERIALISE_LEAD_MS } from '@/lib/utils/notificationOutbox.mjs';
import { resolveClosedStatusIds } from '@/lib/utils/workflowDefaults.mjs';
import { purgeExpiredDeletedIssues } from '@/lib/server/issueTrash';
import { issuePath } from '@/lib/utils/issueKeys.mjs';

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
      createdAt: FieldValue.serverTimestamp(),
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
  'excludedOccurrenceStarts',
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
    return snapshot.docs.map(document => ({ ...document.data(), id: document.id }));
  }

  const [upcoming, recurring] = await Promise.all([
    db.collection('calendarEvents')
      .where('startAt', '>=', Timestamp.fromMillis(nowMs - lookBackMs))
      .where('startAt', '<=', Timestamp.fromMillis(nowMs + CALENDAR_LEAD_MS))
      .select(...CALENDAR_FIELDS)
      .get(),
    db.collection('calendarEvents')
      .where('recurrence.frequency', 'in', RECURRING_FREQUENCIES)
      .select(...CALENDAR_FIELDS)
      .get(),
  ]);

  const events = new Map();
  for (const document of [...upcoming.docs, ...recurring.docs]) {
    events.set(document.id, { ...document.data(), id: document.id });
  }
  return [...events.values()];
}

export async function collectCalendarCandidates({
  nowMs = Date.now(),
  lookBackMs = REMINDER_LOOKBACK_MS,
  lookAheadMs = 0,
  organizationId = '',
  recipientId = '',
} = {}) {
  const events = await loadReminderEvents({ nowMs, lookBackMs, organizationId, recipientId });
  return calendarReminderCandidates(events, { nowMs, lookBackMs, lookAheadMs, recipientId })
    .map(candidate => {
      const occurrence = new Date(candidate.occurrenceStart).toISOString();
      return {
        ...candidate,
        allowEmail: false,
        link: withNotificationOrganization(
          `/calendar/event/${encodeURIComponent(candidate.calendarEventId)}?occurrence=${encodeURIComponent(occurrence)}`,
          candidate.organizationId,
        ),
      };
    });
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

// The deadline half of materialisation: every candidate the window can see,
// with its delivery time, and no delivery.
export async function collectDeadlineCandidates({ nowMs = Date.now(), lookAheadMs = 0 } = {}) {
  const db = getAdminDb();
  const snapshot = await db.collection('issues')
    // Bounded on both sides. Without the floor this read every issue that had
    // ever slipped its deadline, on every pass, and those issues no longer
    // produce candidates anyway.
    .where('dueDate', '>=', Timestamp.fromMillis(nowMs - DEADLINE_FLOOR_MS))
    .where('dueDate', '<=', Timestamp.fromMillis(nowMs + DEADLINE_HORIZON_MS + lookAheadMs))
    .select(
      'organizationId',
      'projectId',
      'issueKey',
      'title',
      'dueDate',
      'assigneeIds',
      'columnId',
      'status',
      // Read so the candidate filter can drop tasks that were put aside. A
      // projection that omits either would silently make every archived or
      // cancelled task look active here, and go on chasing people about work
      // that is not going to happen.
      'archivedAt',
      'cancelledAt',
    )
    .get();
  const issues = snapshot.docs.map(document => ({ ...document.data(), id: document.id }));
  const organizationIds = [...new Set(issues.map(issue => issue.organizationId).filter(Boolean))];
  if (!organizationIds.length) return [];

  const [organizationSnapshots, workflowSnapshots] = await Promise.all([
    db.getAll(...organizationIds.map(id => db.collection('organizations').doc(id))),
    db.getAll(...organizationIds.map(id =>
      db.collection('organizations').doc(id).collection('settings').doc('workflow'))),
  ]);
  const closedStatusIdsByOrganization = new Map(organizationIds.map((id, index) => [
    id,
    new Set(resolveClosedStatusIds(workflowSnapshots[index]?.data()?.statuses)),
  ]));
  const timeZonesByOrganization = new Map(organizationIds.map((id, index) => [
    id,
    organizationSnapshots[index]?.data()?.timezone || 'Europe/Kyiv',
  ]));
  return deadlineReminderCandidates(issues, {
    nowMs,
    lookAheadMs,
    closedStatusIdsByOrganization,
    timeZonesByOrganization,
  }).map(candidate => ({
    ...candidate,
    actorId: 'quickteam-system',
    actorName: 'QuickTeam',
    link: withNotificationOrganization(
      issuePath({ id: candidate.issueId, issueKey: candidate.issueKey }, candidate.projectId),
      candidate.organizationId,
    ),
  }));
}

export async function runDeadlineReminderSweep({ nowMs = Date.now() } = {}) {
  const candidates = (await collectDeadlineCandidates({ nowMs }))
    .filter(candidate => Number(candidate.deliverAtMs) <= nowMs);
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

// Everyone but the birthday person gets a bell entry pointing at the greeting.
// Deterministic ids, so a re-run — the scheduled sweep after an on-demand one —
// writes the same documents rather than a second set.
async function createBirthdayNotifications({
  organizationId,
  memberIds,
  birthdayUserId,
  dayKey,
  name,
}) {
  const db = getAdminDb();
  const recipients = memberIds.filter(userId => userId && userId !== birthdayUserId);
  if (!recipients.length) return;
  const link = withNotificationOrganization('/chat', organizationId);
  const batch = db.batch();
  for (const userId of recipients) {
    batch.create(
      db.collection('notifications').doc(`birthday_${dayKey}_${birthdayUserId}_${userId}`),
      {
        userId,
        type: 'birthday',
        title: `Сьогодні день народження у ${name}`,
        body: 'Привітайте колегу в загальному чаті 🎉',
        link,
        issueId: '',
        projectId: '',
        organizationId,
        actorId: 'quickteam-system',
        actorName: 'QuickTeam',
        actorAvatar: '',
        read: false,
        inapp: true,
        createdAt: FieldValue.serverTimestamp(),
      },
    );
  }
  await batch.commit().catch(error => {
    // A batch of `create`s fails as a whole if any id already exists, which is
    // exactly what a repeat pass looks like. Nothing to repair.
    if (error.code === 6 || error.code === 'already-exists') return;
    console.warn('[reminder-job] Birthday notifications failed:', error.message);
  });
}

// `userId` narrows the scan to one person, and `force` skips the once-a-day
// claim. Both exist for the same reason: the claim is a cost control, not a
// correctness one — the greeting itself is idempotent through its document id —
// and a birthday saved *after* the day's scheduled pass had already claimed the
// day used to be silently skipped until the following year.
async function runOrganizationBirthdaySweep(
  organizationId,
  timeZone,
  nowMs,
  { userId = '', force = false } = {},
) {
  const db = getAdminDb();
  const today = birthdayParts(nowMs, timeZone);
  const dayKey = `${today.year}_${today.month}_${today.day}`;
  if (!force) {
    const claimRef = db.collection('organizations').doc(organizationId)
      .collection('settings').doc(`birthdaySweep_${dayKey}`);
    try {
      await claimRef.create({ claimedAt: FieldValue.serverTimestamp() });
    } catch (error) {
      if (error.code === 6 || error.code === 'already-exists') return 0;
      throw error;
    }
  }

  const membershipsSnapshot = await db.collection('orgMemberships')
    .where('orgId', '==', organizationId)
    .get();
  const allMemberships = membershipsSnapshot.docs.map(document => document.data());
  if (!allMemberships.length) return 0;
  const memberIds = allMemberships.map(membership => membership.userId).filter(Boolean);
  const memberships = userId
    ? allMemberships.filter(membership => membership.userId === userId)
    : allMemberships;
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

    const name = profile.name || profile.email || 'нашого колеги';
    const greetingId = `birthday_${dayKey}_${membership.userId}`;
    const messageRef = db.collection('organizations').doc(organizationId)
      .collection('channels').doc('general').collection('messages').doc(greetingId);
    try {
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
        createdAt: FieldValue.serverTimestamp(),
        readBy: [],
      });
      await db.collection('organizations').doc(organizationId).collection('channels').doc('general').set({
        name: 'general',
        type: 'public',
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessageText: text.slice(0, 80),
        lastMessageSender: 'QuickTeam',
        lastMessageSenderId: 'quickteam-system',
        messageCount: FieldValue.increment(1),
      }, { merge: true });
      created += 1;
    } catch (error) {
      if (error.code !== 6 && error.code !== 'already-exists') throw error;
      // The greeting was already posted today; the notifications below are
      // written anyway, because an earlier pass may have posted the message
      // before this half existed.
    }
    await createBirthdayNotifications({
      organizationId,
      memberIds,
      birthdayUserId: membership.userId,
      dayKey,
      name,
    });
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
  userId = '',
  force = false,
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
    organization => runOrganizationBirthdaySweep(
      organization.id,
      organization.timeZone,
      nowMs,
      { userId, force },
    ),
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
  const lastMaterialiseAt = Number(data.lastMaterialiseAtMs);
  const elapsedMs = Number.isFinite(lastRunAt) && lastRunAt <= nowMs
    ? nowMs - lastRunAt
    : REMINDER_LOOKBACK_MS;
  // Dispatch may run every minute while materialisation is driven separately.
  // Its watermark must not shorten the recovery window of the expensive half:
  // after a three-hour materialiser outage, using `lastRunAt` here silently
  // loses every reminder that became due during the outage.
  const materialiseElapsedMs = Number.isFinite(lastMaterialiseAt) && lastMaterialiseAt <= nowMs
    ? nowMs - lastMaterialiseAt
    : REMINDER_LOOKBACK_MS;
  return {
    lastRunAtMs: Number.isFinite(lastRunAt) ? lastRunAt : null,
    lastBirthdayScanAtMs: Number.isFinite(lastBirthdayScanAt) ? lastBirthdayScanAt : null,
    lastMaterialiseAtMs: Number.isFinite(lastMaterialiseAt) ? lastMaterialiseAt : null,
    elapsedMs,
    materialiseElapsedMs,
  };
}

// How often the expensive half runs. Dispatching is what decides latency, and
// it costs one indexed query; materialising is what costs a collection scan, and
// it only has to stay far enough ahead of the delivery window.
export const MATERIALISE_INTERVAL_MS = 20 * 60 * 1000;

export async function materialiseScheduledNotifications({ nowMs = Date.now(), lookBackMs } = {}) {
  const windowStartMs = nowMs - (lookBackMs ?? REMINDER_LOOKBACK_MS);
  const windowEndMs = nowMs + MATERIALISE_LEAD_MS;
  const [calendar, deadlines] = await Promise.all([
    collectCalendarCandidates({ nowMs, lookBackMs, lookAheadMs: MATERIALISE_LEAD_MS }),
    collectDeadlineCandidates({ nowMs, lookAheadMs: MATERIALISE_LEAD_MS }),
  ]);
  const result = await materialiseCandidates([...calendar, ...deadlines], {
    windowStartMs,
    windowEndMs,
    nowMs,
  });
  return { ...result, candidates: calendar.length + deadlines.length };
}

// One pass. `mode` exists so the cheap half can be driven on a tight schedule
// without dragging the expensive half along with it: a one-minute external cron
// calls it with `dispatch`, and something slower keeps the outbox stocked.
export async function runScheduledNotificationSweep({ nowMs = Date.now(), mode = 'full' } = {}) {
  const state = await readSweepState(nowMs);
  const lookBackMs = clampReminderLookback(state.materialiseElapsedMs);
  const wantsMaterialise = mode === 'full' || mode === 'materialise';
  const wantsDispatch = mode === 'full' || mode === 'dispatch';
  const materialiseDue = !Number.isFinite(state.lastMaterialiseAtMs)
    || nowMs - state.lastMaterialiseAtMs >= MATERIALISE_INTERVAL_MS;

  const materialised = wantsMaterialise && materialiseDue
    ? await materialiseScheduledNotifications({ nowMs, lookBackMs })
    : { skipped: true, created: 0, updated: 0, cancelled: 0 };

  // Dispatch after materialising, so a reminder that became due inside this very
  // pass goes out in it rather than waiting for the next one.
  const dispatched = wantsDispatch
    ? await dispatchDueNotifications({ nowMs })
    : { skipped: true, due: 0, sent: 0, failed: 0, telegram: 0, email: 0 };

  const birthdays = wantsMaterialise
    ? await runBirthdaySweep({ nowMs, lastScanAtMs: state.lastBirthdayScanAtMs })
    : { created: 0, skipped: true };

  // The same slower pass finalizes issue soft-deletes after their undo window.
  // Dispatch stays a single indexed outbox query on the every-minute schedule.
  const issueTrash = wantsMaterialise && materialiseDue
    ? await purgeExpiredDeletedIssues({ nowMs })
    : { scanned: 0, purged: 0, failed: 0, related: 0, skipped: true };

  // Written last and unconditionally after a successful pass: a sweep that
  // throws must not advance the watermark, or the reminders it failed to record
  // would fall into the gap the watermark exists to close.
  await sweepStateRef().set({
    lastRunAtMs: nowMs,
    lastRunAt: Timestamp.fromMillis(nowMs),
    lookBackMs,
    mode,
    previousRunAtMs: state.lastRunAtMs,
    ...(materialised.skipped ? {} : { lastMaterialiseAtMs: nowMs }),
    ...(birthdays.skipped ? {} : { lastBirthdayScanAtMs: nowMs }),
    counts: {
      materialised: materialised.created || 0,
      cancelled: materialised.cancelled || 0,
      sent: dispatched.sent || 0,
      failed: dispatched.failed || 0,
      telegram: dispatched.telegram || 0,
      birthdays: birthdays.created || 0,
      purgedIssues: issueTrash.purged || 0,
    },
  }, { merge: true }).catch(error => {
    console.warn('[reminder-job] Could not record sweep state:', error.message);
  });

  return {
    mode,
    lookBackMs,
    sinceLastRunMs: state.lastRunAtMs === null ? null : nowMs - state.lastRunAtMs,
    materialised,
    dispatched,
    birthdays,
    issueTrash,
  };
}
