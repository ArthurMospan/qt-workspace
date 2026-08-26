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
  capabilityAvailability,
  normalizePlan,
  planAddedCapabilities,
  planAllows,
  planById,
  planInheritanceLabel,
  planLimit,
  planLimitRows,
  planLimitValue,
  planName,
  previousPlan,
  storedPlanLimit,
} from '../src/lib/utils/plans.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('три тарифи, і саме ті, що названі в онбордингу', () => {
  assert.deepEqual(PLANS.map(plan => plan.id), ['free', 'lite', 'pro']);
  assert.deepEqual(PLANS.map(plan => plan.name), ['Free', 'Lite', 'Pro']);
  // Гривні. Долари тут не бере ніхто, а «9» і «19» читались як округлення
  // чогось, а не як ціна.
  assert.deepEqual(PLANS.map(plan => plan.priceLabel), ['0', '499', '999']);
  for (const plan of PLANS) assert.equal(plan.currencyLabel, 'грн / міс');
  assert.equal(planName('lite'), 'Lite');
  assert.equal(planName('казна-що'), 'Free');
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

test('стеля друкується числом, рискою або словом', () => {
  // Стовпчик голих чисел порівнюється поглядом по рядку; слово «до» перед
  // кожним читається тричі й щоразу означає те саме.
  assert.equal(planLimitValue('free', 'projects'), '3');
  assert.equal(planLimitValue('lite', 'members'), '15');
  // Не «∞»: цього гліфа немає в Inter, тож кожен екран підставляв власний
  // шрифт — тонший, іншого кегля і повз базову лінію цифр поруч.
  assert.equal(planLimitValue('pro', 'projects'), 'Безліміт');
  // Чого в тарифі немає зовсім — риска, а не нуль.
  assert.equal(planLimitValue('free', 'aiCalls'), '–');
});

test('стелею стає лише те, що робочий простір може порахувати', () => {
  // Кількість задач не обмежується навмисно: це єдина стеля, від якої трекер
  // перестає бути трекером, і жоден конкурент її не ставить — Jira й Asana
  // рахують людей, Trello дошки, роботу не чіпає ніхто. Команда, що вперлась у
  // ліміт задач, не переходить на платний, вона перестає записувати задачі.
  //
  // «Клієнти в порталі» й «сховище файлів» пішли з іншої причини: портал — це
  // окремий продукт зі своєю базою, а байтів завантажень тут не міряє ніщо.
  // Стеля, якої нікому порахувати, — це речення на сторінці, а не тариф.
  assert.deepEqual(
    PLAN_LIMITS.map(limit => limit.id),
    ['projects', 'members', 'aiCalls'],
  );
  for (const limit of PLAN_LIMITS) {
    for (const plan of PLANS) {
      assert.equal(
        typeof plan.limits[limit.id],
        'number',
        `${plan.id} не має стелі «${limit.id}», яку прайслист друкує`,
      );
    }
  }
});

test('Pro має все, що має Lite, і ще щось понад те', () => {
  const lite = PLAN_CAPABILITIES.filter(capability => capability.plans.includes('lite'));
  const pro = PLAN_CAPABILITIES.filter(capability => capability.plans.includes('pro'));
  for (const capability of lite) {
    assert.ok(capability.plans.includes('pro'), `${capability.id} є в Lite, але не в Pro`);
  }
  assert.ok(pro.length > lite.length, 'Pro мусить додавати щось понад Lite');
  // І все, що є в безкоштовному, є в обох платних: сходинка вгору нічого не
  // забирає.
  for (const capability of PLAN_CAPABILITIES.filter(item => item.plans.includes('free'))) {
    assert.ok(capability.plans.includes('lite'), `${capability.id} зникає в Lite`);
    assert.ok(capability.plans.includes('pro'), `${capability.id} зникає в Pro`);
  }
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
  assert.equal(capabilityAvailability('branding'), 'тільки в Lite і Pro');
  assert.equal(capabilityAvailability('priority-support'), 'тільки в Pro');
  // Те, що є всюди, не має чим бути обмеженим — і мовчить.
  assert.equal(capabilityAvailability('boards'), '');
  assert.equal(capabilityAvailability('вигадане'), '');
});

