import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { runScheduledNotificationSweep } from '@/lib/server/reminderJobs';

// The last secret here still compared with `!==`. Telegram's webhook secret and
// the API keys both use a constant-time comparison already; this one is the odd
// one out rather than a new risk, and matching them costs a function call.
function presentedSecretMatches(header, expected) {
  const a = Buffer.from(String(header || ''));
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// `mode` splits the cheap half from the expensive one so an external scheduler
// can drive delivery on a tight interval without paying for a collection scan
// every minute:
//
//   ?mode=dispatch      — send what is due. One indexed query, no state read and
//                         no state write; safe every minute.
//   ?mode=maintenance   — empty «Нещодавно видалене» past its window and expire
//                         read records. Two bounded queries; hourly.
//   ?mode=materialise   — restock the outbox from the source data and post
//                         birthday greetings. Nightly; a safety net, because the
//                         rows are written when the deadline is set.
//   (default) full      — all three, with materialising self-throttled internally.
//
// See docs/ARCHITECTURE.md.
const MODES = new Set(['full', 'dispatch', 'maintenance', 'materialise']);

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  if (!cronSecret || !presentedSecretMatches(request.headers.get('authorization'), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get('mode') || 'full';
  if (!MODES.has(requested)) {
    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  }

  try {
    const result = await runScheduledNotificationSweep({ mode: requested });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'scheduled notifications',
      fallbackMessage: 'Scheduled notification sweep failed',
    });
  }
}
