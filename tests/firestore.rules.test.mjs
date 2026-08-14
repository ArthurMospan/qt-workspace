import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, query, where, getDocs } from 'firebase/firestore';

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'quickteam-rules-test',
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', 'org-a'), { ownerId: 'owner-a', name: 'Org A' });
    await setDoc(doc(db, 'users', 'owner-a'), { name: 'Owner', email: 'owner@example.com' });
    await setDoc(doc(db, 'users', 'member-a'), { name: 'Member', email: 'member@example.com' });
    await setDoc(doc(db, 'users', 'member-offteam'), { name: 'Off-team member', email: 'offteam@example.com' });
    await setDoc(doc(db, 'orgMemberships', 'org-a_owner-a'), {
      id: 'org-a_owner-a', orgId: 'org-a', userId: 'owner-a', role: 'owner',
    });
    await setDoc(doc(db, 'orgMemberships', 'org-a_admin-a'), {
      id: 'org-a_admin-a', orgId: 'org-a', userId: 'admin-a', role: 'admin',
    });
    await setDoc(doc(db, 'orgMemberships', 'org-a_member-a'), {
      id: 'org-a_member-a', orgId: 'org-a', userId: 'member-a', role: 'member',
    });
    await setDoc(doc(db, 'orgMemberships', 'org-a_member-offteam'), {
      id: 'org-a_member-offteam', orgId: 'org-a', userId: 'member-offteam', role: 'member',
    });
    await setDoc(doc(db, 'projects', 'project-a'), {
      organizationId: 'org-a',
      name: 'Project A',
      issueCounter: 1,
      status: 'active',
      team: ['owner-a', 'admin-a', 'member-a'],
    });
    await setDoc(doc(db, 'issues', 'issue-a'), {
      organizationId: 'org-a', projectId: 'project-a', title: 'Issue A',
      spentMinutes: 30,
      spentMinutesMirrorVersion: 1,
      timeLogMutationVersion: 1,
    });
    await setDoc(doc(db, 'issues', 'issue-a', 'comments', 'member-comment'), {
      authorId: 'member-a', text: 'Member comment',
    });
    await setDoc(doc(db, 'issues', 'issue-a', 'comments', 'owner-comment'), {
      authorId: 'owner-a', text: 'Owner comment',
    });
    await setDoc(doc(db, 'organizations', 'org-a', 'channels', 'general'), { name: 'general', type: 'public' });
    await setDoc(doc(db, 'organizations', 'org-a', 'channels', 'general', 'messages', 'owner-message'), {
      senderId: 'owner-a', text: 'Original', reactions: {}, replyCount: 0,
    });
    await setDoc(doc(db, 'timeLogs', 'log-owner'), {
      organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
      userId: 'owner-a', spentMinutes: 30,
    });
  });
});

after(async () => {
  await environment?.cleanup();
});

// ── Direct-message fixtures ─────────────────────────────────────────────
// DM rooms live in the org-wide channels collection, so without an explicit
// gate every member could read every conversation by reconstructing the
// deterministic room id. Membership is proven from the id itself, which only
// works for real Firebase uids (28 alphanumeric chars).
const DM_A = 'Aa1bb2cc3dd4ee5ff6gg7hh8ii9j';
const DM_B = 'Zz9yy8xx7ww6vv5uu4tt3ss2rr1q';
const DM_C = 'Mm5nn4oo3pp2qq1rr0ss9tt8uu7v';
const DM_ROOM = `${DM_A}_${DM_B}`;

async function seedDirectRoomMembers() {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const uid of [DM_A, DM_B, DM_C]) {
      await setDoc(doc(db, 'orgMemberships', `org-a_${uid}`), {
        id: `org-a_${uid}`, orgId: 'org-a', userId: uid, role: 'member',
      });
    }
  });
}

async function seedDirectRoom() {
  await seedDirectRoomMembers();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM), {
      name: 'DM', type: 'dm', participants: [DM_A, DM_B], messageCount: 1,
    });
    await setDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'm1'), {
      senderId: DM_A, text: 'секрет',
    });
    await setDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'm1', 'replies', 'r1'), {
      senderId: DM_B, text: 'теж секрет',
    });
  });
}

test('an authenticated outsider cannot self-join an organization', async () => {
  const db = environment.authenticatedContext('outsider').firestore();
  await assertFails(setDoc(doc(db, 'orgMemberships', 'org-a_outsider'), {
    id: 'org-a_outsider', orgId: 'org-a', userId: 'outsider', role: 'member',
  }));
});

test('a regular member can read only their own membership while admins can list the directory', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const memberships = db => query(
    collection(db, 'orgMemberships'),
    where('orgId', '==', 'org-a'),
  );

  await assertSucceeds(getDoc(doc(memberDb, 'orgMemberships', 'org-a_member-a')));
  await assertFails(getDoc(doc(memberDb, 'orgMemberships', 'org-a_owner-a')));
  await assertFails(getDocs(memberships(memberDb)));
  await assertSucceeds(getDocs(memberships(adminDb)));
  await assertSucceeds(getDocs(memberships(ownerDb)));
});

test('member and workflow rates are unreadable from browser Firestore clients', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', 'org-a', 'memberRates', 'member-a'), {
      userId: 'member-a', hourlyRate: 75,
    });
    await setDoc(doc(db, 'organizations', 'org-a', 'private', 'workflowRates'), {
      positionRates: { dev: 100 },
    });
  });
  for (const uid of ['member-a', 'admin-a', 'owner-a']) {
    const db = environment.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'memberRates', 'member-a')));
    await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'private', 'workflowRates')));
  }
});

test('issue read cursors are private, identity-bound and timestamp-only', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const cursorRef = doc(memberDb, 'organizations', 'org-a', 'issueReadState', 'member-a_issue-a');

  await assertSucceeds(setDoc(cursorRef, {
    userId: 'member-a',
    issueId: 'issue-a',
    lastSeenAt: new Date(100),
  }));
  await assertSucceeds(updateDoc(cursorRef, { lastSeenAt: new Date(200) }));
  await assertSucceeds(getDoc(cursorRef));
  await assertFails(getDoc(doc(ownerDb, 'organizations', 'org-a', 'issueReadState', 'member-a_issue-a')));
  await assertFails(setDoc(doc(memberDb, 'organizations', 'org-a', 'issueReadState', 'forged'), {
    userId: 'member-a', issueId: 'issue-a', lastSeenAt: new Date(100),
  }));
  await assertFails(setDoc(doc(memberDb, 'organizations', 'org-a', 'issueReadState', 'member-a_issue-b'), {
    userId: 'owner-a', issueId: 'issue-b', lastSeenAt: new Date(100),
  }));
  await assertFails(updateDoc(cursorRef, { issueId: 'issue-b' }));
  await assertFails(updateDoc(cursorRef, { debug: true }));
});

