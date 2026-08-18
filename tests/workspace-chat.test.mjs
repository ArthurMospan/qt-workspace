import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  chatAttachmentKind,
  chatAttachmentNames,
  collectChatAttachments,
  formatChatFileSize,
  messageMatchesChatSearch,
} from '../src/lib/utils/chatAttachments.mjs';
import {
  attachmentKind,
  attachmentKindLabel,
  formatMediaTime,
  isMediaKind,
  isVisualKind,
} from '../src/lib/utils/attachmentKinds.mjs';
import {
  activeTypingUserIds,
  canAccessChatChannel,
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
});

// The chat and the task surface answer "what is this file" with one resolver,
// so this list is the contract for both. Office's own MIME types are the reason
// the map exists: nothing about `…spreadsheetml.sheet` says «таблиця», and a
// raw upload arrives as application/octet-stream with only its name to go on.
test('attachment kinds cover the families a workspace actually receives', () => {
  assert.equal(attachmentKind({ name: 'notes.docx' }), 'doc');
  assert.equal(attachmentKind({ name: 'кошторис.xlsx' }), 'sheet');
  assert.equal(attachmentKind({ name: 'звіт.csv' }), 'sheet');
  assert.equal(attachmentKind({ name: 'deck.pptx' }), 'slides');
  assert.equal(attachmentKind({ name: 'макети.zip' }), 'archive');
  assert.equal(attachmentKind({ name: 'schema.json' }), 'code');
  assert.equal(attachmentKind({ name: 'нотатки.txt' }), 'text');
  assert.equal(attachmentKind({ name: 'дзвінок.m4a' }), 'audio');
  assert.equal(attachmentKind({ name: 'дамп.bin' }), 'file');
  assert.equal(
    attachmentKind({ mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'sheet',
  );
  // The declared type wins over the name, and a query string is not an extension.
  assert.equal(attachmentKind({ name: 'report.pdf', mimeType: 'image/png' }), 'image');
  assert.equal(attachmentKind({ url: 'https://cdn.test/a/b?name=x.zip' }), 'file');
});

test('a kind knows what it is called and how it may be shown', () => {
  assert.equal(attachmentKindLabel('sheet'), 'Таблиця');
  assert.equal(attachmentKindLabel('nonsense'), 'Файл');
  // «Медіа» in the channel filter means image, video or audio — not "anything
  // with a preview", which would have swept PDFs in with the photos.
  assert.equal(isMediaKind('audio'), true);
  assert.equal(isMediaKind('pdf'), false);
  assert.equal(isVisualKind('video'), true);
  assert.equal(isVisualKind('audio'), false);
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

test('a pinned file is listed by name, not as the word «Вкладення»', async () => {
  // «Вкладення» is the one thing every such message has in common, so it told
  // the reader nothing: three pinned files were three identical lines.
  assert.equal(
    chatAttachmentNames([{ name: 'kosторис-Q3.xlsx' }, { name: 'brief.pdf' }]),
    'kosторис-Q3.xlsx, brief.pdf',
  );
  // A record with no name of its own still says what kind of thing it is.
  assert.equal(chatAttachmentNames([{ type: 'image/png' }]), 'Зображення');
  assert.equal(chatAttachmentNames([]), '');
  assert.equal(chatAttachmentNames(undefined), '');

  const panel = await readFile(new URL('../src/components/ui/Chat/ChannelInfoPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /chatAttachmentNames\(message\.attachments\)/);
  assert.doesNotMatch(panel, /\? 'Вкладення'/);
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
  // Ukrainian decimal comma: the rest of the interface is Ukrainian and the
  // file size was the one number that said otherwise.
  assert.equal(formatChatFileSize(1024), '1,0 КБ');
  assert.equal(formatChatFileSize(5 * 1024 * 1024), '5,0 МБ');
  assert.equal(formatChatFileSize(undefined), '');
});

test('media time is clock-shaped and survives unknown durations', () => {
  assert.equal(formatMediaTime(0), '0:00');
  assert.equal(formatMediaTime(67), '1:07');
  assert.equal(formatMediaTime(3671), '1:01:11');
  // A browser reports NaN until it has read the metadata, and the player draws
  // that state on every card before the first byte arrives.
  assert.equal(formatMediaTime(NaN), '0:00');
});

test('private attachment delivery uses the same channel membership boundary', () => {
  const directId = directMessageRoomId(UID_A, UID_B);
  assert.equal(canAccessChatChannel({ id: directId, type: 'dm' }, UID_A), true);
  assert.equal(canAccessChatChannel({ id: directId, type: 'dm' }, UID_C), false);
  assert.equal(canAccessChatChannel({ id: 'general', type: 'public' }, UID_C), true);
  assert.equal(canAccessChatChannel({ id: 'design', members: [UID_A] }, UID_A), true);
  assert.equal(canAccessChatChannel({ id: 'design', members: [UID_A] }, UID_C), false);
});

test('chat autocompletes and opens stable issue-key mentions', async () => {
  const [page, menu, content, mentionChip, hoverCardChip] = await Promise.all([
    readFile(new URL('../src/app/(app)/chat/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/Chat/IssueMentionMenu.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/workspace/MessageContent.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/workspace/IssueMentionChip.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/workspace/HoverCard.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /matchIssue = before\.match\(/);
  assert.match(page, /`\$\{before\}#\$\{issue\.issueKey\} \$\{after\}`/);
  assert.match(page, /<IssueMentionMenu/);
  assert.match(menu, /issue\.issueKey/);
  // A mentioned task reads like a mentioned person: the same neutral chip, no
  // colour of its own. The magenta pill was the one place in the product where
  // a hue meant «this is a task».
  assert.doesNotMatch(menu, /tone="accent"/);
  assert.doesNotMatch(mentionChip, /#c026d3|#fdf4ff/);
  // One shape, defined once: a mentioned task and a mentioned person are the
  // same kind of thing to read past, so the chip is literally the same string
  // rather than two that happen to agree today.
  assert.match(mentionChip, /mentionChipClass \} from '\.\/HoverCard'/);
  assert.match(mentionChip, /className=\{mentionChipClass\(\{ dark \}\)\}/);
  assert.match(hoverCardChip, /export function mentionChipClass/);
  assert.match(hoverCardChip, /bg-black\/\[0\.06\]/);
  // The chip is an inline-block, and that is what makes the name in it sit on
  // the sentence's own baseline: an inline-block takes the baseline of the text
  // inside it. A flex chip has none to offer — its first item is a face — so the
  // browser synthesises one, and the sentence steps where anybody is named.
  assert.match(hoverCardChip, /relative inline-block whitespace-nowrap rounded-full/);
  assert.match(hoverCardChip, /align-baseline/);
  // Two things would silently take that baseline away again. Measured in the
  // browser: a line carrying a capsule is 22.75px, and 26.75px the instant that
  // capsule clips — so a long name is shortened as a string, by `useFittedLabel`
  // against the width the capsule really has, and never clipped as a box.
  assert.doesNotMatch(hoverCardChip, /mentionChipClass[\s\S]{0,400}overflow-hidden/);
  assert.match(hoverCardChip, /useFittedLabel\(fullName\)/);
  assert.match(mentionChip, /useFittedLabel\(fullTitle\)/);
  assert.match(hoverCardChip, /MENTION_CHIP_BADGE = 'absolute/);
  assert.match(hoverCardChip, /className="relative inline-block align-baseline"/);
  // `#` searches task numbers, not prose: typing 12 used to return every task
  // whose description happened to contain those characters.
  assert.match(page, /searchIssues\(queryText, activeOrgId, null, \{ mention: true \}\)/);
  // Only what *matched* is a mention or a task. `String.split` with a capturing
  // group hands back the text between the matches too, and deciding what a piece
  // is by its first character therefore turned «@ у чаті завдання» — a sentence
  // that matched nothing — into a capsule naming somebody called « у чаті завдання».
  assert.match(content, /tokenizeMessageLine\(line, \{ memberNames \}\)/);
  assert.doesNotMatch(content, /part\.startsWith\('@'\)/);
  // A mention is read where it was written: it opens the quick-view panel, not
  // a navigation out of the conversation you are having.
  //
  // A mentioned task says what it is called, so there is nothing to hover for:
  // the chip resolves the title once per key through the same call the picker
  // makes, and clicking it opens the quick-view panel.
  // …and it resolves that title with an exact-key lookup, never with search.
  // Search cannot know which documents match a word, so it reads every task,
  // project, membership and event in the organization; paying that per capsule
  // is what exhausted a day's read quota in an afternoon.
  assert.match(mentionChip, /\/api\/issues\/lookup\?/);
  assert.doesNotMatch(mentionChip, /api\/search/);
  assert.match(mentionChip, /openIssueQuickView\(issue\)/);
  assert.match(content, /<IssueMentionChip/);
  assert.doesNotMatch(mentionChip, /collection\(db, 'issues'\)/);
  // A lookup that could not be made is not an answer. Caching it meant a chat
  // opened before Firebase restored the session never resolved a mention again.
  assert.match(mentionChip, /resolved\.delete\(`\$\{organizationId\}:\$\{key\}`\)/);
});

test('a task chat reads back the task mentions its own composer writes', async () => {
  const [mentionText, timeline] = await Promise.all([
    readFile(new URL('../src/components/workspace/MentionText.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/workspace/UnifiedTimeline.jsx', import.meta.url), 'utf8'),
  ]);

  // The task composer has offered the `#` picker all along — and the message it
  // produced then showed the bare key, while the identical text in the
  // workspace chat showed the task's name.
  assert.match(timeline, /<IssueMentionMenu/);
  assert.match(mentionText, /<IssueMentionChip/);
  // Both chats read the same sentences, so both ask the same tokenizer rather
  // than carrying two copies of the rules that disagree about what a mention is.
  assert.match(mentionText, /tokenizeMessageLine\(text, \{ memberNames, formatting: false \}\)/);
  // The very same component, not a lookalike span. The retyped copy could not be
  // clicked, so a person named in a task chat had no profile behind their name
  // while the identical text in the workspace chat did.
  assert.match(mentionText, /<HoverCard\b/);
  assert.doesNotMatch(mentionText, /mentionChipClass/);
  // And it survives a dark bubble: an own message here is white on near-black,
  // where a black tint is invisible.
  assert.match(mentionText, /dark=\{dark\}/);
});

test('chat user suggestions require an at sign and message actions are keyboard reachable', async () => {
  const [page, bubble] = await Promise.all([
    readFile(new URL('../src/app/(app)/chat/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/Chat/MessageBubble.jsx', import.meta.url), 'utf8'),
  ]);

  assert.ok(page.includes('const matchUser = before.match(/(?:^|[\\s([{])([@])([^@\\n"]*)$/u);'));
  assert.doesNotMatch(page, /\(\[@"\]\)/);
  assert.match(bubble, /tabIndex=\{0\}/);
  assert.match(bubble, /onFocusCapture=\{\(\) => setShowActions\(true\)\}/);
  assert.match(bubble, /event\.currentTarget\.contains\(event\.relatedTarget\)/);
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

// A reply in a thread used to be invisible from outside that thread: nothing
// was notified, nothing on the message said it had happened, and the reader had
// to already be looking at the thread to find out. Somebody answering a question
// asked three messages ago simply never reached the person who asked it.
test('a reply in a thread reaches the people the thread belongs to', async () => {
  const [page, hook, bubble, list] = await Promise.all([
    readFile(new URL('../src/app/(app)/chat/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/hooks/useWorkspaceChat.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/Chat/MessageBubble.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/Chat/ChatMessageList.jsx', import.meta.url), 'utf8'),
  ]);

  // Whoever wrote the message, and whoever has answered it before — read off
  // the replies the pane already has open, so telling them costs no read.
  assert.match(page, /parent\.senderId,\s*\n\s*\.\.\.threadMessages\.map\(reply => reply\.senderId\)/);
  assert.match(page, /відповів у гілці/);
  assert.match(page, /згадав вас у гілці/);
  // A mention is the stronger thing, so nobody is told twice about one reply.
  assert.match(page, /followers\.filter\(userId => !mentioned\.includes\(userId\)\)/);
  // And the alert lands in the thread itself, not merely in the channel.
  assert.match(page, /&thread=\$\{encodeURIComponent\(activeThreadId\)\}/);
  assert.match(page, /searchParams\.get\('thread'\)/);
  assert.match(page, /if \(threadId\) queueMicrotask\(\(\) => openThread\(threadId\)\)/);

  // Read state per thread lives on the channel read-state document the reader
  // already has, so a thread costs no document and no listener of its own —
  // and it is deliberately not the channel's own unread counter, which walking
  // into the room would clear without the thread ever being opened.
  assert.match(hook, /threads: \{ \[parentMsgId\]: Number\(replyCount\) \|\| 0 \}/);
  assert.doesNotMatch(hook, /markThreadRead[\s\S]{0,400}messageCount: increment/);
  assert.match(page, /void markThreadRead\(activeThreadId, total\)/);

  // The message says how many of its replies are new, not only how many it has.
  assert.match(bubble, /const unreadReplies = Math\.max\(0, Number\(msg\.replyCount \|\| 0\) - Number\(seenReplyCount \|\| 0\)\)/);
  assert.match(bubble, /plural\(unreadReplies, \['нова', 'нові', 'нових'\]\)/);
  assert.match(bubble, /plural\(msg\.replyCount, \['відповідь', 'відповіді', 'відповідей'\]\)/);
  assert.match(list, /seenReplyCount=\{seenReplies\[msg\.id\] \|\| 0\}/);
});

// Editing a message is writing a message. What stood here was a fixed two-line
// box a long message had to be scrolled inside, and two words of underlined
// text where the buttons should be.
test('editing a chat message is a real form, not two underlined words', async () => {
  const bubble = await readFile(new URL('../src/components/ui/Chat/MessageBubble.jsx', import.meta.url), 'utf8');

  assert.match(bubble, /<Button size="sm" style="primary" onClick=\{commitEdit\} disabled=\{!editChanged\}>/);
  assert.match(bubble, /<Button size="sm" style="ghost" onClick=\{cancelEdit\}>/);
  assert.doesNotMatch(bubble, /className="font-semibold text-ink hover:underline">Зберегти/);
  // Grown from the value, not from a keystroke: opening a long message for
  // editing is an assignment, and an assignment is not an input event.
  assert.match(bubble, /\}, \[editing, editText\]\);/);
  // `scrollHeight` is content plus padding, and the box is `border-box`: without
  // the border added back the field sits one scroll-step short of its own text.
  assert.match(bubble, /const border = field\.offsetHeight - field\.clientHeight;/);
  assert.match(bubble, /field\.style\.height = `\$\{Math\.min\(wanted, 320\)\}px`/);
  assert.doesNotMatch(bubble, /autoFocus\s*\n\s*className="w-full bg-white border/);
  // An edit that changes nothing is not an edit; an empty one is a delete asked
  // for in the wrong place.
  assert.match(bubble, /editText\.trim\(\)\.length > 0 && editText\.trim\(\) !== \(msg\.text \|\| ''\)\.trim\(\)/);
});

// The line that says «this is where you stopped reading».
test('the unread boundary waits for the cursor, and stops repeating itself', async () => {
  const [timeline, bridge, store] = await Promise.all([
    readFile(new URL('../src/components/workspace/UnifiedTimeline.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/IssueReadStateBridge.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/store/useWorkspaceStore.js', import.meta.url), 'utf8'),
  ]);

  // An empty cursor map means two opposite things — «nothing has been opened»
  // and «the cursors have not arrived» — and a timeline that cannot tell them
  // apart reads its whole history as unread and sends the reader to the day the
  // task was created. That is «9 нових» pointing at the top of a quiet task.
  assert.match(store, /issueReadStateLoaded: false/);
  assert.match(bridge, /resetIssueReadState\(\)/);
  assert.match(timeline, /if \(!myId \|\| !readCursorsLoaded\) return \[\]/);
  // Three subscriptions settle in three renders; a line latched off the first
  // of them names the wrong item.
  assert.match(timeline, /const feedSettled = \(readCursorsLoaded \|\| cursorWaitIsOver\)/);
  // Waiting for those cursors is right; waiting forever is not. A network that
  // cannot answer must not leave the conversation unplaced — which is the
  // scroller sitting at the very top of the task's whole history.
  assert.match(timeline, /setWaitedOutFor\(issueId\), 2500/);
  assert.match(timeline, /isActive && feedSettled && !boundary\.key && liveFirstUnreadKey/);
  // The effect that places the conversation has to watch the line, or the wait
  // for it never ends and the scroller stays where an unplaced one sits — the
  // very top.
  assert.match(timeline, /\}, \[feedSettled, isActive, issueId, sessionBoundary, timeline\.length\]\);/);
  // The button and the line say the same number, and the button goes once the
  // line has been read — «1 нове» must not lead to a line reading «3».
  assert.match(timeline, /\{boundaryCount\} нових/);
  assert.match(timeline, /sessionBoundary && !boundary\.dismissed && !boundary\.read && !isUnreadMarkerVisible/);
  // And the line itself is dismissed by pointing at it, once it has been read.
  assert.match(timeline, /onMouseEnter=\{boundary\.read \? dismissBoundary : undefined\}/);
});

// What a project card costs to draw.
test('a project card counts what is new without reading a whole channel', async () => {
  const dashboard = await readFile(new URL('../src/app/(app)/page.js', import.meta.url), 'utf8');

  // It listened to a project chat's entire history — no `limit`, one listener
  // per card — so opening the dashboard read every message ever written in
  // every project, to colour a number that stops being interesting past a dozen.
  assert.match(dashboard, /const PROJECT_UNREAD_WINDOW = 50;/);
  assert.match(dashboard, /query\(messagesRef, orderBy\('createdAt', 'desc'\), limit\(PROJECT_UNREAD_WINDOW\)\)/);
  assert.doesNotMatch(dashboard, /onSnapshot\(query\(messagesRef\)/);
  // And it was keyed on `currentUser` and `members`, both of which are new
  // objects whenever any field of any profile changes — so that whole read was
  // repeated on identity churn nobody asked for.
  assert.match(dashboard, /\}, \[project\.id, activeOrgId, uid, memberIdentity\]\);/);
});
