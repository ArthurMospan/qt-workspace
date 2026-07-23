import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatAttachmentKind,
  collectChatAttachments,
  formatChatFileSize,
  messageMatchesChatSearch,
} from '../src/lib/utils/chatAttachments.mjs';
import {
  channelUnreadCount,
  directMessageRoomId,
  isVisibleChatChannel,
} from '../src/lib/utils/workspaceChat.mjs';

const ts = value => ({ toMillis: () => value });

test('builds one stable DM room id for both participants', () => {
  assert.equal(directMessageRoomId('user_b', 'user_a'), directMessageRoomId('user_a', 'user_b'));
  assert.equal(directMessageRoomId('user_b', 'user_a'), 'user_a_user_b');
});

test('keeps DM documents out of public channels and scopes them to participants', () => {
  const dm = { id: 'a_b', type: 'dm', participants: ['a', 'b'] };
  assert.equal(isVisibleChatChannel(dm, 'a'), true);
  assert.equal(isVisibleChatChannel(dm, 'c'), false);
  assert.equal(isVisibleChatChannel({ ...dm, type: 'public', name: 'team' }, 'c'), true);
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
