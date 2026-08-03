import { NextResponse } from 'next/server';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { runScheduledNotificationSweep } from '@/lib/server/reminderJobs';

// `mode` splits the cheap half from the expensive one so an external scheduler
// can drive delivery on a tight interval without paying for a collection scan
// every minute:
//
//   ?mode=dispatch      — send what is due. One indexed query; safe every minute.
//   ?mode=materialise   — restock the outbox and post birthday greetings.
//   (default) full      — both, with materialising self-throttled internally.
//
// See docs/NOTIFICATION_DELIVERY.md.
const MODES = new Set(['full', 'dispatch', 'materialise']);

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
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