test('issue read cursors can only be listed through the current user scope', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const cursorCollection = collection(memberDb, 'organizations', 'org-a', 'issueReadState');
  await assertSucceeds(getDocs(query(cursorCollection, where('userId', '==', 'member-a'))));
  await assertFails(getDocs(cursorCollection));
});

test('an admin cannot bypass the invitation API by writing memberships directly', async () => {
  const db = environment.authenticatedContext('admin-a').firestore();
  const membership = { id: 'org-a_new-user', orgId: 'org-a', userId: 'new-user', role: 'member' };
  await assertFails(setDoc(doc(db, 'orgMemberships', 'org-a_new-user'), membership));
  await assertFails(setDoc(doc(db, 'orgMemberships', 'forged-id'), { ...membership, id: 'forged-id' }));
});

test('a member cannot change identity fields on a membership', async () => {
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  await assertFails(updateDoc(doc(ownerDb, 'orgMemberships', 'org-a_member-a'), {
    userId: 'outsider',
  }));
});

test('the removed client role cannot be assigned to a membership', async () => {
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  await assertFails(updateDoc(doc(ownerDb, 'orgMemberships', 'org-a_member-a'), {
    role: 'client',
  }));
});

test('owner membership and organization ownership cannot be removed through client writes', async () => {
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  await assertFails(updateDoc(doc(adminDb, 'orgMemberships', 'org-a_owner-a'), { role: 'member' }));
  await assertFails(deleteDoc(doc(adminDb, 'orgMemberships', 'org-a_owner-a')));
  await assertFails(updateDoc(doc(ownerDb, 'orgMemberships', 'org-a_owner-a'), { role: 'member' }));
  await assertFails(updateDoc(doc(ownerDb, 'orgMemberships', 'org-a_member-a'), { role: 'owner' }));
  await assertFails(deleteDoc(doc(ownerDb, 'organizations', 'org-a')));
  await assertFails(updateDoc(doc(ownerDb, 'organizations', 'org-a'), { ownerId: 'member-a' }));
});

test('issue deletion cannot bypass the hierarchy-aware server route', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertFails(deleteDoc(doc(memberDb, 'issues', 'issue-a')));
  await assertFails(deleteDoc(doc(adminDb, 'issues', 'issue-a')));
});

test('the membership bootstrap cannot put a rate in the public membership document', async () => {
  const db = environment.authenticatedContext('founder-with-rate').firestore();
  await assertSucceeds(setDoc(doc(db, 'organizations', 'org-rate'), {
    ownerId: 'founder-with-rate', name: 'Rate Org',
  }));
  await assertFails(setDoc(doc(db, 'orgMemberships', 'org-rate_founder-with-rate'), {
    id: 'org-rate_founder-with-rate',
    orgId: 'org-rate',
    userId: 'founder-with-rate',
    role: 'owner',
    hourlyRate: 100,
  }));
});

test('the issue trash is server-only, including for organization admins', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const memberTrash = doc(memberDb, 'deletedIssues', 'org-a_issue-a');
  const adminTrash = doc(adminDb, 'deletedIssues', 'org-a_issue-a');
  await assertFails(getDoc(memberTrash));
  await assertFails(getDoc(adminTrash));
  await assertFails(setDoc(adminTrash, {
    organizationId: 'org-a', issueId: 'issue-a', issue: { title: 'Forged' },
  }));
});

test('issue execution fields can only be changed by the authoritative status API', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const issueRef = doc(memberDb, 'issues', 'issue-a');
  await assertSucceeds(updateDoc(issueRef, { title: 'Updated title' }));
  await assertFails(updateDoc(issueRef, { status: 'done' }));
  await assertFails(updateDoc(issueRef, { columnId: 'done' }));
  await assertFails(updateDoc(issueRef, { completedAt: new Date() }));
  await assertFails(updateDoc(issueRef, { order: 10 }));
  await assertFails(updateDoc(issueRef, { spentMinutes: 999 }));
  await assertFails(updateDoc(issueRef, { spentMinutesMirrorVersion: 999 }));
  await assertFails(updateDoc(issueRef, { timeLogMutationVersion: 999 }));
  await assertFails(updateDoc(issueRef, { spentMinutesReconciledAt: new Date() }));
});

test('members cannot create or manage sprints', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const sprint = { organizationId: 'org-a', name: 'Sprint 1', status: 'planned' };
  await assertFails(setDoc(doc(memberDb, 'sprints', 'sprint-a'), sprint));
  await assertSucceeds(setDoc(doc(adminDb, 'sprints', 'sprint-a'), sprint));
});

test('task time-log writes are owned by authenticated server APIs', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(doc(db, 'timeLogs', 'member-log'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
    userId: 'member-a', spentMinutes: 15,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'forged-log'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
    userId: 'owner-a', spentMinutes: 999,
  }));
  await assertFails(updateDoc(doc(db, 'timeLogs', 'log-owner'), { spentMinutes: 999 }));
});

test('time logs require bounded positive integer minutes and clients cannot forge billing metadata', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  const base = {
    organizationId: 'org-a',
    projectId: 'project-a',
    issueId: 'issue-a',
    userId: 'member-a',
  };
  await assertFails(setDoc(doc(db, 'timeLogs', 'negative-log'), {
    ...base,
    spentMinutes: -15,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'fractional-log'), {
    ...base,
    spentMinutes: 1.5,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'huge-log'), {
    ...base,
    spentMinutes: 525601,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'forged-billed-log'), {
    ...base,
    spentMinutes: 15,
    invoiceId: 'invoice-a',
    billedAt: new Date(),
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'orphan-log'), {
    ...base,
    issueId: '',
    spentMinutes: 15,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'task-disguised-as-event'), {
    ...base,
    sourceType: 'calendar_event',
    eventId: 'event-a',
    occurrenceStartAt: '2026-07-25T09:00:00.000Z',
    spentMinutes: 15,
  }));
});

test('billed time logs are immutable even for their author and organization owner', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'timeLogs', 'billed-log'), {
      organizationId: 'org-a',
      projectId: 'project-a',
      issueId: 'issue-a',
      userId: 'owner-a',
      spentMinutes: 30,
      invoiceId: 'invoice-a',
      billedAt: new Date(),
    });
  });
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const billedRef = doc(ownerDb, 'timeLogs', 'billed-log');
  await assertFails(updateDoc(billedRef, { description: 'Changed' }));
  await assertFails(updateDoc(billedRef, { invoiceId: deleteField() }));
  await assertFails(deleteDoc(billedRef));
});

