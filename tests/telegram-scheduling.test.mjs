import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('scheduled notifications require a production bearer secret', async () => {
  const source = await read('../src/app/api/cron/notifications/route.js');
  assert.match(source, /process\.env\.CRON_SECRET/);
  assert.match(source, /request\.headers\.get\('authorization'\) !== `Bearer \$\{cronSecret\}`/);
  assert.match(source, /runScheduledNotificationSweep\(\)/);
});

test('Vercel invokes the notification sweep independently of a browser', async () => {
  const config = JSON.parse(await read('../vercel.json'));
  assert.deepEqual(config.crons, [{
    path: '/api/cron/notifications',
    schedule: '*/5 * * * *',
  }]);
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