test('картка друкує лише те, що тариф додає до попереднього', () => {
  // Дванадцять спільних рядків на кожній картці ховають ті два, що справді
  // різні. Тому кожен тариф каже «Все з попереднього +» і перелічує нове.
  assert.equal(previousPlan('free'), null);
  assert.equal(previousPlan('lite').id, 'free');
  assert.equal(previousPlan('pro').id, 'lite');

  assert.equal(planInheritanceLabel('free'), 'Що входить');
  assert.equal(planInheritanceLabel('lite'), 'Все з Free +');
  assert.equal(planInheritanceLabel('pro'), 'Все з Lite +');

  const free = planAddedCapabilities('free').map(capability => capability.id);
  const lite = planAddedCapabilities('lite').map(capability => capability.id);
  const pro = planAddedCapabilities('pro').map(capability => capability.id);

  assert.ok(free.includes('boards'));
  assert.ok(lite.includes('branding'));
  assert.ok(pro.includes('priority-support'));
  // Нічого не повторюється між сходинками — саме це робить список читабельним.
  assert.equal(free.some(id => lite.includes(id)), false);
  assert.equal(lite.some(id => pro.includes(id)), false);
  // І разом вони покривають увесь реєстр.
  assert.equal(new Set([...free, ...lite, ...pro]).size, PLAN_CAPABILITIES.length);
});

test('рядки стель приходять готовими до друку', () => {
  const rows = planLimitRows('lite');
  assert.deepEqual(rows.map(row => row.id), PLAN_LIMITS.map(limit => limit.id));
  assert.deepEqual(rows.map(row => row.value), ['10', '15', '10']);
  assert.deepEqual(planLimitRows('pro').map(row => row.value), ['Безліміт', 'Безліміт', '50']);
  assert.ok(planLimitRows('free').find(row => row.id === 'aiCalls').absent);
});

test('у документ організації безліміт пишеться як null, а не як Infinity', () => {
  // Онбординг вирішував це тернарником `plan === 'free' ? 3 : null` — і Lite
  // отримував безлімітну копію стелі, яку прайслист ставить на десяти.
  assert.equal(storedPlanLimit('free', 'projects'), 3);
  assert.equal(storedPlanLimit('lite', 'projects'), 10);
  assert.equal(storedPlanLimit('pro', 'projects'), null);
  assert.equal(storedPlanLimit('pro', 'members'), null);
});

