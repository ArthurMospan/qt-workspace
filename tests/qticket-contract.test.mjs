import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createQTicketSignedRequest,
  qTicketIntegrationConfig,
  signQTicketRequest,
  verifyQTicketRequest,
} from '../src/lib/integrations/qticketContract.mjs';
import { normalizePortal, normalizeStaffRoles } from '../src/lib/integrations/qticketDesk.mjs';

const environment = {
  NEXT_PUBLIC_QTICKET_URL: 'https://qticket.example.com/',
  QUICKTEAM_QTICKET_SHARED_SECRET: 'test-shared-secret-with-at-least-32-characters',
};

test('qTicket config requires both an origin and a server-only shared secret', () => {
  assert.deepEqual(qTicketIntegrationConfig(environment), {
    origin: 'https://qticket.example.com',
    secret: environment.QUICKTEAM_QTICKET_SHARED_SECRET,
    configured: true,
  });
  assert.equal(qTicketIntegrationConfig({ NEXT_PUBLIC_QTICKET_URL: environment.NEXT_PUBLIC_QTICKET_URL }).configured, false);
  assert.equal(qTicketIntegrationConfig({ QUICKTEAM_QTICKET_SHARED_SECRET: environment.QUICKTEAM_QTICKET_SHARED_SECRET }).configured, false);
});

test('signed requests preserve the exact body used to calculate the HMAC', () => {
  const request = createQTicketSignedRequest({ version: 1, revision: 3 }, {
    environment,
    timestamp: 2_000_000_000,
    nonce: 'nonce_0123456789abcdef',
  });
  assert.equal(request.origin, 'https://qticket.example.com');
  assert.equal(request.headers['X-QT-Timestamp'], '2000000000');
  assert.equal(request.headers['X-QT-Nonce'], 'nonce_0123456789abcdef');
  assert.equal(
    request.headers['X-QT-Signature'],
    signQTicketRequest(environment.QUICKTEAM_QTICKET_SHARED_SECRET, {
      timestamp: 2_000_000_000,
      nonce: 'nonce_0123456789abcdef',
      body: request.body,
    }),
  );
});

// Роль у підтримці — не роль у QuickTeam. Доти вона нею була: адміністратор
// QuickTeam ставав адміністратором qTicket, і зробити когось головним у
// підтримці означало підвищити його в усьому продукті.
test('роль у qTicket обирається окремо і тільки для тих, хто справді обраний', () => {
  const selectedUserIds = ['owner-uid', 'agent-uid'];
  assert.deepEqual(
    normalizeStaffRoles({ 'agent-uid': 'admin' }, { selectedUserIds, ownerId: 'owner-uid' }),
    { 'agent-uid': 'admin' },
  );
  // Власника не перевизначають: організація називає рівно одного, і qTicket
  // відмовляє знімку, який із цим не згоден.
  assert.deepEqual(
    normalizeStaffRoles({ 'owner-uid': 'member' }, { selectedUserIds, ownerId: 'owner-uid' }),
    {},
  );
  // Роль для людини без місця — твердження ні про що, і збережена вона тихо
  // повернула б їй цю роль, щойно її додадуть назад.
  assert.deepEqual(
    normalizeStaffRoles({ 'stranger-uid': 'admin' }, { selectedUserIds, ownerId: 'owner-uid' }),
    {},
  );
  assert.deepEqual(
    normalizeStaffRoles({ 'agent-uid': 'client_admin' }, { selectedUserIds, ownerId: 'owner-uid' }),
    {},
  );
});

test('бренд порталу: null — це «той самий», а не «жодного»', () => {
  assert.equal(normalizePortal(null), null);
  // Обʼєкт із самих порожніх полів — не перевизначення. Збережений, він читався
  // б наступним читачем як «хтось це налаштував».
  assert.equal(normalizePortal({ name: '', logo: '', sidebarTheme: '', sidebarColor: '' }), null);
  assert.deepEqual(normalizePortal({ name: '  OneB Підтримка  ', sidebarTheme: 'neon' }), {
    name: 'OneB Підтримка',
    logo: '',
    // Негодяща тема лишається порожньою, щоб qTicket успадкував тему
    // організації, а не отримав вигаданий 'dark'.
    sidebarTheme: '',
    sidebarColor: '',
  });
});

