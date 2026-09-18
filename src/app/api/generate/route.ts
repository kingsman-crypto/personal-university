import { NextRequest, NextResponse } from 'next/server';
import { generateCourseSectionContent } from '@/lib/gemini';
import { Course, NewsletterSettings, NewsletterIssue } from '@/lib/types';
import { getPastTopicsForCourse } from '@/lib/dispatchHistory';
import { getServerHistory } from '@/lib/serverStorage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, course, courses, settings, apiKey } = body as {
      mode?: 'single' | 'full';
      course?: Course;
      courses?: Course[];
      settings?: NewsletterSettings;
      apiKey?: string;
    };

    const todayStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());

    const history = getServerHistory();
    const editionNumber = history.length + 1;

    if (mode === 'single' && course) {
      const pastTopics = getPastTopicsForCourse(course.id);
      const section = await generateCourseSectionContent({
        course,
        date: todayStr,
        apiKey,
        pastTopics,
        editionNumber,
      });
      return NextResponse.json(section);
    }

    // Full combined issue generation
    const activeCourses = (courses || []).filter((c) => c.enabled);

    if (activeCourses.length === 0) {
      return NextResponse.json(
        { error: 'No active courses enabled for today\'s newsletter dispatch.' },
        { status: 400 }
      );
    }

    // Generate section for each course with anti-repetition past topics
    const sections = await Promise.all(
      activeCourses.map((c) => {
        const pastTopics = getPastTopicsForCourse(c.id);
        return generateCourseSectionContent({
          course: c,
          date: todayStr,
          apiKey,
          pastTopics,
          editionNumber,
        });
      })
    );

    const issue: NewsletterIssue = {
      id: `dispatch-${Date.now()}`,
      date: todayStr,
      editionNumber,
      title: settings?.title || 'The Personal University Dispatch',
      sections,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(issue);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown generation error';
    console.error('API /api/generate error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
