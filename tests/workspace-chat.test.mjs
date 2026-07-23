import test from 'node:test';
import assert from 'node:assert/strict';
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
