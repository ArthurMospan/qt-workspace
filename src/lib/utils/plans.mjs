// What a plan gives, in one place, so the page and the product cannot disagree.
//
// Three of them, and they were already named: the onboarding screen has offered
// Free, Lite and Pro since before this file existed. What was missing was
// anything reading them afterwards. The settings screen drew a two-plan card
// from ternaries, `/api/projects` refused a fourth project with a hardcoded
// `plan !== 'pro' && count >= 3` — which quietly made Lite the same thing as
// Free — and nothing else in `src/` mentioned a plan at all.
//
// ── How the price list is shaped, and why ────────────────────────────────
//
// Two blocks per plan, in the order everybody's price list uses because it is
// the order the questions arrive in.
//
//   1. The ceilings, as a table of numbers. Not «До 10» — a column of bare
//      figures is compared down the row at a glance, and the word in front of
//      each one is read three times and adds nothing. A plan that does not have
//      something at all shows «–», and no ceiling says «Безліміт».
//   2. What the plan adds, as «Все з Lite +» and then only the new lines.
//      Repeating twelve shared features on every card makes the columns
//      unreadable and buries the two lines that actually differ.
//
// ── What is allowed to be a ceiling ──────────────────────────────────────
//
// Only something this workspace can count on its own side. That rule removed
// two rows written here as if a price list were free to invent them: «клієнти в
// порталі», when the portal is a separate product with its own database and
// this one has no client role at all, and «сховище файлів», when nothing here
// measures a byte of what is uploaded. A ceiling nobody counts is not a plan,
// it is a sentence on a page, and the first customer to test it finds that out
// on our behalf.
//
// What is left is what the workspace itself holds and can therefore refuse:
// projects, people, and the calls the AI is asked to read.
//
// ── The one rule that keeps this honest ──────────────────────────────────
//
// Every limit and capability carries `enforced`, and `enforcedAt` names the
// file that does the refusing. `false` means intended and not yet built.
// `planAllows` answers «yes» for an unenforced capability on every plan — a
// gate nobody built is not a gate, and reporting one would make the product
// hide something people are already using.
//
// `tests/plans.test.mjs` holds every `enforced: true` to a file that reads the
// plan, so flipping a flag is the last step of enforcing something.

export const DEFAULT_PLAN = 'free';

/** Rendered by `planLimitRows`: `0` is «–», `Infinity` is «Безліміт». */
export const PLAN_LIMITS = [
  {
    id: 'projects',
    label: 'Активні проєкти',
    enforced: true,
    enforcedAt: 'src/app/api/projects/route.js',
  },
  { id: 'members', label: 'Учасники команди', enforced: false },
  { id: 'aiCalls', label: 'Розбір дзвінків / міс', enforced: false },
];

// Deliberately not a limit: the number of tasks.
//
// It is the one ceiling that stops a task tracker being a task tracker, and no
// competitor uses it — Jira, Asana and Linear cap people, Trello caps boards,
// and all of them leave the work itself alone. A team that hits a task ceiling
// does not upgrade, it stops writing tasks down, and then the tracker is wrong
// about what the team is doing, which is worse for us than the free plan is.
//
// What is capped instead is what the workspace can count: the projects and the
// people it holds, and the recordings it is asked to send off for analysis.

/** What a plan adds over the one before it. Ids are stable; labels are not. */
export const PLAN_CAPABILITIES = [
  {
    id: 'boards',
    label: 'Дошки, списки, таблиця і спринти',
    plans: ['free', 'lite', 'pro'],
    enforced: false,
  },
  {
    id: 'calendar',
    label: 'Календар, події та нагадування',
    plans: ['free', 'lite', 'pro'],
    enforced: false,
  },
  {
    id: 'chat',
    label: 'Чат і обговорення в задачах',
    plans: ['free', 'lite', 'pro'],
    enforced: false,
  },
  {
    id: 'time',
    label: 'Облік часу, табель і аналітика',
    plans: ['free', 'lite', 'pro'],
    enforced: false,
  },
  {
    id: 'branding',
    label: 'Власний брендинг',
    detail: 'Логотип, колір і тема бічної панелі',
    plans: ['lite', 'pro'],
    enforced: true,
    enforcedAt: 'src/app/(app)/settings/page.js',
  },
  {
    id: 'invoices',
    label: 'Виставлення рахунків і ставки',
    detail: 'Погодинні ставки команди й рахунок із табеля',
    plans: ['lite', 'pro'],
    enforced: false,
  },
  {
    id: 'integrations',
    label: 'Інтеграції',
    detail: 'Telegram, YouTrack, API-ключі',
    plans: ['lite', 'pro'],
    enforced: false,
  },
  {
    id: 'data-import',
    label: 'Перенесення даних',
    detail: 'Імпорт задач, часу і звʼязків з іншого трекера',
    plans: ['lite', 'pro'],
    enforced: false,
  },
  {
    id: 'portal',
    label: 'Портал для клієнтів',
    detail: 'Замовник бачить свої проєкти, не заходячи в робочий простір',
    plans: ['lite', 'pro'],
    enforced: false,
  },
  {
    id: 'ai-calls',
    label: 'Розбір дзвінків',
    detail: 'Запис наради стає саммарі, рішеннями й чернетками задач',
    plans: ['lite', 'pro'],
    enforced: false,
  },
  {
    id: 'priority-support',
    label: 'Пріоритетна підтримка',
    detail: 'Відповідаємо першими й розбираємось до кінця',
    plans: ['pro'],
    // Not a switch in the product and never will be. Listed with the rest
    // because it is part of what the plan buys; flagged like the rest because
    // nothing in the code enforces it.
    enforced: false,
  },
];