test('task time logs require a live issue in the same project and organization', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(doc(db, 'timeLogs', 'missing-issue-log'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'missing',
    userId: 'member-a', spentMinutes: 15,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'wrong-project-log'), {
    organizationId: 'org-a', projectId: 'project-b', issueId: 'issue-a',
    userId: 'member-a', spentMinutes: 15,
  }));

  await environment.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'issues', 'issue-a'), {
      deletionPending: true,
    });
  });
  await assertFails(setDoc(doc(db, 'timeLogs', 'deleting-issue-log'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
    userId: 'member-a', spentMinutes: 15,
  }));
});

test('calendar time logs are server-owned and direct clients cannot mutate them', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  const ref = doc(db, 'timeLogs', 'calendar-log');
  const calendarLog = {
    organizationId: 'org-a', projectId: 'project-a', issueId: '',
    eventId: 'event-a', occurrenceStartAt: '2026-07-25T09:00:00.000Z',
    sourceType: 'calendar_event', eventVisibility: 'team',
    calendarOrganizerId: 'member-a', userId: 'member-a', spentMinutes: 45,
  };
  await assertFails(setDoc(ref, calendarLog));
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'timeLogs', 'calendar-log'), calendarLog);
  });
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { spentMinutes: 50 }));
  await assertFails(updateDoc(ref, { eventId: 'event-b' }));
  await assertFails(updateDoc(ref, { occurrenceStartAt: '2026-07-26T09:00:00.000Z' }));
  await assertFails(updateDoc(ref, { sourceType: 'task' }));
  await assertFails(deleteDoc(ref));
});

test('authors can delete their own comments but not another authors comments', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(deleteDoc(doc(db, 'issues', 'issue-a', 'comments', 'member-comment')));
  await assertFails(deleteDoc(doc(db, 'issues', 'issue-a', 'comments', 'owner-comment')));
});

test('clients cannot delete task time logs, including their own', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'timeLogs', 'member-log-delete'), {
      organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
      userId: 'member-a', spentMinutes: 10,
    });
  });
  await assertFails(deleteDoc(doc(memberDb, 'timeLogs', 'member-log-delete')));
  await assertFails(deleteDoc(doc(memberDb, 'timeLogs', 'log-owner')));
});

test('direct time-log creation stays denied throughout project deletion', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const log = {
    organizationId: 'org-a',
    projectId: 'project-a',
    issueId: 'issue-a',
    userId: 'member-a',
    spentMinutes: 15,
  };
  await assertFails(setDoc(doc(memberDb, 'timeLogs', 'before-project-delete'), log));

  await environment.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'projects', 'project-a'), {
      deletionPending: true,
    });
  });
  await assertFails(setDoc(doc(memberDb, 'timeLogs', 'after-project-delete'), log));
});

test('plain members cannot read or write time logs outside their project team', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', 'private-project'), {
      organizationId: 'org-a',
      name: 'Private project',
      status: 'active',
      team: ['owner-a'],
    });
    await setDoc(doc(db, 'issues', 'private-issue'), {
      organizationId: 'org-a',
      projectId: 'private-project',
      title: 'Private issue',
    });
    await setDoc(doc(db, 'timeLogs', 'private-log'), {
      organizationId: 'org-a',
      projectId: 'private-project',
      issueId: 'private-issue',
      userId: 'owner-a',
      spentMinutes: 30,
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  await assertFails(getDoc(doc(memberDb, 'timeLogs', 'private-log')));
  await assertFails(setDoc(doc(memberDb, 'timeLogs', 'private-member-log'), {
    organizationId: 'org-a',
    projectId: 'private-project',
    issueId: 'private-issue',
    userId: 'member-a',
    spentMinutes: 15,
  }));
  await assertSucceeds(getDoc(doc(ownerDb, 'timeLogs', 'private-log')));
});

test('time log queries prove their project or organization-calendar scope', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'timeLogs', 'calendar-project-log'), {
      organizationId: 'org-a',
      projectId: 'project-a',
      issueId: '',
      sourceType: 'calendar_event',
      eventId: 'event-project',
      eventVisibility: 'team',
      calendarOrganizerId: 'member-a',
      occurrenceStartAt: '2026-07-29T09:00:00.000Z',
      userId: 'member-a',
      spentMinutes: 30,
    });
    await setDoc(doc(db, 'timeLogs', 'calendar-org-log'), {
      organizationId: 'org-a',
      projectId: '',
      issueId: '',
      sourceType: 'calendar_event',
      eventId: 'event-org',
      eventVisibility: 'team',
      calendarOrganizerId: 'member-a',
      occurrenceStartAt: '2026-07-29T11:00:00.000Z',
      userId: 'member-a',
      spentMinutes: 45,
    });
    await setDoc(doc(db, 'projects', 'query-private-project'), {
      organizationId: 'org-a',
      name: 'Query private project',
      status: 'active',
      team: ['owner-a'],
    });
    await setDoc(doc(db, 'timeLogs', 'query-private-log'), {
      organizationId: 'org-a',
      projectId: 'query-private-project',
      issueId: '',
      sourceType: 'calendar_event',
      eventId: 'private-event',
      eventVisibility: 'private',
      calendarOrganizerId: 'owner-a',
      occurrenceStartAt: '2026-07-29T12:00:00.000Z',
      userId: 'owner-a',
      spentMinutes: 15,
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const logs = collection(memberDb, 'timeLogs');

  await assertFails(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('projectId', '==', 'project-a'),
  )));
  await assertFails(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('projectId', 'in', ['project-a']),
  )));
  await assertSucceeds(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('projectId', 'in', ['project-a']),
    where('issueId', '!=', ''),
  )));
  await assertSucceeds(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('projectId', '==', 'project-a'),
    where('sourceType', '==', 'calendar_event'),
    where('eventVisibility', '==', 'team'),
    where('eventId', '==', 'event-project'),
    where('occurrenceStartAt', '==', '2026-07-29T09:00:00.000Z'),
  )));
  await assertSucceeds(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('projectId', '==', ''),
    where('sourceType', '==', 'calendar_event'),
    where('eventVisibility', '==', 'team'),
    where('eventId', '==', 'event-org'),
    where('occurrenceStartAt', '==', '2026-07-29T11:00:00.000Z'),
  )));
  await assertSucceeds(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('projectId', '==', ''),
    where('sourceType', '==', 'calendar_event'),
    where('eventVisibility', '==', 'team'),
  )));
  await assertFails(getDoc(doc(memberDb, 'timeLogs', 'query-private-log')));
  await assertFails(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
    where('sourceType', '==', 'calendar_event'),
    where('eventVisibility', '==', 'private'),
  )));
  await assertFails(getDocs(query(
    logs,
    where('organizationId', '==', 'org-a'),
  )));
});

