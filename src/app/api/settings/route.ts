import { NextRequest, NextResponse } from 'next/server';
import { getServerSettings, saveServerSettings } from '@/lib/serverStorage';
import { reloadScheduler } from '@/lib/serverScheduler';
import { NewsletterSettings } from '@/lib/types';

export async function GET() {
  try {
    const settings = getServerSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = body as NewsletterSettings;

    if (!settings || !settings.recipientEmail) {
      return NextResponse.json(
        { success: false, error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    saveServerSettings(settings);
    // Reload scheduler with new schedule and credentials
    try {
      reloadScheduler();
    } catch (schedErr) {
      console.warn('Could not reload scheduler immediately:', schedErr);
    }

    return NextResponse.json({
      success: true,
      settings,
      message: 'Settings and delivery schedule saved successfully to server.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error saving settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