test('кожен тариф має все, що потрібно, щоб його намалювати', () => {
  for (const plan of PLANS) {
    for (const field of ['name', 'tagline', 'priceLabel', 'currencyLabel', 'ctaLabel', 'ctaNote']) {
      assert.equal(typeof plan[field], 'string', `${plan.id}.${field}`);
      assert.ok(plan[field].trim().length > 0, `${plan.id}.${field}`);
    }
  }
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

test('прайслист один на весь продукт', async () => {
  // Дві рукописні копії прайслиста розійшлися рівно так, як копії й розходяться:
  // онбординг показував $0/$9/$19 із чотирма вигаданими пунктами на картку, а
  // налаштування — реєстр. Людина бачила перший у день реєстрації, а другий —
  // коли вперше пішла шукати рахунок.
  const settings = withoutComments(await read('src/app/(app)/settings/page.js'));
  const onboarding = withoutComments(await read('src/app/onboarding/page.js'));

  for (const [name, page] of [['налаштування', settings], ['онбординг', onboarding]]) {
    assert.match(page, /<PlanCards/, `${name} малює прайслист сам, замість PlanCards`);
    // Ціни, назви й списки не переказуються на екрані жодного разу.
    assert.doesNotMatch(page, /\$0|\$9|\$19|\$15/, `${name} називає ціну сам`);
    assert.doesNotMatch(page, /До \d+ активних проєктів/, `${name} переказує стелю словами`);
  }

  assert.doesNotMatch(settings, /isPro \? Infinity : 3/);
  assert.match(settings, /activePlanId=\{orgPlan\}/);
  assert.match(onboarding, /activePlanId=\{selectedPlan\}/);
  // Стеля в документі організації теж із реєстру, а не з тернарника.
  assert.match(onboarding, /storedPlanLimit\(selectedPlan, 'projects'\)/);
  assert.doesNotMatch(onboarding, /maxProjects: 3/);

  // Перемикання щось робить, а не показує тост про майбутнє.
  assert.doesNotMatch(settings, /Підключення платіжної системи в розробці/);
  assert.match(settings, /updateDoc\(doc\(db, 'organizations', activeOrgId\), \{ plan: next \}\)/);
  assert.match(settings, /Оплата ще не підключена/);
  // Тост називає тариф його іменем: на трьох тарифах дві гілки казали «Тариф
  // змінено на Безкоштовний» тому, хто щойно взяв Lite.
  assert.match(settings, /Тариф змінено на \$\{planName\(next\)\}/);

  // Тариф видно з меню, і безкоштовний позначений червоним — саме там є стеля,
  // в яку хтось упреться.
  assert.match(settings, /badge: planName\(orgPlan\)/);
  assert.match(settings, /badgeAlert: orgPlan === DEFAULT_PLAN/);
  // Який це колір, вирішує кіт, а не сторінка.
  const nav = await read('src/components/ui/Navigation/InnerNavigation.jsx');
  assert.match(nav, /tone=\{item\.badgeAlert \? 'danger-strong' : 'dark'\}/);

  // Зірочка живе біля контрола в продукті, а не в прайслисті: прайс уже сказав,
  // що входить у тариф, тим що перелічив це.
  assert.match(settings, /<PlanMark label=\{capabilityAvailability\('branding'\)\} \/>/);
});

test('картка тарифу вирівнює колонки сіткою, а не сподіванням', async () => {
  const card = withoutComments(await read('src/components/ui/DataDisplay/PlanCards.jsx'));

  assert.match(card, /planLimitRows\(plan\.id\)/);
  assert.match(card, /planAddedCapabilities\(plan\.id\)/);
  assert.match(card, /planInheritanceLabel\(plan\.id\)/);

  // П'ять смуг картки — п'ять рядків зовнішньої сітки. Стовпчик із блоків, що
  // просто складені один на одного, вирівняти не можна: підпис, який у одній
  // картці переноситься на другий рядок, зсуває вниз лише її ціну.
  assert.match(card, /lg:grid-rows-\[auto_auto_auto_auto_auto\]/);
  assert.match(card, /lg:grid-rows-subgrid lg:row-span-5/);
  const bands = (card.match(/px-7/g) || []).length;
  assert.equal(bands, 5, 'смуг має бути рівно пʼять, і кожна зі своїм відступом');

  // Порядок: ціна -> стелі -> кнопка -> що додає. «Скільки це коштує» і «чи
  // беру» — одне рішення, тому кнопка стоїть під ціною, а не в підвалі.
  const price = card.indexOf('{plan.priceLabel}');
  const limits = card.indexOf('planLimitRows(plan.id)');
  const button = card.indexOf('onChoose?.(plan.id)');
  const added = card.indexOf('planInheritanceLabel(plan.id)');
  assert.ok(price > 0 && limits > price && button > limits && added > button,
    'ціна -> стелі -> кнопка -> що додає');

  // Кольори тільки наші. Найпопулярніший тариф не фарбується в синє — він несе
  // бейдж і більше нічого, — а галочка малюється чорнилом продукту, бо зелений
  // у цьому продукті означає «зроблено».
  assert.doesNotMatch(card, /tone="info"|border-info|text-success/);
  assert.match(card, /Популярний/);
  assert.doesNotMatch(card, /Найпопулярніший/);
  assert.match(card, /<Check size=\{15\} className="mt-\[2px\] shrink-0 text-ink"/);

  // Бейджа «Ваш тариф» немає: кнопка тієї самої картки вже це каже.
  assert.doesNotMatch(card, /Ваш тариф/);
});

test('брендинг зачинений тарифом, але не вимикається заднім числом', async () => {
  const page = await read('src/app/(app)/settings/page.js');
  assert.match(page, /const brandingAllowed = planAllows\(orgPlan, 'branding'\)/);
  assert.match(page, /disabled=\{!orgLogo \|\| !brandingAllowed\}/);
  assert.match(page, /if \(!brandingAllowed\) return;/);
  // Причина названа: контрол, згаслий без пояснення, не відрізняється від
  // зламаного.
  assert.match(page, /Доступно на тарифах Lite і Pro/);
});
