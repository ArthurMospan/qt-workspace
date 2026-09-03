import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('YouTrack discovery, UI and importer preserve manual status mappings', async () => {
  const [discovery, card, route, importer] = await Promise.all([
    read('../src/lib/server/youtrackIntegration.js'),
    read('../src/components/integrations/YouTrackImportCard.jsx'),
    read('../src/app/api/integrations/youtrack/import/route.js'),
    read('../src/lib/server/youtrackImporter.js'),
  ]);

  // Цільові статуси читаються з workflow організації, і читаються щоразу
  // наново. Раніше вони збиралися просто в тілі `discoverYouTrack`; тепер
  // розвідку кешують, і саме тому цей список винесено в окрему функцію —
  // знімок YouTrack лежить у базі, а статуси QuickTeam ні, інакше вибір
  // вказував би на статус, видалений у сусідній вкладці.
  assert.match(discovery, /async function targetStatusesFor\(organizationId\)/);
  assert.match(discovery, /categories\.get\(status\.id\)/);
  assert.match(discovery, /targetStatusesFor\(organizationId\),/);
  assert.doesNotMatch(discovery, /targetStatuses: data\.targetStatuses/, 'цільові статуси не беруться з кешу');
  // Запасний шлях збору статусів — із самих задач — лишається, але зі стелею:
  // без неї один проєкт на 50 000 задач означав 500 послідовних сторінок і
  // розвідку, яка не встигала повернутись у межах запиту.
  assert.match(discovery, /client\.issueStubs\(project\.shortName, YOUTRACK_DISCOVERY_PROBE\)/);
  assert.match(discovery, /mergeYouTrackStatuses/);
  assert.match(card, /suggestYouTrackStatusMappings\(result\.projects, result\.targetStatuses\)/);
  assert.match(card, /Необрані залишаться в YouTrack/);
  assert.match(card, /toggleSourceStatus\(project\.id, sourceStatus\.name\)/);
  assert.match(card, /statusMappings,/);
  assert.match(route, /statusMappings:\s*body\.statusMappings/);
  assert.match(importer, /statusMappings:\s*sanitizedStatusMappings/);
  assert.match(importer, /resolveYouTrackStatus\(stateName, workflow\.statuses, explicitStatusId\)/);
  assert.match(importer, /hiddenStatusIds\.has\(explicitStatusId\)/);
  assert.match(importer, /if \(!hasStatusFilter\)/);
  assert.match(importer, /if \(!selectedStatuses\.length\)/);
  assert.match(importer, /statusFilters:\s*normalizedStatusFilters/);
  assert.match(importer, /mappingVersion:\s*4/);
});

test('YouTrack work items remain imported as time logs and update the issue mirror', async () => {
  const importer = await read('../src/lib/server/youtrackImporter.js');
  assert.match(importer, /client\.workItems\(issue\.id\)/);
  assert.match(importer, /importWorkItems\(\{ job, issueId: saved\.issueId/);
  assert.match(importer, /FieldValue\.increment\(spentMinutesDelta\)/);
  assert.match(importer, /spentMinutesMirrorVersion:\s*1/);
});

// Вибір живе на сервері, а не в стані вкладки — інакше перезавантаження
// сторінки стирає розкладку двох десятків статусів, і людина починає з кнопки
// «Знайти проєкти». Саме на це й була скарга, тож правило тримає тест.
test('the import plan and the YouTrack snapshot outlive a reload', async () => {
  const [integration, planRoute, discoverRoute, card, rules] = await Promise.all([
    read('../src/lib/server/youtrackIntegration.js'),
    read('../src/app/api/integrations/youtrack/plan/route.js'),
    read('../src/app/api/integrations/youtrack/discover/route.js'),
    read('../src/components/integrations/YouTrackImportCard.jsx'),
    read('../firestore.rules'),
  ]);

  // Обидва документи — сусіди токена в закритій колекції, тож жодного нового
  // правила вони не потребують і браузер до них не дістає.
  assert.match(integration, /\.collection\('private'\)\.doc\('youtrackDiscovery'\)/);
  assert.match(integration, /\.collection\('private'\)\.doc\('youtrackPlan'\)/);
  assert.match(rules, /match \/organizations\/\{orgId\}\/private\/\{privateDoc\} \{\s*\n\s*allow read, write: if false;/);

  // Знімок і вибір належать підключенню: інша адреса YouTrack — інший
  // `connectionId`, і чужі проєкти не видаються за поточні.
  assert.match(integration, /data\.connectionId !== connectionId/);
  assert.match(planRoute, /export async function PUT/);
  assert.match(card, /\/api\/integrations\/youtrack\/plan/);

  // Розвідка запускається сама, коли знімка ще немає, і платний доступ до неї
  // питається так само, як у підключення й імпорту.
  assert.match(discoverRoute, /refuseWithoutCapability\(getAdminDb\(\), organizationId, 'data-import'\)/);
  // Напис, а не слово: коментар угорі картки пояснює саме те, що звідси
  // прибрали, і має право назвати це на ім'я. Зникнути мусить кнопка.
  const withoutComments = card.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(withoutComments, /Знайти проєкти/, 'розвідка більше не окрема кнопка');
  assert.doesNotMatch(withoutComments, /Перевірити імпорт/, 'перевірка більше не окрема кнопка');
  assert.doesNotMatch(withoutComments, /disabled=\{activeJob\}/, '«Відключити» більше не замикається на job');
});