// Контракт повертав `conflicts` від початку — саме щоб QuickTeam міг пояснити
// адміністратору, чому в колеги немає місця. Роут їх викидав: читав із
// відповіді `organizationId` і `status`, і власник бачив зелений тост над
// людиною, яка не отримала нічого.
test('відмову qTicket у місці зберігають і показують, а не ковтають', async () => {
  const route = await readFile(
    new URL('../src/app/api/integrations/qticket/route.js', import.meta.url),
    'utf8',
  );
  assert.ok(route.includes('const conflicts = Array.isArray(provisioned.conflicts)'));
  assert.ok(route.includes('lastConflicts: conflicts'));
  assert.ok(route.includes('conflicts: Array.isArray(data.lastConflicts)'));

  const settings = await readFile(
    new URL('../src/app/(app)/settings/page.js', import.meta.url),
    'utf8',
  );
  assert.ok(settings.includes('qTicketStatus.conflicts.length > 0'));
  // Успіх із відмовами не повідомляється як успіх.
  assert.ok(settings.includes('next?.conflicts?.length'));
});

// Проба питає qTicket, а не цю базу. Ревізія звідси — це те, що QuickTeam
// думає, ніби надіслав, і після невдалого провіженінгу вона виглядає точно так
// само, як після вдалого.
test('перевірка звʼязку порівнює ревізію qTicket із записаною тут', async () => {
  const route = await readFile(
    new URL('../src/app/api/integrations/qticket/ping/route.js', import.meta.url),
    'utf8',
  );
  assert.ok(route.includes('pingQTicket({ sourceOrganizationId: organizationId })'));
  assert.ok(route.includes('inSync: (Number(answer.revision) || 0) === localRevision'));
  // Недосяжний qTicket — це відповідь, а не сторінка помилки: дізнатись і є
  // сенсом кнопки.
  assert.ok(route.includes('reachable: false'));
  // Питання «чи працює доповнення, яким я користуюсь» — не питання власника.
  assert.ok(route.includes("['owner', 'admin', 'member']"));
});

test('deactivation is an owner-only inactive provisioning snapshot, not local UI state', async () => {
  const route = await readFile(new URL('../src/app/api/integrations/qticket/route.js', import.meta.url), 'utf8');
  assert.match(route, /export async function DELETE/);
  assert.match(route, /authorizeOrgRequest\(request, organizationId, \['owner'\]\)/);
  assert.match(route, /entitlement: 'inactive'/);
  assert.match(route, /await provisionQTicket\(\{ \.\.\.desired, revision \}\)/);
});

