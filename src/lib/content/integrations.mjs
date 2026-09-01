export const INTEGRATION_STATES = Object.freeze({
  available: 'Доступно',
  planned: 'У планах',
});

// П'ять слів на всі інтеграції, і жодного шостого.
//
// Кожен екран писав власні. qTicket казав «Активовано», «Не активовано», «Не
// налаштовано на сервері» і «Помилка синхронізації»; Telegram — «Підключено»,
// «Налаштування», «Вимкнено», «Недоступно»; QuickTeam+ і BuggyBag —
// «Підключено» / «Вимкнено»; YouTrack — «Готово до імпорту», «Перевіряємо»,
// «Не налаштовано». Одинадцять різних написів на чотири стани, з яких
// «Вимкнено» і «Не активовано» — той самий стан двома словами, а «Готово до
// імпорту» й «Підключено» — той самий стан із різних боків.
//
// Слово більше не пишеться в місці показу: інтеграція повертає ключ, а напис і
// тон беруться звідси. Розійтися вони тепер не можуть, бо писати їх нема де.
//
// `tone` — це роль із `Pill`, а не колір. «Підключено» темне, а не зелене:
// зелений у продукті означає «вийшло», а не «увімкнено», і на списку з п'яти
// рядків він був єдиною теплою плямою й перекрикував назви сервісів.
export const INTEGRATION_STATUS = Object.freeze({
  connected: Object.freeze({ label: 'Підключено', tone: 'dark' }),
  idle: Object.freeze({ label: 'Не підключено', tone: 'neutral' }),
  connecting: Object.freeze({ label: 'Підключаємо', tone: 'neutral' }),
  error: Object.freeze({ label: 'Помилка', tone: 'danger' }),
  unavailable: Object.freeze({ label: 'Недоступно', tone: 'neutral' }),
});

/**
 * Напис і тон для стану підключення.
 *
 * Невідомий ключ — це помилка виклику, а не привід намалювати порожню пігулку,
 * тож він читається як «Недоступно»: єдиний зі станів, що нічого не обіцяє.
 *
 * @param {'connected'|'idle'|'connecting'|'error'|'unavailable'} key
 */
export function integrationStatus(key) {
  return INTEGRATION_STATUS[key] || INTEGRATION_STATUS.unavailable;
}

export const INTEGRATIONS = Object.freeze([
  Object.freeze({ id: 'qticket', label: 'qTicket', state: 'available', route: '/settings?section=integrations' }),
  Object.freeze({ id: 'quickteam-plus', label: 'QuickTeam+', state: 'available', route: '/settings?section=integrations' }),
  Object.freeze({ id: 'telegram', label: 'Telegram', state: 'available', route: '/settings?section=integrations' }),
  Object.freeze({ id: 'buggybag', label: 'BuggyBag', state: 'available', route: '/settings?section=integrations' }),
  Object.freeze({ id: 'youtrack', label: 'YouTrack', state: 'available', route: '/settings?section=migrations' }),
  Object.freeze({ id: 'jira', label: 'Jira', state: 'planned' }),
  Object.freeze({ id: 'clickup', label: 'ClickUp', state: 'planned' }),
  Object.freeze({ id: 'asana', label: 'Asana', state: 'planned' }),
  Object.freeze({ id: 'trello', label: 'Trello', state: 'planned' }),
  Object.freeze({ id: 'linear', label: 'Linear', state: 'planned' }),
  Object.freeze({ id: 'monday', label: 'monday.com', state: 'planned' }),
]);

export const AVAILABLE_INTEGRATIONS = INTEGRATIONS.filter(item => item.state === 'available');
export const PLANNED_INTEGRATIONS = INTEGRATIONS.filter(item => item.state === 'planned');
