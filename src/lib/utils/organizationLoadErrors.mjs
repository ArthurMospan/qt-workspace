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
  const kind = organizationLoadErrorKind(error);
  // A permission denial is retried, not believed on sight.
  //
  // Signing out and signing back in swaps the Firestore credential underneath
  // listeners that are already attached, and the first snapshot to arrive
  // across that swap is routinely rejected: the reader has not lost anything,
  // the listener is simply a moment older than the account holding it. Taking
  // that first rejection at face value is how an ordinary re-login ends on
  // «Ваш обліковий запис більше не має доступу до цієї організації» — a
  // terminal sentence about data that is sitting there intact.
  //
  // The retry budget bounds it: an account that really has been removed says
  // so a couple of hundred milliseconds later, and says it once it is true.
  return kind === 'retryable' || kind === 'permission-denied';
}

export function organizationLoadRetryDelay(attempt) {
  return [250, 750, 1_500][Math.max(0, Math.min(2, attempt - 1))];
}
