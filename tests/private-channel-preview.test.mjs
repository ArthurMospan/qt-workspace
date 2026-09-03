import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A channel with a `members` list is that list's room, and the rules now say
// so for everything under messages/. The room document itself stays listable
// by the whole organization — a query cannot be filtered per document — so the
// text must not be on it: sendMessage keeps a restricted room's preview off the
// document the way it already does for a DM, and purges an old one as the
// conversation continues.
test('sendMessage writes no preview onto a members-only room', async () => {
  const hook = await readFile(new URL('../src/lib/hooks/useWorkspaceChat.js', import.meta.url), 'utf8');
  const send = hook.slice(hook.indexOf('const sendMessage = async'), hook.indexOf('batch.set(channelRef, channelMetadata'));
  assert.match(send, /const room = channels\.find\(channel => channel\.id === channelId\)/);
  assert.match(send, /const restricted = Array\.isArray\(room\?\.members\) && room\.members\.length > 0/);
  assert.match(send, /if \(restricted\) \{\s*channelMetadata\.lastMessageText = deleteField\(\);\s*channelMetadata\.lastMessageSender = deleteField\(\);/);
  // A public room still carries its preview.
  assert.match(send, /\} else \{\s*channelMetadata\.lastMessageText = text\.trim\(\)\.slice\(0, 80\);/);
});

test('the rules gate a members-only room’s content and the sidebar predicate agrees', async () => {
  const [rules, predicate] = await Promise.all([
    readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/utils/workspaceChat.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(rules, /function restrictedTo\(room\) \{\s*return room\.get\('members', \[\]\) is list && room\.get\('members', \[\]\)\.size\(\) > 0;/);
  assert.match(rules, /function roomOpenTo\(room\) \{\s*return !restrictedTo\(room\) \|\| request\.auth\.uid in room\.get\('members', \[\]\);/);
  assert.match(rules, /allow get: if canAccessRoom\(\) && roomOpenTo\(resource\.data\);/);
  // The channels block's own messages match, not the project chat's above it.
  const messages = rules.slice(rules.lastIndexOf('match /messages/{msgId}'), rules.indexOf('match /organizations/{orgId}/readState'));
  assert.doesNotMatch(messages, /canAccessRoom\(\)/);
  assert.equal((messages.match(/canAccessRoomContent\(\)/g) || []).length, 8);
  // The same shape the sidebar hides by.
  assert.match(predicate, /!Array\.isArray\(channel\.members\)\s*\|\| channel\.members\.length === 0/);
});
