export function isQuotaExceededError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '8'
    || code.includes('resource-exhausted')
    || code.includes('quota')
    || message.includes('resource_exhausted')
    || message.includes('quota exceeded');
}

export function reportLoadError(scope, error) {
  if (isQuotaExceededError(error) || error?.status === 503) {
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

/** Prefer a stable localized API code, then the server's actionable message. */
export function userFacingErrorMessage(error, fallbackMessage) {
  const mapped = API_ERROR_MESSAGES[error?.code];
  if (mapped) return mapped;
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message || fallbackMessage;
}
