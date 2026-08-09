import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  chatAttachmentKind,
  collectChatAttachments,
  formatChatFileSize,
  messageMatchesChatSearch,
} from '../src/lib/utils/chatAttachments.mjs';
import {
  activeTypingUserIds,
  channelIdFromName,
  channelUnreadCount,
  directMessageRoomId,
  directRoomParticipants,
  isDirectRoomId,
  isVisibleChatChannel,
} from '../src/lib/utils/workspaceChat.mjs';

const ts = value => ({ toMillis: () => value });
// Firebase Auth uids are 28 alphanumeric characters; DM room ids are two of
// them joined by '_', which is what both the client and firestore.rules match.
const UID_A = 'Aa1bb2cc3dd4ee5ff6gg7hh8ii9j';
const UID_B = 'Zz9yy8xx7ww6vv5uu4tt3ss2rr1q';
const UID_C = 'Mm5nn4oo3pp2qq1rr0ss9tt8uu7v';

test('builds one stable DM room id for both participants', () => {
  assert.equal(directMessageRoomId(UID_B, UID_A), directMessageRoomId(UID_A, UID_B));
  assert.equal(directMessageRoomId(UID_B, UID_A), `${UID_A}_${UID_B}`);
});

test('recognises DM room ids by shape and never a human channel slug', () => {
  assert.equal(isDirectRoomId(directMessageRoomId(UID_A, UID_B)), true);
  assert.deepEqual(directRoomParticipants(directMessageRoomId(UID_A, UID_B)), [UID_A, UID_B]);
  // Legacy and human rooms must stay org-visible, otherwise the scoped query
  // and the rules disagree and the whole listing fails.
  for (const id of ['general', 'project_alpha', 'design', '11', 'back-end']) {
    assert.equal(isDirectRoomId(id), false, id);
    assert.deepEqual(directRoomParticipants(id), [], id);
  }
});

test('keeps DM documents out of public channels and scopes them to participants', () => {
  const id = directMessageRoomId(UID_A, UID_B);
  const dm = { id, type: 'dm', participants: [UID_A, UID_B] };
  assert.equal(isVisibleChatChannel(dm, UID_A), true);
  assert.equal(isVisibleChatChannel(dm, UID_C), false);
  // A forged `participants` array cannot widen access — the id is authoritative.
  assert.equal(isVisibleChatChannel({ ...dm, participants: [UID_A, UID_B, UID_C] }, UID_C), false);
  // Nor can mislabelling a DM room as public expose it.
  assert.equal(isVisibleChatChannel({ ...dm, type: 'public', name: 'team' }, UID_C), false);
});

test('channel slugs never collide with DM room ids or illegal document ids', () => {
  assert.equal(channelIdFromName('  Back End  '), 'back-end');
  // '_' is reserved for DM ids and '/' is illegal in a document id.
  assert.equal(channelIdFromName('front_back'), 'front-back');
  assert.equal(channelIdFromName('front/back'), 'front-back');
  assert.equal(channelIdFromName('Дизайн Команди'), 'дизайн-команди');
  assert.equal(channelIdFromName('---'), '');
  assert.equal(channelIdFromName('///'), '');
  assert.equal(channelIdFromName(null), '');
  assert.equal(isDirectRoomId(channelIdFromName(`${UID_A} ${UID_B}`)), false);
});

test('typing flags expire so a crashed tab cannot pin the indicator', () => {
  const channel = { typing: [UID_A, UID_B], typingAt: { [UID_A]: 1_000, [UID_B]: 9_000 } };
  assert.deepEqual(activeTypingUserIds(channel, { now: 10_000, ttlMs: 8000 }), [UID_B]);
  assert.deepEqual(activeTypingUserIds(channel, { now: 10_000, ttlMs: 8000, exclude: UID_B }), []);
  // Documents written before `typingAt` existed carry no heartbeat.
  assert.deepEqual(activeTypingUserIds({ typing: [UID_A] }, { now: 10_000 }), []);
});

test('counts tracked unread messages and ignores own latest message', () => {
  const channel = { lastMessageAt: ts(20), messageCount: 7, lastMessageSenderId: 'other' };
  assert.equal(channelUnreadCount(channel, { lastReadAt: ts(10), messageCount: 4 }, 'me'), 3);
  assert.equal(channelUnreadCount({ ...channel, lastMessageSenderId: 'me' }, null, 'me'), 0);
});

