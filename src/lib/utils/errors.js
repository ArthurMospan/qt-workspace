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

/** Prefer the server's actionable message without ever rendering an empty toast. */
export function userFacingErrorMessage(error, fallbackMessage) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message || fallbackMessage;
}
