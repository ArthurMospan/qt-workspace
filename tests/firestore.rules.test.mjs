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
    await setDoc(doc(db, 'orgMemberships', 'org-a_owner-a'), {
      id: 'org-a_owner-a', orgId: 'org-a', userId: 'owner-a', role: 'owner',
    });
    await setDoc(doc(db, 'orgMemberships', 'org-a_admin-a'), {
      id: 'org-a_admin-a', orgId: 'org-a', userId: 'admin-a', role: 'admin',
    });
    await setDoc(doc(db, 'orgMemberships', 'org-a_member-a'), {
      id: 'org-a_member-a', orgId: 'org-a', userId: 'member-a', role: 'member',
    });
    await setDoc(doc(db, 'projects', 'project-a'), {
      organizationId: 'org-a', name: 'Project A', issueCounter: 1, status: 'active',
    });
    await setDoc(doc(db, 'issues', 'issue-a'), {
      organizationId: 'org-a', projectId: 'project-a', title: 'Issue A',
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

test('only owner or admin can delete an issue', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  await assertFails(deleteDoc(doc(memberDb, 'issues', 'issue-a')));
  await assertSucceeds(deleteDoc(doc(adminDb, 'issues', 'issue-a')));
});

test('members cannot create or manage sprints', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const sprint = { organizationId: 'org-a', name: 'Sprint 1', status: 'planned' };
  await assertFails(setDoc(doc(memberDb, 'sprints', 'sprint-a'), sprint));
  await assertSucceeds(setDoc(doc(adminDb, 'sprints', 'sprint-a'), sprint));
});

test('a member can create only their own time log and cannot edit another user log', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(setDoc(doc(db, 'timeLogs', 'member-log'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
    userId: 'member-a', spentMinutes: 15,
  }));
  await assertFails(setDoc(doc(db, 'timeLogs', 'forged-log'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
    userId: 'owner-a', spentMinutes: 999,
  }));
  await assertFails(updateDoc(doc(db, 'timeLogs', 'log-owner'), { spentMinutes: 999 }));
});

test('calendar time logs keep their event occurrence identity', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  const ref = doc(db, 'timeLogs', 'calendar-log');
  await assertSucceeds(setDoc(ref, {
    organizationId: 'org-a',
    projectId: 'project-a',
    issueId: '',
    eventId: 'event-a',
    occurrenceStartAt: '2026-07-25T09:00:00.000Z',
    sourceType: 'calendar_event',
    userId: 'member-a',
    spentMinutes: 45,
  }));
  await assertSucceeds(updateDoc(ref, { spentMinutes: 50 }));
  await assertFails(updateDoc(ref, { eventId: 'event-b' }));
  await assertFails(updateDoc(ref, { occurrenceStartAt: '2026-07-26T09:00:00.000Z' }));
});

test('authors can delete their own comments but not another authors comments', async () => {
  const db = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(deleteDoc(doc(db, 'issues', 'issue-a', 'comments', 'member-comment')));
  await assertFails(deleteDoc(doc(db, 'issues', 'issue-a', 'comments', 'owner-comment')));
});

test('users can delete their own time logs but not another users logs', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  await assertSucceeds(setDoc(doc(memberDb, 'timeLogs', 'member-log-delete'), {
    organizationId: 'org-a', projectId: 'project-a', issueId: 'issue-a',
    userId: 'member-a', spentMinutes: 10,
  }));
  await assertSucceeds(deleteDoc(doc(memberDb, 'timeLogs', 'member-log-delete')));
  await assertFails(deleteDoc(doc(memberDb, 'timeLogs', 'log-owner')));
});

test('invoices are owner-only', async () => {
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();
  const invoice = { organizationId: 'org-a', projectId: 'project-a', total: 100 };
  await assertFails(setDoc(doc(memberDb, 'invoices', 'invoice-a'), invoice));
  await assertSucceeds(setDoc(doc(ownerDb, 'invoices', 'invoice-a'), invoice));
  assert.ok(true);
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
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  const adminDb = environment.authenticatedContext('admin-a').firestore();
  const ownerDb = environment.authenticatedContext('owner-a').firestore();

  // A plain member may read only projects whose `team` contains them…
  await assertSucceeds(getDoc(doc(memberDb, 'projects', 'project-team')));
  await assertFails(getDoc(doc(memberDb, 'projects', 'project-foreign')));
  // …and a legacy project with no `team` field is invisible until backfilled.
  await assertFails(getDoc(doc(memberDb, 'projects', 'project-a')));

  // Owners and admins see every project regardless of team membership.
  await assertSucceeds(getDoc(doc(adminDb, 'projects', 'project-foreign')));
  await assertSucceeds(getDoc(doc(adminDb, 'projects', 'project-a')));
  await assertSucceeds(getDoc(doc(ownerDb, 'projects', 'project-foreign')));
});

test('a member on NO project team can still load the workspace without a permission error', async () => {
  // Reproduces the reported "invited member" case: valid org member, added to
  // no project. Their team-scoped projects query must return empty (not denied),
  // and the org-wide issues query the home page runs must be allowed.
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', 'proj-owner-only'), {
      organizationId: 'org-a', name: 'Owner Only', status: 'active', team: ['owner-a'],
    });
  });
  const memberDb = environment.authenticatedContext('member-a').firestore();
  // Team-scoped projects query (what the client runs for a member) → empty, allowed.
  await assertSucceeds(getDocs(query(
    collection(memberDb, 'projects'),
    where('organizationId', '==', 'org-a'),
    where('team', 'array-contains', 'member-a'),
  )));
  // Org-wide issues query (workspace home) → allowed for any org member.
  await assertSucceeds(getDocs(query(
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
