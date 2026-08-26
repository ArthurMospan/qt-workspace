// What a plan gives, in one place, so the page and the product cannot disagree.
//
// Three of them, and they were already named: the onboarding screen has offered
// Free, Lite and Pro at $0/$9/$19 since before this file existed. What was
// missing was anything reading them afterwards. The settings screen drew a
// two-plan card from ternaries, `/api/projects` refused a fourth project with a
// hardcoded `plan !== 'pro' && count >= 3` — which quietly made Lite the same
// thing as Free — and nothing else in `src/` mentioned a plan at all.
//
// The registry below is the product's answer to «що дає який тариф», and both
// the screen and the route read it rather than restating it. That is the same
// arrangement `ISSUE_BULK_ACTIONS` has for bulk actions and `can.js` has for
// roles, and it exists for the same reason: a list somebody has to remember to
// update in three places is a list that will disagree with itself.
//
// ── The one rule that keeps this honest ──────────────────────────────────
//
// Every limit and every capability carries `enforced`. `true` means something
// in the product actually refuses it on the wrong plan, and `enforcedAt` names
// the file that does. `false` means intended and not yet built.
//
// The plan screen marks the two differently and never shows the second as
// though it were the first — a pricing page listing a feature nobody is stopped
// from using is not marketing, it is a bug with a price beside it. Flipping a
// flag to `true` is the last step of enforcing something, not the first, and
// `tests/plans.test.mjs` holds every `true` to a file that reads the plan.

export const DEFAULT_PLAN = 'free';

/**
 * The numbers a plan puts a ceiling on.
 *
 * `Infinity` is the ceiling for «безліміт», so a caller compares with `<` either
 * way instead of branching on a null.
 */
export const PLAN_LIMITS = [
  {
    id: 'projects',
    label: 'Активні проєкти',
    enforced: true,
    enforcedAt: 'src/app/api/projects/route.js',
  },
  {
    id: 'members',
    label: 'Учасники команди',
    enforced: false,
  },
];

/** Capabilities a plan may or may not include. Ids are stable; labels are not. */
export const PLAN_CAPABILITIES = [
  {
    id: 'branding',
    label: 'Власний брендинг',
    detail: 'Логотип, колір і тема бічної панелі',
    plans: ['lite', 'pro'],
    enforced: true,
    enforcedAt: 'src/app/(app)/settings/page.js',
  },
  {
    id: 'integrations',
    label: 'Інтеграції',
    detail: 'Telegram, YouTrack, API-ключі, портал для клієнтів',
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
    id: 'invoices',
    label: 'Виставлення рахунків',
    detail: 'Погодинні ставки команди й рахунок із табеля',
    plans: ['lite', 'pro'],
    enforced: false,
  },
  {
    id: 'priority-support',
    label: 'Пріоритетна підтримка',
    detail: 'Відповідаємо першими й розбираємось до кінця',
    plans: ['pro'],
    // Not a switch in the product, and it never will be. Listed with the rest
    // because it is part of what the plan buys; flagged like the rest because
    // nothing in the code enforces it.
    enforced: false,
  },
];

/** What every plan includes. Listed on each card so «безкоштовний» does not read as «урізаний». */
export const SHARED_FEATURES = [
  { id: 'tasks', label: 'Задачі, дошки, списки і спринти' },
  { id: 'calendar', label: 'Календар, події та нагадування' },
  { id: 'chat', label: 'Чат робочого простору й обговорення в задачах' },
  { id: 'time', label: 'Облік часу, табель і аналітика' },
];

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Щоб почати працювати командою вже сьогодні',
    priceLabel: '$0',
    periodLabel: 'назавжди',
    limits: { projects: 3, members: 5 },
  },
  {
    id: 'lite',
    name: 'Lite',
    tagline: 'Коли робочий простір показують клієнтам',
    priceLabel: '$9',
    periodLabel: 'за місяць',
    limits: { projects: 10, members: 15 },
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Усе, що є в Lite, без стелі й з підтримкою поперед черги',
    priceLabel: '$19',
    periodLabel: 'за місяць',
    limits: { projects: Infinity, members: Infinity },
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

export function planLimit(value, key) {
  const limit = planById(value).limits[key];
  return typeof limit === 'number' ? limit : Infinity;
}

/** «До 10» / «Без обмежень», so the screen never formats `Infinity`. */
export function planLimitLabel(value, key) {
  const limit = planLimit(value, key);
  return limit === Infinity ? 'Без обмежень' : `До ${limit}`;
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
export function capabilityAvailability(capability) {
  const named = PLANS.filter(plan => capability.plans.includes(plan.id)).map(plan => plan.name);
  if (named.length === 0) return '';
  if (named.length === 1) return `тільки в ${named[0]}`;
  return `тільки в ${named.slice(0, -1).join(', ')} і ${named.at(-1)}`;
}

/**
 * Every capability, for one plan's card — the ones it has and the ones it does
 * not, in one list.
 *
 * Deliberately not two lists. A card that only prints what a plan includes
 * cannot answer «а що я втрачаю, лишившись тут», which is the entire question
 * somebody on the free plan is asking.
 */
export function planCapabilityRows(value) {
  const id = normalizePlan(value);
  return PLAN_CAPABILITIES.map(capability => ({
    ...capability,
    included: capability.plans.includes(id),
    availability: capabilityAvailability(capability),
  }));
}

/** The limit rows for one plan's card, each with its own number. */
export function planLimitRows(value) {
  return PLAN_LIMITS.map(limit => ({
    ...limit,
    label: limit.label,
    value: planLimitLabel(value, limit.id),
  }));
}
