import { NextResponse } from 'next/server';
import { getAllDispatches, getLastDispatch } from '@/lib/dispatchHistory';

export async function GET() {
  try {
    const dispatches = getAllDispatches();
    const last = getLastDispatch();
    return NextResponse.json({
      success: true,
      total: dispatches.length,
      lastDispatch: last,
      history: dispatches.slice().reverse(), // most recent first
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching history';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