test('chat attachment kind supports MIME types and URL extensions', () => {
  assert.equal(chatAttachmentKind({ type: 'image/png' }), 'image');
  assert.equal(chatAttachmentKind({ resourceType: 'video' }), 'video');
  assert.equal(chatAttachmentKind({ url: 'https://cdn.test/file.pdf?download=1' }), 'pdf');
  assert.equal(chatAttachmentKind({ name: 'notes.docx' }), 'file');
});

test('chat search finds text, author, and attachment names', () => {
  const message = {
    text: 'Оновив дизайн',
    user: 'Артур',
    attachments: [{ name: 'homepage-final.png', type: 'image/png' }],
  };
  assert.equal(messageMatchesChatSearch(message, 'дизайн'), true);
  assert.equal(messageMatchesChatSearch(message, 'артур'), true);
  assert.equal(messageMatchesChatSearch(message, 'homepage'), true);
  assert.equal(messageMatchesChatSearch(message, 'invoice'), false);
});

test('collectChatAttachments keeps message context and skips broken records', () => {
  const attachments = collectChatAttachments([
    {
      id: 'm1',
      user: 'Arthur',
      attachments: [
        { name: 'screen.png', url: 'https://cdn.test/screen.png' },
        { name: 'missing.txt' },
      ],
    },
  ]);
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].messageId, 'm1');
  assert.equal(attachments[0].senderName, 'Arthur');
});

test('formatChatFileSize produces readable labels', () => {
  assert.equal(formatChatFileSize(1024), '1.0 КБ');
  assert.equal(formatChatFileSize(5 * 1024 * 1024), '5.0 МБ');
  assert.equal(formatChatFileSize(undefined), '');
});

test('chat autocompletes and opens stable issue-key mentions', async () => {
  const [page, menu, content, hoverCard] = await Promise.all([
    readFile(new URL('../src/app/(app)/chat/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/Chat/IssueMentionMenu.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/workspace/MessageContent.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/workspace/HoverCard.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /matchIssue = before\.match\(/);
  assert.match(page, /searchIssues\(queryText, activeOrgId\)/);
  assert.match(page, /`\$\{before\}#\$\{issue\.issueKey\} \$\{after\}`/);
  assert.match(page, /<IssueMentionMenu/);
  assert.match(menu, /issue\.issueKey/);
  assert.ok(content.includes('|#[\\\\p{L}\\\\p{N}-]+|'));
  assert.match(hoverCard, /router\.push\(issuePath\(data\)\)/);
  assert.match(hoverCard, /legacyStoredIssueKey\(value, expectedProject\)/);
});

// A conversation opens showing its newest message. It does not scroll to it.
//
// Measured on the running app before this change: the list rendered at
// scrollTop 0 and animated 363px down over 10 frames — the visible "my chats
// are scrolling themselves" the report described. After: the first frame in
// which the list was scrollable was already at the bottom, and none of the 303
// sampled frames sat off it.
test('the chat places itself at the latest message instead of scrolling to it', async () => {
  const page = await readFile(new URL('../src/app/(app)/chat/page.js', import.meta.url), 'utf8');

  // Before the paint, not after it.
  assert.match(page, /useLayoutEffect\(\(\) => \{\s*\r?\n\s*const count = messages\.length;/);
  // Smooth is reserved for a message arriving in a conversation you are already
  // sitting in; landing in one is instant.
  assert.match(page, /behavior: isInitialPlacement \|\| count <= 1 \? 'instant' : 'smooth'/);
  assert.match(page, /const isInitialPlacement = !initialScrollDoneRef\.current;/);
  // Switching conversation re-arms the placement rather than firing a second,
  // delayed correction that raced the first.
  assert.match(page, /initialScrollDoneRef\.current = false;/);
  assert.doesNotMatch(page, /setTimeout\(\(\) => \{\s*\r?\n\s*messagesEndRef\.current\?\.scrollIntoView/);

  // The thread panel opens the same way.
  assert.match(page, /useLayoutEffect\(\(\) => \{\s*\r?\n\s*if \(scrollRef\.current\) \{/);

  // And an image that decodes after the list was placed re-pins the bottom,
  // which needs one observable box around the messages.
  const list = await readFile(
    new URL('../src/components/ui/Chat/ChatMessageList.jsx', import.meta.url),
    'utf8',
  );
  assert.match(list, /<div ref=\{contentRef\}>/);
  assert.match(page, /observer\.observe\(chatContentRef\.current\)/);
});
