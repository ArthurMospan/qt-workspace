import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('scheduled notifications require a production bearer secret', async () => {
  const source = await read('../src/app/api/cron/notifications/route.js');
  assert.match(source, /process\.env\.CRON_SECRET/);
  assert.match(source, /request\.headers\.get\('authorization'\) !== `Bearer \$\{cronSecret\}`/);
  assert.match(source, /runScheduledNotificationSweep\(\{ mode: requested \}\)/);
});

test('a schedule invokes the notification sweep independently of a browser', async () => {
  // Vercel Hobby allows one cron run per day, so the five-minute sweep is
  // driven from GitHub Actions rather than vercel.json.
  const workflow = await read('../.github/workflows/scheduled-notifications.yml');
  assert.match(workflow, /cron: '\*\/5 \* \* \* \*'/);
  assert.match(workflow, /\$\{APP_URL\}\/api\/cron\/notifications/);
  assert.match(workflow, /Authorization: Bearer \$\{CRON_SECRET\}/);

  // An unset secret must fail loudly instead of silently sending no header and
  // reading the endpoint's 401 as a healthy run.
  assert.match(workflow, /if \[ -z "\$\{CRON_SECRET\}" \]/);
  assert.match(workflow, /if \[ "\$\{status\}" != "200" \]/);

  await assert.rejects(read('../vercel.json'), /ENOENT/);

  const bridge = await read('../src/components/WorkspaceNotificationBridge.jsx');
  const header = await read('../src/components/WorkspaceHeader.jsx');
  assert.doesNotMatch(bridge, /\/api\/calendar\/reminders/);
  assert.doesNotMatch(header, /useDeadlineReminders/);
});

test('localhost can disconnect an existing Telegram binding without bot credentials', async () => {
  const settings = await read('../src/app/(app)/settings/page.js');
  assert.match(
    settings,
    /\(!telegramBotStatus\.configured && !telegramBotStatus\.connected\)/,
  );
  assert.match(
    settings,
    /\(!telegramGroupStatus\.configured && !telegramGroupStatus\.connected\)/,
  );

  const route = await read('../src/app/api/integrations/telegram/route.js');
  const deleteHandler = route.slice(route.indexOf('export async function DELETE'));
  assert.match(deleteHandler, /\.collection\('private'\)\.doc\('telegram'\)\.delete\(\)/);
  assert.doesNotMatch(deleteHandler, /telegramStatus|ensureTelegramWebhook|TELEGRAM_BOT_TOKEN/);
});

test('development avoids persistent multi-tab leases while production keeps offline cache', async () => {
  const source = await read('../src/lib/firebase.js');
  assert.match(source, /process\.env\.NODE_ENV === 'development'/);
  assert.match(source, /\? memoryLocalCache\(\)/);
  assert.match(source, /: persistentLocalCache\(\{ tabManager: persistentMultipleTabManager\(\) \}\)/);
});
