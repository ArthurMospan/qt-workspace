import { NextResponse } from 'next/server';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { runScheduledNotificationSweep } from '@/lib/server/reminderJobs';

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runScheduledNotificationSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'scheduled notifications',
      fallbackMessage: 'Scheduled notification sweep failed',
    });
  }
}