test('organization calendar time can only be written by the server API', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const ref = doc(memberDb, 'timeLogs', 'calendar-without-project');
  await assertFails(setDoc(ref, {
    organizationId: 'org-a',
    projectId: '',
    issueId: '',
    sourceType: 'calendar_event',
    eventId: 'event-org',
    eventVisibility: 'team',
    calendarOrganizerId: 'member-a',
    occurrenceStartAt: '2026-07-29T11:00:00.000Z',
    userId: 'member-a',
    spentMinutes: 45,
  }));
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'timeLogs', 'calendar-without-project'), {
      organizationId: 'org-a', projectId: '', issueId: '',
      sourceType: 'calendar_event', eventId: 'event-org',
      eventVisibility: 'team', calendarOrganizerId: 'member-a',
      occurrenceStartAt: '2026-07-29T11:00:00.000Z',
      userId: 'member-a', spentMinutes: 45,
    });
  });
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { spentMinutes: 50 }));
  await assertFails(deleteDoc(ref));
});

test('invoices are readable by billing admins but all writes use the server API', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const invoice = { organizationId: 'org-a', projectId: 'project-a', total: 100 };
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'invoices', 'invoice-a'), invoice);
    await setDoc(doc(context.firestore(), 'invoiceTimeLogReservations', 'reservation-a'), {
      organizationId: 'org-a',
      projectId: 'project-a',
      timeLogId: 'log-owner',
      invoiceId: 'invoice-a',
    });
    await setDoc(doc(context.firestore(), 'invoiceEstimateReservations', 'estimate-reservation-a'), {
      organizationId: 'org-a',
      projectId: 'project-a',
      itemId: 'issue-a',
      invoiceId: 'invoice-a',
    });
    await setDoc(doc(context.firestore(), 'invoiceNumberSequences', 'sequence-a'), {
      organizationId: 'org-a',
      year: 2026,
      counter: 1,
    });
  });

  await assertFails(getDoc(doc(memberDb, 'invoices', 'invoice-a')));
  await assertSucceeds(getDoc(doc(ownerDb, 'invoices', 'invoice-a')));
  await assertSucceeds(getDoc(doc(adminDb, 'invoices', 'invoice-a')));
  await assertFails(setDoc(doc(memberDb, 'invoices', 'invoice-a'), invoice));
  await assertFails(setDoc(doc(ownerDb, 'invoices', 'invoice-owner-write'), invoice));
  await assertFails(setDoc(doc(adminDb, 'invoices', 'invoice-admin-write'), invoice));
  await assertFails(updateDoc(doc(ownerDb, 'invoices', 'invoice-a'), { total: 200 }));
  await assertFails(deleteDoc(doc(ownerDb, 'invoices', 'invoice-a')));
  await assertFails(getDoc(doc(ownerDb, 'invoiceTimeLogReservations', 'reservation-a')));
  await assertFails(setDoc(
    doc(ownerDb, 'invoiceTimeLogReservations', 'reservation-forged'),
    {
      organizationId: 'org-a',
      projectId: 'project-a',
      timeLogId: 'log-owner',
      invoiceId: 'invoice-a',
    },
  ));
  await assertFails(getDoc(
    doc(ownerDb, 'invoiceEstimateReservations', 'estimate-reservation-a'),
  ));
  await assertFails(setDoc(
    doc(ownerDb, 'invoiceEstimateReservations', 'estimate-reservation-forged'),
    {
      organizationId: 'org-a',
      projectId: 'project-a',
      itemId: 'issue-a',
      invoiceId: 'invoice-a',
    },
  ));
  await assertFails(getDoc(doc(ownerDb, 'invoiceNumberSequences', 'sequence-a')));
  await assertFails(setDoc(doc(ownerDb, 'invoiceNumberSequences', 'sequence-forged'), {
    organizationId: 'org-a',
    year: 2026,
    counter: 999,
  }));
});

test('API keys cannot be read from the private path or written onto the organization document', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'organizations', 'org-a', 'private', 'apiKeys'), {
      keys: [{ id: 'secret', tokenHash: 'hash' }],
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertFails(getDoc(doc(memberDb, 'organizations', 'org-a', 'private', 'apiKeys')));
  await assertFails(getDoc(doc(adminDb, 'organizations', 'org-a', 'private', 'apiKeys')));
  await assertFails(updateDoc(doc(adminDb, 'organizations', 'org-a'), {
    apiKeys: [{ token: 'plaintext' }],
  }));
});

test('notifications can only be created by the server API', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(doc(db, 'notifications', 'same-org'), {
    userId: 'owner-a', actorId: 'member-a', organizationId: 'org-a',
    title: 'Hello', body: '', read: false,
  }));
  await assertFails(setDoc(doc(db, 'notifications', 'outsider'), {
    userId: 'outsider', actorId: 'member-a', organizationId: 'org-a',
    title: 'Spam', body: '', read: false,
  }));
  await assertFails(setDoc(doc(db, 'notifications', 'spoofed'), {
    userId: 'owner-a', actorId: 'admin-a', organizationId: 'org-a',
    title: 'Spoofed', body: '', read: false,
  }));
});

test('a recipient can only toggle the read state of a notification', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'notifications', 'recipient-notification'), {
      userId: 'member-a', title: 'Original', body: 'Body', read: false,
    });
  });
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(updateDoc(doc(db, 'notifications', 'recipient-notification'), { read: true }));
  await assertFails(updateDoc(doc(db, 'notifications', 'recipient-notification'), { title: 'Rewritten' }));
  await assertFails(updateDoc(doc(db, 'notifications', 'recipient-notification'), { userId: 'owner-a' }));
});

test('user profiles are private even between organization members', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'users', 'member-a')));
  await assertFails(getDoc(doc(memberDb, 'users', 'owner-a')));
});

test('presence is organization-scoped and users can only write their own state', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const outsiderDb = environment.authenticatedContext('outsider').firestore();
  const ownPresence = doc(memberDb, 'organizations', 'org-a', 'presence', 'member-a');
  await assertSucceeds(setDoc(ownPresence, { online: true }));
  await assertSucceeds(getDoc(ownPresence));
  await assertFails(setDoc(doc(memberDb, 'organizations', 'org-a', 'presence', 'owner-a'), { online: false }));
  await assertFails(getDoc(doc(outsiderDb, 'organizations', 'org-a', 'presence', 'member-a')));
  await assertFails(setDoc(doc(memberDb, 'presence', 'member-a'), { online: true }));
});