// Одне число в рейці — привід зайти в сусідній продукт, а не його скринька тут.
test('the qTicket row carries an unread badge that fails to nothing', async () => {
  const [route, client, hook, sidebar] = await Promise.all([
    readFile(new URL('../src/app/api/integrations/qticket/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/server/qticket.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/hooks/useQTicketIntegration.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/WorkspaceSidebar.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /'\/api\/integrations\/quickteam\/unread'/);

  // Питаємо тільки тоді, коли рядок узагалі намальований: активне доповнення
  // й людина, яку QuickTeam справді надіслав у qTicket.
  assert.match(route, /if \(!config\.configured \|\| view\.active !== true \|\| !view\.selectedUserIds\.includes\(userId\)\) return 0;/);
  // Одна відповідь на хвилину на людину, бо рейка питає цей маршрут щоразу.
  assert.match(route, /const UNREAD_TTL_MS = 60_000;/);
  assert.match(route, /const cached = cachedUnread\(key, nowMs\);/);
  // Недоступний qTicket — це відсутній бейдж, а не зламаний екран. І промах не
  // кешується: наступний монтаж питає знову.
  const helper = route.slice(route.indexOf('async function qTicketUnreadFor'), route.indexOf('function snapshotDigest'));
  assert.match(helper, /catch \(error\) \{[\s\S]{0,400}return 0;/);
  assert.ok(
    helper.lastIndexOf('rememberUnread(key, unread, nowMs)') < helper.indexOf('} catch (error)'),
    'a failure must not be remembered as a count',
  );

  // Невідомо й нуль малюються однаково — нічим.
  assert.match(hook, /unread: 0,/);
  assert.match(hook, /const unread = enabledForCurrentUser \? Math\.max\(0, Number\(status\.unread\) \|\| 0\) : 0;/);
  assert.match(sidebar, /qTicketUnread > 0 && \(\s*<Counter value=\{qTicketUnread\}/);
  // І малюється як кожен інший лічильник у рейці. Поруч стояла ще діагональна
  // стрілка, тож у слот, який в інших рядків тримає одне число, тут ішли дві
  // позначки — і бейдж qTicket висів лівіше за бейдж «Чату» чотирма рядками
  // вище. Що клік веде назовні, кажуть тултип і сама назва рядка.
  assert.doesNotMatch(sidebar, /<ArrowUpRight/);
  // Рядок стоїть серед призначень, а не після «Налаштувань»: рейка на
  // налаштуваннях закінчується, і все нижче читається як додаток.
  const nav = sidebar.match(/const topNav = \[([\s\S]*?)\n {2}\];/)?.[1] || '';
  assert.ok(nav.indexOf("action: 'qticket'") >= 0);
  assert.ok(nav.indexOf("action: 'qticket'") < nav.indexOf("label: 'Налаштування'"));
  // Число, яке видно, має бути й у назві кнопки для тих, хто його не бачить.
  assert.match(sidebar, /Відкрити qTicket, непрочитаних: \$\{qTicketUnread\}/);
});

// Той самий конверт, який ми підписуємо, тепер треба перевіряти: qTicket
// просить нас створити завдання, і підпис — це вся довіра.
test('an inbound qTicket request is verified the same way we sign our own', () => {
  const body = JSON.stringify({ version: 1, projectId: 'p1' });
  const timestamp = 2_000_000_000;
  const nonce = 'nonce_0123456789abcdef';
  const secret = environment.QUICKTEAM_QTICKET_SHARED_SECRET;
  const signature = signQTicketRequest(secret, { timestamp, nonce, body });

  assert.deepEqual(
    verifyQTicketRequest({ secret, timestamp, nonce, signature, body, nowSeconds: timestamp }),
    { ok: true, timestamp, nonce },
  );
  // Один байт різниці — це вже інший запит.
  assert.deepEqual(
    verifyQTicketRequest({ secret, timestamp, nonce, signature, body: `${body} `, nowSeconds: timestamp }),
    { ok: false, code: 'signature' },
  );
  assert.deepEqual(
    verifyQTicketRequest({ secret, timestamp, nonce, signature, body, nowSeconds: timestamp + 301 }),
    { ok: false, code: 'expired' },
  );
  assert.deepEqual(
    verifyQTicketRequest({ secret, timestamp, nonce: 'short', signature, body, nowSeconds: timestamp }),
    { ok: false, code: 'nonce' },
  );
  // Запит зовсім без заголовків — це не протермінований запит.
  for (const missing of ['', null, undefined]) {
    assert.deepEqual(
      verifyQTicketRequest({ secret, timestamp: missing, nonce, signature, body, nowSeconds: timestamp }),
      { ok: false, code: 'timestamp' },
    );
  }
});

test('a transferred request becomes one task, however many times it is sent', async () => {
  const [inbound, tasks, projects, rules] = await Promise.all([
    readFile(new URL('../src/lib/server/qticketInbound.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/integrations/qticket/tasks/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/integrations/qticket/projects/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  ]);

  // Підпис — це те, що запит від qTicket. Дозвіл діяти за людину — це те, що
  // організація її обрала й вона досі має внутрішнє місце.
  assert.match(inbound, /verifyQTicketRequest\(\{/);
  assert.match(inbound, /integration\.active !== true/);
  assert.match(inbound, /!selected\.includes\(userId\)/);
  assert.match(inbound, /INTERNAL_ROLES\.has\(membership\.role\)/);
  assert.match(inbound, /membership\.removalPending === true/);
  // Усе, що qTicket у нас просить, щось змінює — тому nonce записується.
  assert.match(inbound, /integrationNonces'\)\.doc\(qTicketNonceId/);
  assert.match(inbound, /code: 'replay'/);

  // Заявка створюється до завдання й зникає, якщо завдання не створилось —
  // інакше невдала спроба замкнула б звернення назавжди.
  const claimBeforeCreate = tasks.indexOf('const claimRef') < tasks.indexOf('await createIssueForActor({');
  assert.ok(claimBeforeCreate, 'the claim is taken before the task is written');
  assert.match(tasks, /catch \(error\) \{[\s\S]{0,200}claimRef\.delete\(\)/);
  assert.match(tasks, /status: 'existing'/);
  assert.match(tasks, /code: 'transfer_in_progress'/);
  // Один шлях запису: та сама функція, що й у композера.
  assert.match(tasks, /createIssueForActor\(\{/);
  assert.doesNotMatch(tasks, /issueCounter|projectIssueCountIncrements/);

  // Список місць — це відповідь про цю людину, і в ньому немає того, куди
  // наступний крок однаково відмовить.
  assert.match(projects, /project\.status !== 'archived'/);
  assert.match(projects, /project\.deletionPending !== true/);
  assert.match(projects, /project\.overPlanLimit !== true/);
  assert.match(projects, /isPrivileged \|\| \(Array\.isArray\(project\.team\) && project\.team\.includes\(actor\.uid\)\)/);

  // Обидві серверні колекції закриті для браузера явно, як і решта таких.
  assert.match(rules, /match \/integrationNonces\/\{nonceId\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/qticketTransfers\/\{transferId\} \{\s*allow read, write: if false;/);
});
