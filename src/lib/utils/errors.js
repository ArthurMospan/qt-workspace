import { noteQuotaRefusal } from './quotaState.mjs';

export function isQuotaExceededError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '8'
    || code.includes('resource-exhausted')
    || code.includes('quota')
    || message.includes('resource_exhausted')
    || message.includes('quota exceeded');
}

// Every load failure in the workspace already comes through here, which makes
// it the one place that can notice the daily free quota being spent — and the
// read that gets refused is usually not the one whose failure reaches a screen,
// so noticing has to happen where the failure is, not where it surfaces.
// A tab left open across a deploy asks for chunks that no longer exist.
//
// The route JavaScript this page was served with is addressed by a build id.
// Deploy again and those files leave the CDN, so the pages already rendered
// keep working while every navigation out of them fails — which reads as
// "half the site stopped loading", is fixed by reopening the tab, and is
// therefore reported as a mystery. It is not one: it is the client and the
// server disagreeing about which build they are in.
//
// The message is not standardised, so this matches what each engine actually
// throws rather than a single name: `ChunkLoadError` (webpack), the two
// dynamic-import failures Chrome and Firefox word differently, and Safari's
// own phrasing.
const STALE_DEPLOYMENT = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isStaleDeploymentError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  return STALE_DEPLOYMENT.test(String(error.message || error));
}
export function reportLoadError(scope, error) {
  if (isQuotaExceededError(error) || error?.status === 503) {
    noteQuotaRefusal();
    console.warn(`${scope} temporarily unavailable:`, error);
    return;
  }
  console.error(scope, error);
}

export function createResponseError(response, result, fallbackMessage) {
  const error = new Error(result?.error || fallbackMessage);
  error.status = response.status;
  error.code = result?.code || null;
  return error;
}

const API_ERROR_MESSAGES = Object.freeze({
  INVALID_PROJECT_SCOPE: 'Обраний проєкт недоступний у цій організації',
  INVALID_ESTIMATE: 'Оцінка завдання виходить за допустимі межі',
  INVALID_SCOPE: 'Оберіть доступні організацію та проєкт',
  LEGACY_EPIC_TYPE: 'Нові епіки створювати не можна',
  LEGACY_PARENT_FIELD: 'Оновіть форму й повторіть створення завдання',
  RATE_LIMITED: 'Забагато спроб. Зачекайте хвилину й повторіть',
});

// Продукт розмовляє українською, і помилка — це теж мова продукту.
//
// Текст помилки приходить не лише з нашого коду. Він приходить від Node, від
// Firebase, від чужого API, і з бази — там лежать рядки, записані ще до того,
// як їх навчилися перекладати. Саме так під смугою прогресу імпорту опинилося
// «Unsupported state or unable to authenticate data»: Node так називає збитий
// GCM-тег, importer записав це в job, а екран надрукував як є. Джерело того
// випадку вже виправлене, але рядок лишився в базі — і зʼявиться знову, щойно
// зламається щось інше.
//
// Тому запобіжник стоїть не в місці поломки, а на межі виводу — тут, де вже
// вирішується, що саме побачить людина.
const FOREIGN_MESSAGES = [
  // Відмова чужого трекера — перша в списку, і не випадково.
  //
  // «YouTrack 401: Unauthorized» збігався нижче з голкою `unauthorized` і
  // виходив на екран як «Потрібно увійти заново» — тобто продукт повідомляв, що
  // протух сеанс у QuickTeam, тоді як протух постійний токен YouTrack, і з тієї
  // фрази до справжнього виправлення не вело нічого. Нові помилки позначаються
  // на місці кидка (`error.source`), але в базі вже лежать рядки, записані в
  // `job.lastError` до того, як це навчилися розрізняти, і вони так і
  // друкуватимуться, доки їх не перекласти тут.
  ['youtrack 401', 'YouTrack не прийняв збережений токен. Введіть новий — перенесене залишиться на місці.'],
  ['youtrack 403', 'Токен YouTrack не має доступу до цих даних. Перевірте його права або введіть інший.'],
  [
    'unsupported state or unable to authenticate data',
    'Збережений токен більше не вдається прочитати. Відключіть інтеграцію та підключіть її знову — уже перенесені дані залишаться на місці.',
  ],
  ['failed to fetch', 'Не вдалося звʼязатися із сервером. Перевірте зʼєднання та спробуйте ще раз.'],
  ['network error', 'Не вдалося звʼязатися із сервером. Перевірте зʼєднання та спробуйте ще раз.'],
  ['networkerror', 'Не вдалося звʼязатися із сервером. Перевірте зʼєднання та спробуйте ще раз.'],
  ['request timed out', 'Сервер не відповів вчасно. Спробуйте ще раз.'],
  ['missing or insufficient permissions', 'Недостатньо прав для цієї дії.'],
  ['permission denied', 'Недостатньо прав для цієї дії.'],
  ['unauthorized', 'Потрібно увійти заново.'],
  ['forbidden', 'Недостатньо прав для цієї дії.'],
];

const CYRILLIC = /[\u0400-\u04FF]/;

/**
 * Текст помилки, яким його можна показати людині.
 *
 * Рядок із кирилицею — уже наш, він повертається як є. Усе інше або має відомий
 * український відповідник, або замінюється на `fallbackMessage`: краще чесне
 * «не вийшло, спробуйте ще раз», ніж чужий технічний рядок англійською.
 *
 * Беремо саме рядок, а не Error: половина таких текстів приходить не з
 * винятку, а з бази — як `job.lastError`.
 */
export function errorTextUk(raw, fallbackMessage = 'Щось пішло не так. Спробуйте ще раз.') {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return fallbackMessage;
  if (CYRILLIC.test(text)) return text;
  const lowered = text.toLowerCase();
  for (const [needle, translation] of FOREIGN_MESSAGES) {
    if (lowered.includes(needle)) return translation;
  }
  return fallbackMessage;
}

/**
 * Prefer a stable localized API code, then the server's actionable message —
 * and never a sentence in a language the product does not speak.
 */
export function userFacingErrorMessage(error, fallbackMessage) {
  const mapped = API_ERROR_MESSAGES[error?.code];
  if (mapped) return mapped;
  const message = typeof error?.message === 'string' ? error.message : '';
  return errorTextUk(message, fallbackMessage ?? 'Щось пішло не так. Спробуйте ще раз.');
}
