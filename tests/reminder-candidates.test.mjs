import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarReminderCandidates,
  dayKeyInTimeZone,
  deadlineReminderCandidates,
} from '../src/lib/utils/reminderCandidates.mjs';

test('calendar reminders are produced server-side for accepted participants only', () => {
  const nowMs = Date.parse('2026-07-29T08:45:00.000Z');
  const candidates = calendarReminderCandidates([{
    id: 'event-1',
    organizationId: 'org-1',
    organizerId: 'owner-1',
    title: 'Синк команди',
    startAt: '2026-07-29T09:00:00.000Z',
    participantIds: ['member-1', 'member-2'],
    participantResponses: { 'member-1': 'accepted', 'member-2': 'declined' },
    reminderMinutes: [15],
    recurrence: { frequency: 'none' },
  }], { nowMs });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].userId, 'member-1');
  assert.equal(
    candidates[0].id,
    `calendar_reminder_event-1_member-1_${Date.parse('2026-07-29T09:00:00.000Z')}_15`,
  );
  assert.equal(candidates[0].body, 'До початку 15 хв');
});

test('calendar reminder look-back catches a missed scheduler tick without duplicates', () => {
  const candidates = calendarReminderCandidates([{
    id: 'event-2',
    organizationId: 'org-1',
    title: 'Реліз',
    startAt: '2026-07-29T09:00:00.000Z',
    participantIds: ['member-1'],
    reminderMinutes: [15],
  }], {
    nowMs: Date.parse('2026-07-29T08:49:00.000Z'),
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, 'calendar_reminder_event-2_member-1_1785315600000_15');
});

test('deadline candidates skip terminal issues and preserve daily overdue dedupe', () => {
  const nowMs = Date.parse('2026-07-29T09:00:00.000Z');
  const candidates = deadlineReminderCandidates([
    {
      id: 'issue-open',
      organizationId: 'org-1',
      projectId: 'project-1',
      issueKey: 'QT-12',
      title: 'Виправити Telegram',
      dueDate: '2026-07-28T18:00:00.000Z',
      assigneeIds: ['member-1'],
      status: 'in-progress',
    },
    {
      id: 'issue-done',
      organizationId: 'org-1',
      projectId: 'project-1',
      issueKey: 'QT-13',
      title: 'Готово',
      dueDate: '2026-07-28T18:00:00.000Z',
      assigneeIds: ['member-1'],
      status: 'closed',
    },
  ], {
    nowMs,
    doneStatusIdsByOrganization: new Map([['org-1', new Set(['closed'])]]),
    timeZonesByOrganization: new Map([['org-1', 'Europe/Kyiv']]),
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, 'overdue_issue-open_member-1_2026-07-29');
  assert.match(candidates[0].title, /дедлайн прострочено/);
});

test('day keys honor the organization timezone', () => {
  const instant = Date.parse('2026-07-28T21:30:00.000Z');
  assert.equal(dayKeyInTimeZone(instant, 'Europe/Kyiv'), '2026-07-29');
  assert.equal(dayKeyInTimeZone(instant, 'America/New_York'), '2026-07-28');
});