test('chat members cannot edit another author message', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const memberMessage = doc(memberDb, 'organizations', 'org-a', 'channels', 'general', 'messages', 'owner-message');
  await assertFails(updateDoc(memberMessage, { text: 'Forged' }));
  await assertSucceeds(updateDoc(memberMessage, { reactions: { '👍': ['member-a'] } }));
  await assertSucceeds(updateDoc(memberMessage, { isPinned: true }));
  await assertSucceeds(updateDoc(
    doc(ownerDb, 'organizations', 'org-a', 'channels', 'general', 'messages', 'owner-message'),
    { text: 'Edited by owner' },
  ));
  await assertFails(setDoc(doc(memberDb, 'organizations', 'org-a', 'channels', 'unauthorized'), {
    name: 'unauthorized', type: 'public',
  }));
});

test('chat send metadata supports unread counts without opening channel settings', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const channel = doc(memberDb, 'organizations', 'org-a', 'channels', 'general');

  await assertSucceeds(updateDoc(channel, {
    lastMessageAt: new Date(),
    lastMessageText: 'Hello',
    lastMessageSender: 'Member',
    lastMessageSenderId: 'member-a',
    messageCount: 1,
  }));
  await assertFails(updateDoc(channel, { description: 'Bypass settings permission' }));
});

test('a member can send a DM using only the metadata the rules allow', async () => {
  await seedDirectRoomMembers();
  const memberDb = environment.authenticatedContext(DM_A).firestore();
  const channel = doc(memberDb, 'organizations', 'org-a', 'channels', DM_ROOM);

  await assertSucceeds(setDoc(channel, { name: 'DM', type: 'dm', participants: [DM_A, DM_B] }));
  await assertSucceeds(updateDoc(channel, {
    lastMessageAt: new Date(),
    lastMessageSenderId: DM_A,
    messageCount: 1,
  }));
  await assertSucceeds(setDoc(
    doc(memberDb, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'message-a'),
    { senderId: DM_A, text: 'Hello' },
  ));
  await assertSucceeds(setDoc(
    doc(memberDb, 'organizations', 'org-a', 'activeDMs', DM_B),
    { partners: [DM_A] },
  ));

  // Message text belongs under messages/, never on the org-enumerable room doc.
  await assertFails(updateDoc(channel, { lastMessageText: 'Hello' }));
  await assertFails(setDoc(
    doc(memberDb, 'organizations', 'org-a', 'activeDMs', DM_A),
    { partners: [DM_B] },
  ));
});

test('organization bootstrap still allows the first owner membership', async () => {
  const db = environment.authenticatedContext('founder').firestore();
  await assertSucceeds(setDoc(doc(db, 'organizations', 'org-new'), {
    ownerId: 'founder', name: 'New Org',
  }));
  await assertSucceeds(setDoc(doc(db, 'orgMemberships', 'org-new_founder'), {
    id: 'org-new_founder', orgId: 'org-new', userId: 'founder', role: 'owner',
  }));
});

test('issues and project lifecycle mutations cannot bypass server APIs', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertFails(setDoc(doc(memberDb, 'issues', 'client-created'), {
    organizationId: 'org-a', projectId: 'project-a', title: 'Bypass',
  }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { status: 'archived' }));
  await assertFails(deleteDoc(doc(adminDb, 'projects', 'project-a')));
  await assertSucceeds(updateDoc(doc(adminDb, 'projects', 'project-a'), { name: 'Renamed' }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { issueCounter: 99 }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { issueLinkVersion: 99 }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { issueHierarchyVersion: 99 }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { issueStatusVersion: 99 }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { invoiceMutationVersion: 99 }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { timeLogImportVersion: 99 }));
  await assertFails(updateDoc(doc(adminDb, 'projects', 'project-a'), { deletionPending: true }));
});

test('deletion markers freeze nested writes before non-atomic cascades', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const messageRef = doc(memberDb, 'projects', 'project-a', 'messages', 'member-message');
  const commentRef = doc(memberDb, 'issues', 'issue-a', 'comments', 'pending-comment');
  const auditRef = doc(memberDb, 'issues', 'issue-a', 'audit', 'pending-audit');
  const materialRef = doc(memberDb, 'stages', 'stage-a', 'materials', 'material-a');

  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'stages', 'stage-a'), {
      projectId: 'project-a',
      title: 'Stage A',
    });
  });
  await assertSucceeds(setDoc(messageRef, {
    senderId: 'member-a',
    text: 'Before deletion',
  }));
  await assertSucceeds(setDoc(commentRef, {
    authorId: 'member-a',
    text: 'Before deletion',
  }));
  await assertSucceeds(setDoc(auditRef, {
    userId: 'member-a',
    action: 'before_deletion',
  }));
  await assertSucceeds(setDoc(materialRef, {
    title: 'Before deletion',
  }));

  await environment.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'projects', 'project-a'), {
      deletionPending: true,
    });
  });

  await assertFails(setDoc(doc(
    memberDb,
    'projects',
    'project-a',
    'messages',
    'late-message',
  ), {
    senderId: 'member-a',
    text: 'Too late',
  }));
  await assertFails(updateDoc(messageRef, { text: 'Too late' }));
  await assertFails(deleteDoc(messageRef));
  await assertFails(setDoc(doc(
    memberDb,
    'stages',
    'stage-a',
    'materials',
    'late-material',
  ), {
    title: 'Too late',
  }));
  await assertFails(updateDoc(materialRef, { title: 'Too late' }));
  await assertFails(deleteDoc(materialRef));
  await assertFails(updateDoc(doc(memberDb, 'stages', 'stage-a'), {
    title: 'Too late',
  }));
  await assertFails(setDoc(doc(
    memberDb,
    'issues',
    'issue-a',
    'comments',
    'late-comment',
  ), {
    authorId: 'member-a',
    text: 'Too late',
  }));
  await assertFails(updateDoc(commentRef, { text: 'Too late' }));
  await assertFails(deleteDoc(commentRef));
  await assertFails(setDoc(doc(
    memberDb,
    'issues',
    'issue-a',
    'audit',
    'late-audit',
  ), {
    userId: 'member-a',
    action: 'too_late',
  }));
  await assertFails(updateDoc(doc(memberDb, 'issues', 'issue-a'), {
    title: 'Too late',
  }));

  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await updateDoc(doc(db, 'projects', 'project-a'), {
      deletionPending: false,
    });
    await updateDoc(doc(db, 'issues', 'issue-a'), {
      deletionPending: true,
    });
  });
  await assertFails(setDoc(doc(
    memberDb,
    'issues',
    'issue-a',
    'comments',
    'issue-late-comment',
  ), {
    authorId: 'member-a',
    text: 'Too late',
  }));
  await assertFails(setDoc(doc(
    memberDb,
    'issues',
    'issue-a',
    'audit',
    'issue-late-audit',
  ), {
    userId: 'member-a',
    action: 'too_late',
  }));
});

