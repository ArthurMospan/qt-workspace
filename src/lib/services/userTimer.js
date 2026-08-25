'use client';

import { authenticatedRequest } from '@/lib/services/authenticatedRequest';

export function startUserTimer(input) {
  return authenticatedRequest('/api/timer/start', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 'Не вдалося запустити таймер');
}

export function stopUserTimer(timerId, requestedAt = null) {
  return authenticatedRequest('/api/timer/stop', {
    method: 'POST',
    body: JSON.stringify({ timerId, ...(requestedAt ? { requestedAt } : {}) }),
  }, 'Не вдалося зупинити таймер');
}

export function discardPendingUserTimer(timerId) {
  return authenticatedRequest('/api/timer/pending', {
    method: 'DELETE',
    body: JSON.stringify({ timerId }),
  }, 'Не вдалося відхилити відстежений час');
}
