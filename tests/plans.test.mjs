// Тариф — це те, що продукт справді робить інакше, а не те, що написано на
// сторінці з цінами.
//
// Тарифів троє, і названі вони були давно: онбординг пропонує Free, Lite і Pro
// за $0/$9/$19 ще до появи цього файлу. Бракувало того, хто прочитає їх далі.
// Екран налаштувань малював картку з тернарників по двох тарифах, а
// `/api/projects` відмовляв у четвертому проєкті через захардкоджене
// `plan !== 'pro' && count >= 3` — тобто Lite тихо дорівнював Free.
//
// Найважливіша перевірка тут — та, що звіряє прапорці `enforced` з кодом.
// Прапорець, якого ніхто не звіряє, перетворився б рівно на ту саму обіцянку,
// з якої все почалось.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DEFAULT_PLAN,
  PLANS,
  PLAN_CAPABILITIES,
  PLAN_LIMITS,
  SHARED_FEATURES,
  capabilityAvailability,
  normalizePlan,
  planAllows,
  planById,
  planCapabilityRows,
  planLimit,
  planLimitLabel,
  planLimitRows,
} from '../src/lib/utils/plans.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('три тарифи, і саме ті, що названі в онбордингу', () => {
  assert.deepEqual(PLANS.map(plan => plan.id), ['free', 'lite', 'pro']);
  assert.deepEqual(PLANS.map(plan => plan.name), ['Free', 'Lite', 'Pro']);
  assert.deepEqual(PLANS.map(plan => plan.priceLabel), ['$0', '$9', '$19']);
});

test('невідомий тариф читається як безкоштовний, а не як помилка', () => {
  for (const id of ['free', 'lite', 'pro']) assert.equal(normalizePlan(id), id);
  // Організація, створена до появи поля, не має його зовсім.
  assert.equal(normalizePlan(undefined), DEFAULT_PLAN);
  assert.equal(normalizePlan(null), DEFAULT_PLAN);
  assert.equal(normalizePlan('enterprise'), DEFAULT_PLAN);
  assert.equal(planById('казна-що').id, DEFAULT_PLAN);
});

test('стелі ростуть від тарифу до тарифу і закінчуються безлімітом', () => {
  assert.deepEqual(PLANS.map(plan => planLimit(plan.id, 'projects')), [3, 10, Infinity]);
  assert.deepEqual(PLANS.map(plan => planLimit(plan.id, 'members')), [5, 15, Infinity]);
  // `Infinity` порівнюється тими самими операторами, тому виклик не мусить
  // розрізняти «безліміт» окремою гілкою — і саме цим Lite перестав бути Free.
  assert.ok(3 >= planLimit('free', 'projects'));
  assert.ok(3 < planLimit('lite', 'projects'));
  assert.ok(9999 < planLimit('pro', 'projects'));
  assert.equal(planLimit('free', 'придумане'), Infinity);
});

test('стеля показується словами, а не числом Infinity', () => {
  assert.equal(planLimitLabel('free', 'projects'), 'До 3');
  assert.equal(planLimitLabel('lite', 'members'), 'До 15');
  assert.equal(planLimitLabel('pro', 'projects'), 'Без обмежень');
});

test('Pro має все, що має Lite, і ще щось понад те', () => {
  const lite = PLAN_CAPABILITIES.filter(capability => capability.plans.includes('lite'));
  const pro = PLAN_CAPABILITIES.filter(capability => capability.plans.includes('pro'));
  for (const capability of lite) {
    assert.ok(capability.plans.includes('pro'), `${capability.id} є в Lite, але не в Pro`);
  }
  assert.ok(pro.length > lite.length, 'Pro мусить додавати щось понад Lite');
  // Безкоштовний не має жодної з платних можливостей — саме це робить їх платними.
  assert.equal(PLAN_CAPABILITIES.filter(item => item.plans.includes('free')).length, 0);
});

test('брендинг починається з Lite і відмовляє безкоштовному', () => {
  assert.equal(planAllows('lite', 'branding'), true);
  assert.equal(planAllows('pro', 'branding'), true);
  assert.equal(planAllows('free', 'branding'), false);
  assert.equal(planAllows(undefined, 'branding'), false);
});

test('можливість, якої ніхто не стереже, не вдає обмеження', () => {
  // Якби `planAllows` відповідав «ні» безкоштовному на ще не втілене, виклик
  // почав би ховати те, чим люди вже користуються.
  const unenforced = PLAN_CAPABILITIES.find(capability => !capability.enforced);
  assert.ok(unenforced, 'у реєстрі має бути хоч одна ще не втілена можливість');
  for (const plan of PLANS) assert.equal(planAllows(plan.id, unenforced.id), true);
  assert.equal(planAllows('free', 'вигадана-можливість'), true);
});

test('замок називає найдешевший тариф, у якому фіча є', () => {
  const branding = PLAN_CAPABILITIES.find(capability => capability.id === 'branding');
  assert.equal(capabilityAvailability(branding), 'тільки в Lite і Pro');
  const support = PLAN_CAPABILITIES.find(capability => capability.id === 'priority-support');
  assert.equal(capabilityAvailability(support), 'тільки в Pro');
});

