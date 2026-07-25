import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';
import { deliverTelegramNotification } from '@/lib/server/telegram';
import { expandOccurrences } from '@/lib/utils/calendarRecurrence.mjs';

// Kept deliberately larger than the client's 3-minute poll interval.
const REMINDER_LOOKBACK_MS = 10 * 60 * 1000;

function reminderLabel(minutes) {
  if (minutes === 0) return 'Подія починається зараз';
  if (minutes < 60) return `До початку ${minutes} хв`;
  if (minutes < 1440) return `До початку ${minutes / 60} год`;
  return `До початку ${minutes / 1440} дн`;
}

function datePartsInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

// Every open tab polls this route, and the birthday sweep below reads all
// memberships plus every member profile. Claiming a once-per-day marker first
// turns that from "per poll, per tab, per user" into "once per organization per
// day" — the create() fails for everyone who loses the race.
async function claimDailyBirthdaySweep(db, organizationId) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.collection('organizations').doc(organizationId)
    .collection('settings').doc(`birthdaySweep_${today}`);
  try {
    await ref.create({ claimedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') return false;
    throw error;
  }
}

async function createBirthdayGreetings(db, organizationId) {
  const organizationSnapshot = await db.collection('organizations').doc(organizationId).get();
  const timeZone = organizationSnapshot.data()?.timezone || 'Europe/Kyiv';
  let today;
  try {
    today = datePartsInTimezone(new Date(), timeZone);
  } catch {
    today = datePartsInTimezone(new Date(), 'Europe/Kyiv');
  }
  const membershipsSnapshot = await db.collection('orgMemberships').where('orgId', '==', organizationId).get();
  const memberships = membershipsSnapshot.docs.map(document => document.data());
  if (!memberships.length) return 0;
  const profiles = await db.getAll(...memberships.map(membership => db.collection('users').doc(membership.userId)));
  let created = 0;

  await Promise.all(memberships.map(async (membership, index) => {
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
  }));

  return created;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const userId = authorization.user.uid;
    const db = getAdminDb();
    // Only the caller's own events are read. Scanning the whole organization on
    // every poll made this the most expensive query in the app.
    const snapshot = await db.collection('calendarEvents')
      .where('organizationId', '==', organizationId)
      .where('participantIds', 'array-contains', userId)
      .get();
    const now = Date.now();
    // Must exceed the client's poll interval (REMINDER_POLL_MS) with margin, or
    // a reminder whose trigger falls between two polls is never delivered.
    // Widening it is free: notification ids are deterministic, so re-examining
    // the same window cannot produce a duplicate.
    const lookBack = REMINDER_LOOKBACK_MS;
    const candidates = [];

    snapshot.docs.forEach(document => {
      const event = document.data();
      const reminders = Array.isArray(event.reminderMinutes) ? event.reminderMinutes : [15];
      if (!reminders.length) return;
      const maxReminder = Math.max(0, ...reminders.map(Number)) * 60 * 1000;
      // Only occurrences whose reminder could fire inside the look-back window
      // matter, so the walk is bounded by that window and not by how old the
      // series is — a daily event from two years ago used to exhaust the
      // iteration cap before reaching today and silently stopped reminding.
      const { occurrences } = expandOccurrences({
        start: event.startAt?.toDate?.() || new Date(event.startAt),
        frequency: event.recurrence?.frequency || 'none',
        interval: event.recurrence?.interval,
        until: event.recurrence?.until ? `${event.recurrence.until}T23:59:59` : null,
        windowStart: new Date(now - lookBack),
        windowEnd: new Date(now + maxReminder + 5 * 60 * 1000),
        maxOccurrences: 64,
      });

      occurrences.forEach(occurrence => {
        reminders.forEach(minutes => {
          const triggerAt = occurrence.getTime() - Number(minutes) * 60 * 1000;
          if (triggerAt <= now && triggerAt >= now - lookBack) {
            candidates.push({
              eventId: document.id,
              event,
              occurrenceStart: occurrence.getTime(),
              minutes: Number(minutes),
            });
          }
        });
      });
    });

    let created = 0;
    await Promise.all(candidates.map(async candidate => {
      const id = `calendar_reminder_${candidate.eventId}_${userId}_${candidate.occurrenceStart}_${candidate.minutes}`;
      try {
        const occurrence = new Date(candidate.occurrenceStart).toISOString();
        const link = withNotificationOrganization(
          `/calendar/event/${encodeURIComponent(candidate.eventId)}?occurrence=${encodeURIComponent(occurrence)}`,
          organizationId,
        );
        const body = reminderLabel(candidate.minutes);
        await db.collection('notifications').doc(id).create({
          userId,
          type: 'calendar_reminder',
          title: candidate.event.title,
          body,
          link,
          organizationId,
          calendarEventId: candidate.eventId,
          actorId: candidate.event.organizerId || '',
          actorName: '',
          actorAvatar: '',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created += 1;
        await deliverTelegramNotification({
          userIds: [userId],
          title: candidate.event.title,
          body,
          link,
        }).catch(error => console.warn('[calendar-reminders] Telegram delivery failed:', error.message));
      } catch (error) {
        if (error.code !== 6 && error.code !== 'already-exists') throw error;
      }
    }));

    const birthdayGreetings = await claimDailyBirthdaySweep(db, organizationId)
      ? await createBirthdayGreetings(db, organizationId)
      : 0;
    return NextResponse.json({ created, birthdayGreetings });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'calendar-reminders POST',
      fallbackMessage: 'Не вдалося перевірити нагадування',
    });
  }
}