test('issue hierarchy and legacy subtasks can only be changed by server APIs', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertFails(updateDoc(doc(memberDb, 'issues', 'issue-a'), {
    parentIssueId: 'issue-parent',
  }));
  await assertFails(updateDoc(doc(adminDb, 'issues', 'issue-a'), {
    parentEpicId: 'legacy-parent',
  }));
  await assertFails(updateDoc(doc(memberDb, 'issues', 'issue-a'), {
    subtasks: [{ title: 'Обхід API', done: false }],
  }));
  await assertFails(updateDoc(doc(adminDb, 'issues', 'issue-a'), {
    deletionPending: true,
  }));
  await assertSucceeds(updateDoc(doc(memberDb, 'issues', 'issue-a'), {
    title: 'Дозволене редагування',
  }));
});

test('clients cannot promote regular issues to epic while legacy epics remain editable', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  await assertFails(updateDoc(doc(memberDb, 'issues', 'issue-a'), { type: 'epic' }));

  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'issues', 'legacy-epic'), {
      organizationId: 'org-a',
      projectId: 'project-a',
      title: 'Legacy epic',
      type: 'epic',
    });
  });
  await assertSucceeds(updateDoc(doc(memberDb, 'issues', 'legacy-epic'), {
    title: 'Edited legacy epic',
  }));
  await assertSucceeds(updateDoc(doc(memberDb, 'issues', 'legacy-epic'), {
    type: 'task',
  }));
});

test('issue links are readable but all client writes go through the canonical API', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'issueLinks', 'link-a'), {
      schemaVersion: 2,
      organizationId: 'org-a',
      projectId: 'project-a',
      sourceIssueId: 'issue-a',
      targetIssueId: 'issue-b',
      relationType: 'blocks',
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'issueLinks', 'link-a')));
  await assertFails(setDoc(doc(memberDb, 'issueLinks', 'forged'), {
    schemaVersion: 2,
    organizationId: 'org-a',
    projectId: 'project-a',
    sourceIssueId: 'issue-a',
    targetIssueId: 'issue-b',
    relationType: 'blocks',
  }));
  await assertFails(updateDoc(doc(adminDb, 'issueLinks', 'link-a'), {
    relationType: 'duplicates',
  }));
  await assertFails(deleteDoc(doc(adminDb, 'issueLinks', 'link-a')));
});

test('issue links stay listable for the projects a user can already open', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', 'project-locked'), {
      organizationId: 'org-a',
      name: 'Locked',
      status: 'active',
      team: ['owner-a'],
    });
    for (const [id, projectId] of [
      ['list-link-a', 'project-a'],
      ['list-link-b', 'project-a'],
      ['list-link-locked', 'project-locked'],
    ]) {
      await setDoc(doc(db, 'issueLinks', id), {
        schemaVersion: 2,
        organizationId: 'org-a',
        projectId,
        sourceIssueId: 'issue-a',
        targetIssueId: 'issue-b',
        relationType: 'blocks',
      });
    }
  });

  const scopedLinks = (db, projectIds) => query(
    collection(db, 'issueLinks'),
    where('organizationId', '==', 'org-a'),
    where('projectId', 'in', projectIds),
  );

  // The workspace only ever asks for links of projects it already resolved,
  // so this is the shape every hook has to keep using.
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const memberSnapshot = await assertSucceeds(getDocs(scopedLinks(memberDb, ['project-a'])));
  assert.equal(memberSnapshot.size, 2);

  // An owner sees both projects, and the unscoped query still has to work for
  // them — reading resource.data.projectId directly used to fail it outright.
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const ownerSnapshot = await assertSucceeds(getDocs(query(
    collection(ownerDb, 'issueLinks'),
    where('organizationId', '==', 'org-a'),
  )));
  assert.equal(ownerSnapshot.size, 3);

  // Scoping is still enforced: a member cannot widen the query to a project
  // whose team they are not on.
  await assertFails(getDocs(scopedLinks(memberDb, ['project-a', 'project-locked'])));
  await assertFails(getDocs(query(
    collection(environment.authenticatedContext('member-offteam').firestore(), 'issueLinks'),
    where('organizationId', '==', 'org-a'),
    where('projectId', 'in', ['project-a']),
  )));
});

