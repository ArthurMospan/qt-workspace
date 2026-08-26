// What a plan gives, in one place, so the page and the product cannot disagree.
//
// Before this, `plan` was a field nothing read. The settings screen drew a card
// from two ternaries — `isPro ? '$15' : '$0'`, `isPro ? Infinity : 3` — and the
// button under it opened a toast saying the payment system was in development.
// Nothing anywhere else in `src/` mentioned the plan at all, so «Оновити до
// PRO» described a product that did not exist.
//
// The registry below is the product's answer to «що дає який тариф», and the
// screen renders it rather than restating it. That is the same arrangement
// `ISSUE_BULK_ACTIONS` has for bulk actions and `can.js` has for roles, and it
// exists for the same reason: a list somebody has to remember to update twice
// is a list that will disagree with itself.
//
// ── The one rule that keeps this honest ──────────────────────────────────
//
// Every capability carries `enforced`. `true` means something in the product
// actually refuses it on the wrong plan; `false` means it is intended and not
// yet built. The plan screen renders the two groups differently and never
// promises the second as though it were the first — a pricing page that lists a
// feature nobody is stopped from using is not marketing, it is a bug with a
// price beside it.
//
// Flipping a flag to `true` is the last step of enforcing something, not the
// first. `tests/plans.test.mjs` holds every `enforced: true` to a named place
// in the code that does the enforcing.

export const DEFAULT_PLAN = 'free';

/** Capabilities a plan may or may not include. Ids are stable; labels are not. */
export const PLAN_CAPABILITIES = [
  {
    id: 'branding',
    label: 'Власний брендинг',
    detail: 'Логотип, колір і тема бічної панелі — робочий простір виглядає вашим',
    plans: ['pro'],
    enforced: true,
    // Where the refusal lives, so the test can find it.
    enforcedAt: 'src/app/(app)/settings/page.js',
  },
  {
    id: 'unlimited-projects',
    label: 'Необмежені проєкти',
    detail: 'На безкоштовному — до трьох',
    plans: ['pro'],
    enforced: true,
    enforcedAt: 'src/app/(app)/settings/page.js',
  },
  {
    id: 'invoices',
    label: 'Рахунки і ставки',
    detail: 'Погодинні ставки команди й рахунок із табеля',
    plans: ['pro'],
    enforced: false,
  },
  {
    id: 'integrations',
    label: 'Інтеграції',
    detail: 'Telegram, YouTrack, API-ключі, портал для клієнтів',
    plans: ['pro'],
    enforced: false,
  },
  {
    id: 'ai-calls',
    label: 'Розбір дзвінків',
    detail: 'Запис наради перетворюється на саммарі, рішення й чернетки задач',
    plans: ['pro'],
    enforced: false,
  },
];

/** What both plans include. Listed so «безкоштовний» does not read as «урізаний». */
export const SHARED_FEATURES = [
  'Необмежено учасників команди',
  'Дошки, списки, таблиця і спринти',
  'Календар, події та нагадування',
  'Чат робочого простору й обговорення в задачах',
  'Облік часу, табель і аналітика',
];

export const PLANS = [
  {
    id: 'free',
    name: 'Безкоштовний',
    tagline: 'Щоб почати працювати командою вже сьогодні',
    priceLabel: '$0',
    periodLabel: 'назавжди',
    limits: { projects: 3 },
  },
  {
    id: 'pro',
    name: 'Професійний',
    tagline: 'Коли робочий простір показують клієнтам',
    priceLabel: '$15',
    periodLabel: 'за місяць',
    limits: { projects: Infinity },
  },
];

export function normalizePlan(value) {
  return PLANS.some(plan => plan.id === value) ? value : DEFAULT_PLAN;
}

export function planById(value) {
  const id = normalizePlan(value);
  return PLANS.find(plan => plan.id === id);
}

/** `Infinity` where a plan sets no ceiling, so a caller can compare either way. */
export function planLimit(value, key) {
  const limit = planById(value).limits[key];
  return typeof limit === 'number' ? limit : Infinity;
}

/**
 * Whether a plan includes a capability *and* the product enforces it.
 *
 * A capability that is not enforced yet answers `true` for every plan — a gate
 * nobody built is not a gate, and reporting one would make the caller behave as
 * though the feature were already restricted.
 */
export function planAllows(value, capabilityId) {
  const capability = PLAN_CAPABILITIES.find(entry => entry.id === capabilityId);
  if (!capability) return true;
  if (!capability.enforced) return true;
  return capability.plans.includes(normalizePlan(value));
}

/** The capabilities this plan includes, whether or not anything enforces them. */
export function planCapabilities(value) {
  const id = normalizePlan(value);
  return PLAN_CAPABILITIES.filter(capability => capability.plans.includes(id));
}

/** What the plan screen prints under a plan: what it adds and what is still coming. */
export function planFeatureGroups(value) {
  const included = planCapabilities(value);
  return {
    included: included.filter(capability => capability.enforced),
    planned: included.filter(capability => !capability.enforced),
  };
}
