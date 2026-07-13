import 'server-only';

import { NextResponse } from 'next/server';
import { isQuotaExceededError } from '@/lib/utils/errors';

export function routeErrorResponse(error, { context, fallbackMessage }) {
  if (isQuotaExceededError(error)) {
    console.warn(`[${context}] Firestore quota exceeded`);
    return NextResponse.json({
      error: 'Database is temporarily unavailable because its quota is exhausted',
      code: 'firestore-quota-exceeded',
    }, {
      status: 503,
      headers: { 'Retry-After': '60' },
    });
  }

  console.error(`[${context}]`, error);
  return NextResponse.json({ error: fallbackMessage, code: 'internal-error' }, { status: 500 });
}
