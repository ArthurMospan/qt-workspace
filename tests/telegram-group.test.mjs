import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const handlersOf = source => Object.fromEntries(
  source.split(/export async function /).slice(1).map(chunk => [chunk.split('(')[0], chunk]),
);

// The Telegram group is one screen in the standard integration shape — the
// switch in the header, one scene, rows — and the flow underneath it has to
// hold up on its own: the screen used to ask for a command Telegram had already
// typed, show a form to members it would refuse, keep a project nobody could
// change, and «check» a group by re-reading our own record.

test('the group status is readable by every member; linking, moving and unlinking stay owner/admin', async () => {
  const route = await read('src/app/api/integrations/telegram/group/route.js');
  const handlers = handlersOf(route);
  assert.match(handlers.GET, /authorizeOrgRequest\(request, organizationId\)/);
  assert.doesNotMatch(handlers.GET, /\['owner', 'admin'\]/);
  for (const name of ['POST', 'PATCH', 'DELETE']) {
    assert.match(handlers[name], /authorizeOrgRequest\(request, organizationId, \['owner', 'admin'\]\)/, name);
  }
  // The row that answers «а воно працює?» with a task: the view carries what
  // the webhook stamps, and nothing the browser could forge.
  for (const field of ['lastIssueKey', 'lastIssueId', 'lastProjectId', 'lastTaskAt', 'taskCount']) {
    assert.match(route, new RegExp(`${field}:`), field);
  }
});

test('the default project moves in place, in both records the webhook and the screen read', async () => {
  const handlers = handlersOf(await read('src/app/api/integrations/telegram/group/route.js'));
  assert.match(handlers.PATCH, /Групу ще не підключено/);
  assert.match(handlers.PATCH, /activeProject\(db, organizationId, projectId\)/);
  assert.match(handlers.PATCH, /batch\.set\(ref, \{ defaultProjectId: projectId/);
  assert.match(handlers.PATCH, /telegramChats'\)\.doc\(String\(current\.chatId\)\)/);
  // An archived project or another organization's is refused at both doors.
  const route = await read('src/app/api/integrations/telegram/group/route.js');
  assert.match(route, /data\.organizationId !== organizationId \|\| data\.status === 'archived'/);
  assert.match(handlers.POST, /activeProject\(getAdminDb\(\), organizationId, projectId\)/);
});

test('the bot answers for itself: still in the group, and whether it reads mentions', async () => {
  const server = await read('src/lib/server/telegram.js');
  assert.match(server, /can_read_all_group_messages/);
  assert.match(server, /telegramRequest\('getChat', \{ chat_id: chatId \}\)/);
  assert.match(server, /PROBE_TTL_MS = 5 \* 60 \* 1000/);
  const handlers = handlersOf(await read('src/app/api/integrations/telegram/group/route.js'));
  assert.match(handlers.GET, /telegramBotReadsAllMessages\(\)/);
  assert.match(handlers.GET, /telegramBotInChat\(data\.chatId\)/);
  assert.match(handlers.GET, /botInGroup: membership \? membership\.inChat : null/);
  // No manual check: the row says it, and the mention form is offered only
  // when a mention can reach the webhook at all.
  await assert.rejects(read('src/app/api/integrations/telegram/group/check/route.js'), /ENOENT/);
  const settings = await read('src/app/(app)/settings/page.js');
  assert.doesNotMatch(settings, /Перевірка зв'язку|checkTelegramGroup/);
  assert.match(settings, /telegramGroupStatus\.botInGroup === false/);
  assert.match(settings, /telegramGroupStatus\.readsAllMessages === true && \(/);
});

test('the webhook stamps the last task and drops the previous group when another is linked', async () => {
  const webhook = await read('src/app/api/integrations/telegram/webhook/route.js');
  assert.match(webhook, /lastIssueKey: createdIssue\.issueKey/);
  assert.match(webhook, /lastProjectId: data\.defaultProjectId/);
  assert.match(webhook, /taskCount: FieldValue\.increment\(1\)/);
  // One group per organization: the old routing record must not outlive the
  // link, or the old group keeps creating tasks. Reads before writes, as a
  // Firestore transaction demands.
  const connect = webhook.slice(webhook.indexOf('async function connectGroup'), webhook.indexOf('async function createGroupTask'));
  assert.match(connect, /transaction\.delete\(db\.collection\('telegramChats'\)\.doc\(previousChatId\)\)/);
  assert.ok(connect.indexOf('transaction.get(organizationRef)') < connect.indexOf('transaction.set(organizationRef'));
  // And one organization per group: a token proves its holder may bind a
  // group to their own organization, not that they may take a group already
  // routed to somebody else's. The routing record is read before it is
  // written, and a group bound elsewhere is refused with the token intact.
  assert.ok(connect.indexOf('transaction.get(chatRef)') !== -1);
  assert.ok(connect.indexOf('transaction.get(chatRef)') < connect.indexOf('transaction.set(chatRef'));
  assert.match(connect, /boundTo && boundTo !== data\.organizationId[\s\S]{0,40}throw new Error\('CHAT_BOUND_ELSEWHERE'\)/);
  assert.match(webhook, /error\.message === 'CHAT_BOUND_ELSEWHERE'/);
  assert.match(webhook, /вже підключено до іншої організації/);
});

test('the screen keeps the standard shape and does its work in a dialog', async () => {
  const settings = await read('src/app/(app)/settings/page.js');
  // The header switch and its guard, like every other integration.
  assert.match(settings, /onToggle: toggleTelegramGroup,/);
  assert.match(settings, /\(!telegramGroupStatus\.configured && !telegramGroupStatus\.connected\)/);
  // One scene, one action, and it opens the dialog.
  assert.match(settings, /label: telegramGroupSetupOpen \? 'Продовжити підключення' : 'Підключити групу'/);
  assert.match(settings, /onClick: \(\) => setTelegramGroupDialogOpen\(true\)/);
  // Rows once linked: the project is a control, the last task is a link.
  assert.match(settings, /onChange=\{changeTelegramGroupProject\}/);
  assert.match(settings, /telegramRequest\('\/api\/integrations\/telegram\/group', 'PATCH'/);
  assert.match(settings, /label="Остання задача з групи"/);
  // The dialog closes itself when the group appears, and cancelling is explicit.
  assert.match(settings, /if \(status\?\.connected\) \{\s*setTelegramGroupDialogOpen\(false\);/);
  assert.match(settings, /onClick=\{cancelTelegramGroupSetup\}/);
  // Nothing about a person's own notification chat lives on this screen.
  assert.doesNotMatch(settings, /title="Сповіщення вам"/);
});
