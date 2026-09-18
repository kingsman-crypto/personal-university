import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerStatus, executeScheduledDispatch, reloadScheduler } from '@/lib/serverScheduler';

export async function GET() {
  try {
    const status = getSchedulerStatus();
    return NextResponse.json({ success: true, status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching scheduler status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action?: 'dispatch_now' | 'reload' };

    if (action === 'dispatch_now') {
      const result = await executeScheduledDispatch('manual');
      return NextResponse.json(result);
    }

    if (action === 'reload') {
      reloadScheduler();
      return NextResponse.json({ success: true, message: 'Scheduler reloaded' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scheduler action failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
