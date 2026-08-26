// Тариф — це те, що продукт справді робить інакше, а не те, що написано на
// сторінці з цінами.
//
// До цього поле `plan` не читав ніхто: екран налаштувань малював картку з двох
// тернарників, а кнопка під нею відкривала тост «платіжна система в розробці».
// Тобто «Оновити до PRO» описував продукт, якого не існує.
//
// Найважливіша перевірка тут — остання. Кожна можливість несе прапорець
// `enforced`, і `true` означає, що щось у коді справді відмовляє на чужому
// тарифі. Прапорець, який ніхто не звіряє з кодом, перетворився б рівно на ту
// саму обіцянку, з якої все почалось.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DEFAULT_PLAN,
  PLANS,
  PLAN_CAPABILITIES,
  SHARED_FEATURES,
  normalizePlan,
  planAllows,
  planById,
  planCapabilities,
  planFeatureGroups,
  planLimit,
} from '../src/lib/utils/plans.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('невідомий тариф читається як безкоштовний, а не як помилка', () => {
  assert.equal(normalizePlan('pro'), 'pro');
  assert.equal(normalizePlan('free'), 'free');
  // Організація, створена до появи поля, не має його зовсім.
  assert.equal(normalizePlan(undefined), DEFAULT_PLAN);
  assert.equal(normalizePlan(null), DEFAULT_PLAN);
  assert.equal(normalizePlan('enterprise'), DEFAULT_PLAN);
  assert.equal(planById('казна-що').id, DEFAULT_PLAN);
});

test('стеля проєктів читається однаково для обох тарифів', () => {
  assert.equal(planLimit('free', 'projects'), 3);
  // Не число і не null: `Infinity` порівнюється тими самими операторами, тому
  // виклик не мусить розрізняти «безліміт» окремою гілкою.
  assert.equal(planLimit('pro', 'projects'), Infinity);
  assert.ok(2 < planLimit('free', 'projects'));
  assert.ok(9999 < planLimit('pro', 'projects'));
  // Невідомий ключ теж не ламає порівняння.
  assert.equal(planLimit('free', 'придумане'), Infinity);
});

test('брендинг належить платному тарифу і відмовляє безкоштовному', () => {
  assert.equal(planAllows('pro', 'branding'), true);
  assert.equal(planAllows('free', 'branding'), false);
  assert.equal(planAllows(undefined, 'branding'), false);
});

test('можливість, якої ніхто не стереже, не вдає обмеження', () => {
  // `invoices` числиться за платним тарифом і поки не перевіряється ніде. Якби
  // `planAllows` відповідав «ні» безкоштовному, виклик почав би поводитись так,
  // ніби функція вже закрита — тобто ховати те, чим люди користуються.
  const unenforced = PLAN_CAPABILITIES.find(capability => !capability.enforced);
  assert.ok(unenforced, 'у реєстрі має бути хоч одна ще не втілена можливість');
  assert.equal(planAllows('free', unenforced.id), true);
  assert.equal(planAllows('pro', unenforced.id), true);
  // І невідомий id нічого не забороняє: у реєстрі його немає, тож і правила
  // про нього немає.
  assert.equal(planAllows('free', 'вигадана-можливість'), true);
});

test('сторінка ділить те, що вже працює, і те, що обіцяне', () => {
  const pro = planFeatureGroups('pro');
  assert.ok(pro.included.length > 0);
  assert.ok(pro.planned.length > 0);
  assert.ok(pro.included.every(capability => capability.enforced));
  assert.ok(pro.planned.every(capability => !capability.enforced));
  // Безкоштовний нічого не додає понад спільне — тому в нього обидві групи
  // порожні, а не «те саме, але без».
  const free = planFeatureGroups('free');
  assert.deepEqual(free.included, []);
  assert.deepEqual(free.planned, []);
  assert.deepEqual(planCapabilities('free'), []);
});

test('кожен тариф має все, що потрібно, щоб його намалювати', () => {
  assert.deepEqual(PLANS.map(plan => plan.id), ['free', 'pro']);
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
test('кожен enforced-прапорець вказує на код, який справді відмовляє', async () => {
  for (const capability of PLAN_CAPABILITIES.filter(entry => entry.enforced)) {
    assert.ok(
      capability.enforcedAt,
      `${capability.id}: enforced: true без enforcedAt — нікому перевірити`,
    );
    const source = await read(capability.enforcedAt);
    assert.ok(
      source.includes(`planAllows(orgPlan, '${capability.id}')`)
      || source.includes(`planLimit(`),
      `${capability.id}: ${capability.enforcedAt} не питає про тариф`,
    );
  }
});

test('екран тарифів рендерить реєстр, а не переказує його', async () => {
  const source = await read('src/app/(app)/settings/page.js');
  // Без коментарів: те, що звідси прибрано, описане прозою поруч, і опис
  // видаленого коду — не код.
  const page = source
    .split(/\r?\n/)
    .filter(line => !/^\s*(\/\/|\*|\{\/\*)/.test(line))
    .join('\n');

  // Ціна й ліміт більше не живуть у тернарнику на екрані.
  assert.doesNotMatch(page, /isPro \? '\$15' : '\$0'/);
  assert.doesNotMatch(page, /isPro \? Infinity : 3/);
  assert.match(page, /PLANS\.map\(plan =>/);
  assert.match(page, /planFeatureGroups\(plan\.id\)/);
  assert.match(page, /planLimit\(plan\.id, 'projects'\)/);

  // Перемикання щось робить, а не показує тост про майбутнє.
  assert.doesNotMatch(page, /Підключення платіжної системи в розробці/);
  assert.match(page, /updateDoc\(doc\(db, 'organizations', activeOrgId\), \{ plan: next \}\)/);

  // І екран каже, що грошей поки не беруть — інакше це була б єдина неправда,
  // що на ньому лишилась.
  assert.match(page, /Оплата ще не підключена/);
});

test('брендинг зачинений тарифом, але не вимикається заднім числом', async () => {
  const page = await read('src/app/(app)/settings/page.js');
  assert.match(page, /const brandingAllowed = planAllows\(orgPlan, 'branding'\)/);
  assert.match(page, /disabled=\{!orgLogo \|\| !brandingAllowed\}/);
  assert.match(page, /if \(!brandingAllowed\) return;/);
  // Причина названа: контрол, згаслий без пояснення, не відрізняється від
  // зламаного.
  assert.match(page, /Доступно на професійному тарифі/);
});
