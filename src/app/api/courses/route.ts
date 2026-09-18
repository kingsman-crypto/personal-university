import { NextRequest, NextResponse } from 'next/server';
import { getServerCourses, saveServerCourses } from '@/lib/serverStorage';
import { Course } from '@/lib/types';

export async function GET() {
  try {
    const courses = getServerCourses();
    return NextResponse.json({ success: true, courses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching courses';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const courses = body as Course[];

    if (!Array.isArray(courses)) {
      return NextResponse.json(
        { success: false, error: 'Courses must be an array' },
        { status: 400 }
      );
    }

    saveServerCourses(courses);
    return NextResponse.json({
      success: true,
      courses,
      message: 'Courses saved successfully on server.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error saving courses';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