test('картка тарифу показує кожну можливість — і ту, якої в ньому немає', () => {
  const free = planCapabilityRows('free');
  // Не два списки: картка, що друкує лише включене, не відповідає на «а що я
  // втрачаю, лишившись тут».
  assert.equal(free.length, PLAN_CAPABILITIES.length);
  assert.ok(free.every(row => row.included === false));
  assert.ok(free.every(row => row.availability.startsWith('тільки в')));

  const pro = planCapabilityRows('pro');
  assert.ok(pro.every(row => row.included === true));

  const lite = planCapabilityRows('lite');
  assert.equal(lite.filter(row => row.included).length, PLAN_CAPABILITIES.length - 1);
});

test('рядки стель приходять готовими до друку', () => {
  const rows = planLimitRows('lite');
  assert.deepEqual(rows.map(row => row.id), PLAN_LIMITS.map(limit => limit.id));
  assert.deepEqual(rows.map(row => row.value), ['До 10', 'До 15']);
});

test('кожен тариф має все, що потрібно, щоб його намалювати', () => {
  for (const plan of PLANS) {
    for (const field of ['name', 'tagline', 'priceLabel', 'periodLabel']) {
      assert.equal(typeof plan[field], 'string', `${plan.id}.${field}`);
      assert.ok(plan[field].trim().length > 0, `${plan.id}.${field}`);
    }
  }
  assert.ok(SHARED_FEATURES.length >= 3);
  const ids = PLAN_CAPABILITIES.map(capability => capability.id);
  assert.equal(new Set(ids).size, ids.length, 'id можливостей унікальні');
});

// ── Те, заради чого весь файл ────────────────────────────────────────────
test('кожен enforced-прапорець вказує на код, який справді питає про тариф', async () => {
  const enforced = [...PLAN_CAPABILITIES, ...PLAN_LIMITS].filter(entry => entry.enforced);
  assert.ok(enforced.length > 0);
  for (const entry of enforced) {
    assert.ok(entry.enforcedAt, `${entry.id}: enforced: true без enforcedAt — нікому перевірити`);
    const source = await read(entry.enforcedAt);
    assert.ok(
      source.includes(`planAllows(orgPlan, '${entry.id}')`)
      || source.includes(`planLimit(orgSnap.data().plan, '${entry.id}')`),
      `${entry.id}: ${entry.enforcedAt} не питає про тариф`,
    );
  }
});

// Без коментарів у обох файлах: те, що звідти прибрано, описане прозою поруч,
// і опис видаленого коду — не код.
const withoutComments = source => source
  .split(/\r?\n/)
  .filter(line => !/^\s*(\/\/|\*|\{\/\*)/.test(line))
  .join('\n');

test('обидва місця, що рахують проєкти, читають одну стелю', async () => {
  const createRoute = withoutComments(await read('src/app/api/projects/route.js'));
  const home = withoutComments(await read('src/app/(app)/page.js'));
  // Захардкоджена трійка мала на один тариф менше, ніж продукт.
  assert.doesNotMatch(createRoute, /!== 'pro' && activeProjectsCount >= 3/);
  assert.doesNotMatch(home, /orgPlan !== 'pro'/);
  assert.match(createRoute, /planLimit\(orgSnap\.data\(\)\.plan, 'projects'\)/);
  assert.match(home, /planLimit\(orgPlan, 'projects'\)/);
  // І відмова більше не називає єдиним виходом найдорожчий тариф.
  assert.doesNotMatch(createRoute, /Перейдіть на Pro план/);
});

test('екран тарифів рендерить реєстр, а не переказує його', async () => {
  const source = await read('src/app/(app)/settings/page.js');
  // Без коментарів: те, що звідси прибрано, описане прозою поруч, і опис
  // видаленого коду — не код.
  const page = source
    .split(/\r?\n/)
    .filter(line => !/^\s*(\/\/|\*|\{\/\*)/.test(line))
    .join('\n');

  assert.doesNotMatch(page, /isPro \? '\$15' : '\$0'/);
  assert.doesNotMatch(page, /isPro \? Infinity : 3/);
  assert.match(page, /PLANS\.map\(plan =>/);
  assert.match(page, /planCapabilityRows\(plan\.id\)/);
  assert.match(page, /planLimitRows\(plan\.id\)/);
  assert.match(page, /lg:grid-cols-3/);

  // Кнопка стоїть під ціною, а не в підвалі картки: «скільки це коштує» і «чи
  // беру» — одне рішення. І всі три картки однакової висоти.
  const price = page.indexOf('{plan.priceLabel}');
  const button = page.indexOf('handleUpgradePlan(plan.id)');
  const features = page.indexOf('planLimitRows(plan.id)');
  assert.ok(price > 0 && button > price && features > button, 'ціна → кнопка → список');
  assert.match(page, /flex h-full flex-col overflow-hidden/);

  // Замкнена фіча позначена зіркою.
  assert.match(page, /<Star size=\{13\}/);

  // Перемикання щось робить, а не показує тост про майбутнє.
  assert.doesNotMatch(page, /Підключення платіжної системи в розробці/);
  assert.match(page, /updateDoc\(doc\(db, 'organizations', activeOrgId\), \{ plan: next \}\)/);
  assert.match(page, /Оплата ще не підключена/);
});

test('брендинг зачинений тарифом, але не вимикається заднім числом', async () => {
  const page = await read('src/app/(app)/settings/page.js');
  assert.match(page, /const brandingAllowed = planAllows\(orgPlan, 'branding'\)/);
  assert.match(page, /disabled=\{!orgLogo \|\| !brandingAllowed\}/);
  assert.match(page, /if \(!brandingAllowed\) return;/);
  // Причина названа: контрол, згаслий без пояснення, не відрізняється від
  // зламаного.
  assert.match(page, /Доступно на/);
});