test('project-scoped data follows live team membership while admins retain access', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', 'scoped-project'), {
      organizationId: 'org-a',
      name: 'Scoped project',
      status: 'active',
      team: ['member-a'],
    });
    await setDoc(doc(db, 'projects', 'scoped-project', 'messages', 'message-a'), {
      senderId: 'member-a',
      text: 'Scoped message',
    });
    await setDoc(doc(db, 'issues', 'scoped-issue'), {
      organizationId: 'org-a',
      projectId: 'scoped-project',
      title: 'Scoped issue',
      type: 'task',
    });
    await setDoc(doc(db, 'issues', 'scoped-issue', 'comments', 'comment-a'), {
      authorId: 'member-a',
      text: 'Scoped comment',
    });
    await setDoc(doc(db, 'issues', 'scoped-issue', 'audit', 'audit-a'), {
      userId: 'member-a',
      action: 'created',
    });
    await setDoc(doc(db, 'stages', 'scoped-stage'), {
      projectId: 'scoped-project',
      title: 'Scoped stage',
    });
    await setDoc(doc(db, 'stages', 'scoped-stage', 'materials', 'material-a'), {
      title: 'Scoped material',
    });
    await setDoc(doc(db, 'issueLinks', 'scoped-link'), {
      schemaVersion: 2,
      organizationId: 'org-a',
      projectId: 'scoped-project',
      sourceIssueId: 'scoped-issue',
      targetIssueId: 'scoped-issue-b',
      relationType: 'relates-to',
    });
  });

  const offTeamDb = environment.authenticatedContext('member-offteam').firestore();
  const teamDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const issueRef = db => doc(db, 'issues', 'scoped-issue');
  const commentRef = db => doc(db, 'issues', 'scoped-issue', 'comments', 'comment-a');
  const auditRef = db => doc(db, 'issues', 'scoped-issue', 'audit', 'audit-a');
  const stageRef = db => doc(db, 'stages', 'scoped-stage');
  const materialRef = db => doc(db, 'stages', 'scoped-stage', 'materials', 'material-a');
  const linkRef = db => doc(db, 'issueLinks', 'scoped-link');
  const messageRef = db => doc(db, 'projects', 'scoped-project', 'messages', 'message-a');

  await assertFails(getDoc(issueRef(offTeamDb)));
  await assertFails(getDocs(query(
    collection(offTeamDb, 'issues'),
    where('organizationId', '==', 'org-a'),
    where('projectId', '==', 'scoped-project'),
  )));
  await assertFails(updateDoc(issueRef(offTeamDb), { title: 'Forbidden' }));
  await assertFails(getDoc(commentRef(offTeamDb)));
  await assertFails(getDoc(auditRef(offTeamDb)));
  await assertFails(getDoc(stageRef(offTeamDb)));
  await assertFails(updateDoc(stageRef(offTeamDb), { title: 'Forbidden' }));
  await assertFails(getDoc(materialRef(offTeamDb)));
  await assertFails(updateDoc(materialRef(offTeamDb), { title: 'Forbidden' }));
  await assertFails(getDoc(linkRef(offTeamDb)));
  await assertFails(getDoc(messageRef(offTeamDb)));
  await assertFails(setDoc(
    doc(offTeamDb, 'projects', 'scoped-project', 'messages', 'message-b'),
    { senderId: 'member-offteam', text: 'Forbidden' },
  ));

  await assertSucceeds(getDoc(issueRef(teamDb)));
  await assertSucceeds(getDocs(query(
    collection(teamDb, 'issues'),
    where('organizationId', '==', 'org-a'),
    where('projectId', '==', 'scoped-project'),
  )));
  await assertSucceeds(updateDoc(issueRef(teamDb), { title: 'Team edit' }));
  await assertSucceeds(getDoc(commentRef(teamDb)));
  await assertSucceeds(getDoc(auditRef(teamDb)));
  await assertSucceeds(getDoc(stageRef(teamDb)));
  await assertSucceeds(updateDoc(stageRef(teamDb), { title: 'Team stage edit' }));
  await assertSucceeds(getDoc(materialRef(teamDb)));
  await assertSucceeds(updateDoc(materialRef(teamDb), { title: 'Team material edit' }));
  await assertSucceeds(getDoc(linkRef(teamDb)));
  await assertSucceeds(getDoc(messageRef(teamDb)));
  await assertSucceeds(getDoc(issueRef(adminDb)));
  await assertSucceeds(getDoc(issueRef(ownerDb)));
});

test('projectless issues are restricted to organization owners and admins', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'issues', 'projectless-issue'), {
      organizationId: 'org-a',
      projectId: null,
      title: 'Projectless issue',
      type: 'task',
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();

  await assertFails(getDoc(doc(memberDb, 'issues', 'projectless-issue')));
  await assertFails(updateDoc(doc(memberDb, 'issues', 'projectless-issue'), {
    title: 'Forbidden',
  }));
  await assertSucceeds(getDoc(doc(adminDb, 'issues', 'projectless-issue')));
  await assertSucceeds(getDoc(doc(ownerDb, 'issues', 'projectless-issue')));
  await assertSucceeds(updateDoc(doc(ownerDb, 'issues', 'projectless-issue'), {
    title: 'Owner edit',
  }));
});

test('project reads are gated by team membership for plain members', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', 'project-team'), {
      organizationId: 'org-a', name: 'Team Project', status: 'active', team: ['member-a'],
    });
    await setDoc(doc(db, 'projects', 'project-foreign'), {
      organizationId: 'org-a', name: 'Foreign Project', status: 'active', team: ['owner-a'],
    });
    await setDoc(doc(db, 'projects', 'project-legacy'), {
      organizationId: 'org-a', name: 'Legacy Project', status: 'active',
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();

  // A plain member may read only projects whose `team` contains them…
  await assertSucceeds(getDoc(doc(memberDb, 'projects', 'project-team')));
  await assertFails(getDoc(doc(memberDb, 'projects', 'project-foreign')));
  // …and a legacy project with no `team` field is invisible until backfilled.
  await assertFails(getDoc(doc(memberDb, 'projects', 'project-legacy')));
  await assertSucceeds(getDoc(doc(memberDb, 'projects', 'project-a')));

  // Owners and admins see every project regardless of team membership.
  await assertSucceeds(getDoc(doc(adminDb, 'projects', 'project-foreign')));
  await assertSucceeds(getDoc(doc(adminDb, 'projects', 'project-a')));
  await assertSucceeds(getDoc(doc(ownerDb, 'projects', 'project-foreign')));
});

test('a member on no project team gets an empty project list and cannot query all issues', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', 'proj-owner-only'), {
      organizationId: 'org-a', name: 'Owner Only', status: 'active', team: ['owner-a'],
    });
  });
  const memberDb = environment.authenticatedContext('member-offteam').firestore();
  await assertSucceeds(getDocs(query(
    collection(memberDb, 'projects'),
    where('organizationId', '==', 'org-a'),
    where('team', 'array-contains', 'member-offteam'),
  )));
  await assertFails(getDocs(query(
    collection(memberDb, 'issues'),
    where('organizationId', '==', 'org-a'),
  )));
});

// users/{uid}/private/qtplus holds a sealed QuickTeam+ refresh token. It is
// written only by the Admin SDK in /api/integrations/qtplus/*, and is denied to
// every client — including the account's own owner, who has no use for it.
test('the sealed QuickTeam+ token is unreachable even for the account owner', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertFails(getDoc(doc(db, 'users', 'member-a', 'private', 'qtplus')));
  await assertFails(setDoc(doc(db, 'users', 'member-a', 'private', 'qtplus'), { qtUserId: 'x' }));
  await assertFails(deleteDoc(doc(db, 'users', 'member-a', 'private', 'qtplus')));
});

test('the sealed QuickTeam+ token is unreachable for anyone else', async () => {
  const db = environment.authenticatedContext('admin-a').firestore();
  await assertFails(getDoc(doc(db, 'users', 'member-a', 'private', 'qtplus')));
  await assertFails(setDoc(doc(db, 'users', 'member-a', 'private', 'qtplus'), { qtUserId: 'x' }));
});

test('YouTrack import queues and external identity tables are server-only', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'imports', 'import-a'), { organizationId: 'org-a', provider: 'youtrack' });
    await setDoc(doc(db, 'imports', 'import-a', 'items', '00000000'), { status: 'pending' });
    await setDoc(doc(db, 'externalObjectLinks', 'link-a'), { organizationId: 'org-a' });
    await setDoc(doc(db, 'externalActors', 'actor-a'), { organizationId: 'org-a' });
  });
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  await assertFails(getDoc(doc(ownerDb, 'imports', 'import-a')));
  await assertFails(getDoc(doc(ownerDb, 'imports', 'import-a', 'items', '00000000')));
  await assertFails(getDoc(doc(ownerDb, 'externalObjectLinks', 'link-a')));
  await assertFails(getDoc(doc(ownerDb, 'externalActors', 'actor-a')));
  await assertFails(setDoc(doc(ownerDb, 'imports', 'forged'), { organizationId: 'org-a' }));
});

