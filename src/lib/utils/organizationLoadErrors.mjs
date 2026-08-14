export function organizationLoadErrorKind(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('permission-denied') || message.includes('insufficient permissions')) {
    return 'permission-denied';
  }
  if (code.includes('not-found')) return 'not-found';
  if (
    code.includes('unavailable')
    || code.includes('deadline-exceeded')
    || code.includes('network')
    || message.includes('offline')
    || message.includes('network')
  ) {
    return 'retryable';
  }
  return 'unexpected';
}

export function shouldRetryOrganizationLoad(error) {
  return organizationLoadErrorKind(error) === 'retryable';
}

export function organizationLoadRetryDelay(attempt) {
  return [250, 750, 1_500][Math.max(0, Math.min(2, attempt - 1))];
}
