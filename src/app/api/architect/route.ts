import { NextRequest, NextResponse } from 'next/server';
import { runArchitectChat } from '@/lib/gemini';
import { Course } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, course, apiKey } = body as {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      course: Course;
      apiKey?: string;
    };

    if (!messages || !Array.isArray(messages) || !course) {
      return NextResponse.json(
        { error: 'Missing required fields: messages and course' },
        { status: 400 }
      );
    }

    const result = await runArchitectChat({
      messages,
      course,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    console.error('API /api/architect error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