// Hryvnia, and prices shaped like prices. The three plans carried $0/$9/$19 —
// a currency nobody here is billed in, at figures that read as a rounding of
// something rather than as what the product costs. `currencyLabel` holds the
// unit so the figure itself stays a bare number in the largest type on the
// card, which is what makes the three of them comparable across the row.
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Для тесту й першої команди',
    priceLabel: '0',
    currencyLabel: 'грн / міс',
    ctaLabel: 'Почати',
    ctaNote: 'Без картки й без строку',
    limits: { projects: 3, members: 5, aiCalls: 0 },
  },
  {
    id: 'lite',
    name: 'Lite',
    tagline: 'Коли робочий простір показують клієнтам',
    priceLabel: '499',
    currencyLabel: 'грн / міс',
    ctaLabel: 'Спробувати',
    ctaNote: 'Оплата ще не підключена',
    limits: { projects: 10, members: 15, aiCalls: 10 },
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Для агенцій і команд, що ростуть',
    priceLabel: '999',
    currencyLabel: 'грн / міс',
    ctaLabel: 'Спробувати',
    ctaNote: 'Оплата ще не підключена',
    limits: { projects: Infinity, members: Infinity, aiCalls: 50 },
    recommended: true,
  },
];

export function normalizePlan(value) {
  return PLANS.some(plan => plan.id === value) ? value : DEFAULT_PLAN;
}

export function planById(value) {
  const id = normalizePlan(value);
  return PLANS.find(plan => plan.id === id);
}

/** The plan's own name, for a badge that says which one a workspace is on. */
export function planName(value) {
  return planById(value).name;
}

export function planLimit(value, key) {
  const limit = planById(value).limits[key];
  return typeof limit === 'number' ? limit : Infinity;
}

/**
 * A number, «–» or «Безліміт» — never «До 10».
 *
 * A column of bare figures is compared down the row at a glance; a word in
 * front of every one of them is read three times and says the same thing each
 * time.
 *
 * No ceiling is a word rather than «∞». That glyph is not in Inter, so every
 * screen fell back to whatever font on the machine had one: it came out thin,
 * a different size from the digits beside it and sitting off their baseline —
 * exactly the wobble a column of figures exists to avoid.
 */
export function planLimitValue(value, key) {
  const limit = planLimit(value, key);
  if (limit === Infinity) return 'Безліміт';
  if (limit === 0) return '–';
  return String(limit);
}

/** The ceiling rows for one plan's card, ready to print. */
export function planLimitRows(value) {
  return PLAN_LIMITS.map(limit => ({
    id: limit.id,
    label: limit.label,
    value: planLimitValue(value, limit.id),
    absent: planLimit(value, limit.id) === 0,
  }));
}

/**
 * Whether a plan includes a capability *and* the product enforces it.
 *
 * A capability nobody enforces yet answers `true` for every plan: a gate that
 * was never built is not a gate, and reporting one would make the caller hide
 * something people are using.
 */
export function planAllows(value, capabilityId) {
  const capability = PLAN_CAPABILITIES.find(entry => entry.id === capabilityId);
  if (!capability) return true;
  if (!capability.enforced) return true;
  return capability.plans.includes(normalizePlan(value));
}

/** The cheapest plan that includes a capability — «тільки в Lite і Pro». */
export function capabilityAvailability(capabilityId) {
  const capability = PLAN_CAPABILITIES.find(entry => entry.id === capabilityId);
  if (!capability) return '';
  const named = PLANS.filter(plan => capability.plans.includes(plan.id)).map(plan => plan.name);
  if (named.length === 0 || named.length === PLANS.length) return '';
  if (named.length === 1) return `тільки в ${named[0]}`;
  return `тільки в ${named.slice(0, -1).join(', ')} і ${named.at(-1)}`;
}

/** The plan before this one, or `null` for the first. */
export function previousPlan(value) {
  const index = PLANS.findIndex(plan => plan.id === normalizePlan(value));
  return index > 0 ? PLANS[index - 1] : null;
}

/**
 * Only what this plan adds over the one before it, plus the heading that says
 * so. The first plan inherits nothing, so it lists everything it has.
 *
 * This is why the columns stay readable: repeating the four shared lines on
 * every card buries the two that actually differ.
 */
export function planAddedCapabilities(value) {
  const id = normalizePlan(value);
  const earlier = previousPlan(id);
  return PLAN_CAPABILITIES.filter(capability => (
    capability.plans.includes(id)
    && (!earlier || !capability.plans.includes(earlier.id))
  ));
}

export function planInheritanceLabel(value) {
  const earlier = previousPlan(value);
  return earlier ? `Все з ${earlier.name} +` : 'Що входить';
}

/**
 * A ceiling as a number a Firestore document can hold. `Infinity` is not a
 * value that may be written, so no ceiling is stored as `null` — which is what
 * every reader of the organization's `limits` field already treats as
 * unlimited. Onboarding used to decide this with `plan === 'free' ? 3 : null`,
 * which handed Lite the unlimited copy of a ceiling the registry sets at ten.
 */
export function storedPlanLimit(value, key) {
  const limit = planLimit(value, key);
  return Number.isFinite(limit) ? limit : null;
}
