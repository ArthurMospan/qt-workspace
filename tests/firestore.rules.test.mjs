import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  await assertSucceeds(updateDoc(
    doc(ownerDb, 'organizations', 'org-a', 'channels', 'general', 'messages', 'owner-message'),
    { text: 'Edited by owner' },
  ));
  await assertFails(setDoc(doc(memberDb, 'organizations', 'org-a', 'channels', 'unauthorized'), {
    name: 'unauthorized', type: 'public',
  }));
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
