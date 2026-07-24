import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';

function nextOccurrence(date, frequency, interval) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + interval);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7 * interval);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + interval);
  return next;
}

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
    const snapshot = await db.collection('calendarEvents').where('organizationId', '==', organizationId).get();
    const now = Date.now();
    const lookBack = 5 * 60 * 1000;
    const candidates = [];

    snapshot.docs.forEach(document => {
      const event = document.data();
      if (!event.participantIds?.includes(userId)) return;
      const reminders = Array.isArray(event.reminderMinutes) ? event.reminderMinutes : [15];
      const frequency = event.recurrence?.frequency || 'none';
      const interval = Math.max(1, Number(event.recurrence?.interval) || 1);
      const until = event.recurrence?.until
        ? new Date(`${event.recurrence.until}T23:59:59`).getTime()
        : now + 2 * 365 * 24 * 60 * 60 * 1000;
      const maxReminder = Math.max(0, ...reminders) * 60 * 1000;
      let occurrence = event.startAt?.toDate?.() || new Date(event.startAt);
      let iterations = 0;
      while (
        Number.isFinite(occurrence.getTime()) &&
        occurrence.getTime() <= Math.min(until, now + maxReminder + 5 * 60 * 1000) &&
        iterations < 1000
      ) {
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
        if (frequency === 'none') break;
        occurrence = nextOccurrence(occurrence, frequency, interval);
        iterations += 1;
      }
    });

    let created = 0;
    await Promise.all(candidates.map(async candidate => {
      const id = `calendar_reminder_${candidate.eventId}_${userId}_${candidate.occurrenceStart}_${candidate.minutes}`;
      try {
        await db.collection('notifications').doc(id).create({
          userId,
          type: 'calendar_reminder',
          title: candidate.event.title,
          body: reminderLabel(candidate.minutes),
          link: withNotificationOrganization(`/calendar?event=${candidate.eventId}`, organizationId),
          organizationId,
          calendarEventId: candidate.eventId,
          actorId: candidate.event.organizerId || '',
          actorName: '',
          actorAvatar: '',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created += 1;
      } catch (error) {
        if (error.code !== 6 && error.code !== 'already-exists') throw error;
      }
    }));

    const birthdayGreetings = await createBirthdayGreetings(db, organizationId);
    return NextResponse.json({ created, birthdayGreetings });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'calendar-reminders POST',
      fallbackMessage: 'Не вдалося перевірити нагадування',
    });
  }
}
