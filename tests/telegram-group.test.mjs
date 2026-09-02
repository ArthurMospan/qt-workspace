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

test('«Перевірити» asks Telegram whether the bot is still in the group, and answers instead of throwing', async () => {
  const check = await read('src/app/api/integrations/telegram/group/check/route.js');
  assert.match(check, /telegramRequest\('getChat', \{ chat_id: data\.chatId \}\)/);
  assert.doesNotMatch(check, /sendMessage/);
  assert.match(check, /ok: false, error: explain\(error\.message\)/);
  assert.match(check, /Бота вилучили з групи/);
  const settings = await read('src/app/(app)/settings/page.js');
  assert.match(settings, /telegramRequest\('\/api\/integrations\/telegram\/group\/check', 'POST'/);
  assert.doesNotMatch(settings, /на місці, бот відповідає/);
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