test('locking users/{uid}/private did not lock users/{uid}/settings', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(setDoc(doc(db, 'users', 'member-a', 'settings', 'prefs'), { theme: 'dark' }));
  await assertSucceeds(getDoc(doc(db, 'users', 'member-a', 'settings', 'prefs')));
});

// The QuickTeam+ personal card gates on this flag, so members must be able to
// read it; flipping it is an admin decision. No rule was added for this — the
// existing organizations/{orgId}/settings rule already says exactly that, and
// this test is here to keep it true.
test('a member reads the QuickTeam+ org flag but cannot flip it', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'organizations', 'org-a', 'settings', 'integrations')));
  await assertFails(setDoc(doc(memberDb, 'organizations', 'org-a', 'settings', 'integrations'), {
    qtPortalEnabled: true,
  }));
});

test('an org admin can flip the QuickTeam+ org flag', async () => {
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'organizations', 'org-a', 'settings', 'integrations'), {
    qtPortalEnabled: true,
  }));
});

test('workflow settings are readable and writable only through the role-filtered server API', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(
      doc(context.firestore(), 'organizations', 'org-a', 'settings', 'workflow'),
      { statuses: [{ id: 'backlog', label: 'Беклог' }] },
    );
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const workflowPath = ['organizations', 'org-a', 'settings', 'workflow'];

  await assertFails(getDoc(doc(memberDb, ...workflowPath)));
  await assertFails(getDoc(doc(adminDb, ...workflowPath)));
  await assertFails(setDoc(doc(memberDb, ...workflowPath), {
    statuses: [{ id: 'done', label: 'Готово', isDone: true }],
  }));
  await assertFails(setDoc(doc(adminDb, ...workflowPath), {
    statuses: [{ id: 'done', label: 'Готово', isDone: true }],
  }));
});

test('an outsider cannot read the QuickTeam+ org flag', async () => {
  const db = environment.authenticatedContext('outsider').firestore();
  await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'settings', 'integrations')));
});

test('a DM participant reads their own room and its messages', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext(DM_A).firestore();
  await assertSucceeds(getDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM)));
  await assertSucceeds(getDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'm1')));
});

test('another org member cannot read someone else\'s DM room or its messages', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext('member-a').firestore();
  await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM)));
  await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'm1')));
  await assertFails(getDocs(collection(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages')));
  await assertFails(getDocs(collection(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'm1', 'replies')));
});

// Documented residual exposure: a query cannot be gated per document because
// the {channelId} wildcard is unbound during `list`, so the room documents
// themselves stay enumerable. That is only safe while they carry no message
// text — this test pins the invariant that keeps it safe.
test('DM room documents never carry a message preview', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext(DM_A).firestore();
  await assertSucceeds(setDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM), {
    lastMessageAt: new Date(), lastMessageSenderId: DM_A, messageCount: 2,
  }, { merge: true }));
  // Writing content onto the enumerable room document is rejected.
  await assertFails(setDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM), {
    lastMessageText: 'секрет',
  }, { merge: true }));
});

// A room written by the OLD client already holds a preview. Rejecting every
// write whose *result* still contains it would lock those rooms up entirely —
// including the typing heartbeat — the moment these rules ship.
test('a legacy DM room carrying an old preview is not bricked by the new rule', async () => {
  await seedDirectRoomMembers();
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'organizations', 'org-a', 'channels', DM_ROOM), {
      name: 'DM', type: 'dm', messageCount: 3,
      lastMessageText: 'написано старим клієнтом', lastMessageSender: 'Хтось',
    });
  });
  const db = environment.authenticatedContext(DM_A).firestore();
  const room = doc(db, 'organizations', 'org-a', 'channels', DM_ROOM);

  // Writes that leave the inherited field alone still go through.
  await assertSucceeds(updateDoc(room, { typing: [DM_A], typingAt: { [DM_A]: 1 } }));
  // And the client can purge the inherited preview.
  await assertSucceeds(updateDoc(room, {
    lastMessageAt: new Date(),
    lastMessageSenderId: DM_A,
    lastMessageText: deleteField(),
    lastMessageSender: deleteField(),
  }));
  // Once purged, re-introducing content is refused.
  await assertFails(updateDoc(room, { lastMessageText: 'знову секрет' }));
});

test('an org admin cannot read a DM they are not part of', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext('admin-a').firestore();
  await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM)));
  await assertFails(getDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM, 'messages', 'm1')));
  await assertFails(deleteDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM)));
});

test('channel listing still works for members', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext('member-a').firestore();
  const channels = collection(db, 'organizations', 'org-a', 'channels');
  await assertSucceeds(getDocs(query(channels)));
  await assertSucceeds(getDocs(query(channels, where('type', '==', 'public'))));
});

test('a DM room cannot be created for a pair the caller is not in', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(doc(db, 'organizations', 'org-a', 'channels', `${DM_A}_${DM_C}`), {
    name: 'DM', type: 'dm', participants: [DM_A, DM_C],
  }));
});

test('participants can never name anyone outside the pair encoded in the room id', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext(DM_A).firestore();
  await assertFails(updateDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM), {
    participants: [DM_A, DM_B, 'member-a'],
  }));
  await assertSucceeds(updateDoc(doc(db, 'organizations', 'org-a', 'channels', DM_ROOM), {
    participants: [DM_A, DM_B],
  }));
});

test('a member still reads and posts in public channels', async () => {
  await seedDirectRoom();
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'organizations', 'org-a', 'channels', 'general')));
  await assertSucceeds(getDocs(collection(db, 'organizations', 'org-a', 'channels', 'general', 'messages')));
  await assertSucceeds(setDoc(doc(db, 'organizations', 'org-a', 'channels', 'general', 'messages', 'new'), {
    senderId: 'member-a', text: 'привіт',
  }));
});

test('legacy project_* and numeric rooms are not mistaken for DM rooms', async () => {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', 'org-a', 'channels', 'project_alpha'), {
      name: 'project alpha', type: 'public',
    });
  });
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'organizations', 'org-a', 'channels', 'project_alpha')));
});

test('a member may refresh the typing heartbeat but not rewrite a channel', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  const channel = doc(db, 'organizations', 'org-a', 'channels', 'general');
  await assertSucceeds(updateDoc(channel, { typing: ['member-a'], typingAt: { 'member-a': 1 } }));
  await assertFails(updateDoc(channel, { name: 'hijacked' }));
});
