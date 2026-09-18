import { NewsletterIssue, NewsletterSection } from './types';
import { getServerHistory, saveServerHistory } from './serverStorage';

export function getAllDispatches(): NewsletterIssue[] {
  return getServerHistory();
}

export function getLastDispatch(): NewsletterIssue | null {
  const history = getServerHistory();
  if (history.length === 0) return null;
  return history[history.length - 1];
}

/**
 * Normalizes a subject string to lowercase alphanumeric tokens for robust comparison
 */
export function normalizeSubject(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»《》""'']/g, '')
    .replace(/^(today's poem|the artifact|the thought experiment|the paradox|the invention|the structure):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the core subject/entity name from a section
 */
export function extractSubjectFromSection(section: Partial<NewsletterSection>): string {
  if (section.subject && section.subject.trim()) {
    return section.subject.trim();
  }

  const text = `${section.topicTitle || ''}\n${section.content || ''}`;

  // Check for explicit SUBJECT_ENTITY tag
  const tagMatch = text.match(/SUBJECT_ENTITY:\s*([^\n\r]+)/i);
  if (tagMatch) {
    return tagMatch[1].trim();
  }

  // Check for header title
  const headerMatch = text.match(/^###\s+([^\n\r]+)/m);
  if (headerMatch) {
    const raw = headerMatch[1].trim();
    return raw
      .replace(/^(today's poem|the artifact|the thought experiment|the paradox|the invention|the structure):\s*/i, '')
      .trim();
  }

  return section.topicTitle || section.courseTitle || 'General Lesson';
}

/**
 * Returns all past covered subjects and keyword stems for a course
 */
export function getPastSubjectsForCourse(courseId: string): {
  subjects: string[];
  keywords: string[];
} {
  const history = getServerHistory();
  const subjectsSet = new Set<string>();
  const keywordsSet = new Set<string>();

  // Helper to extract key nouns from a subject name
  const addKeywords = (name: string) => {
    const cleaned = normalizeSubject(name);
    // Split into words, ignore small stopwords
    const words = cleaned
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'from', 'today', 'poem', 'artifact'].includes(w));
    for (const word of words) {
      keywordsSet.add(word);
    }
  };

  for (const issue of history) {
    const section = issue.sections.find((s) => s.courseId === courseId);
    if (section) {
      const subject = extractSubjectFromSection(section);
      subjectsSet.add(subject);
      addKeywords(subject);

      if (section.topicTitle) {
        addKeywords(section.topicTitle);
      }
      if (Array.isArray(section.subjectKeywords)) {
        for (const kw of section.subjectKeywords) {
          keywordsSet.add(kw.toLowerCase().trim());
        }
      }
    }
  }

  return {
    subjects: Array.from(subjectsSet),
    keywords: Array.from(keywordsSet),
  };
}

/**
 * Checks if a candidate subject or generated text duplicates any past subject
 */
export function isSubjectDuplicate(
  courseId: string,
  candidateSubject: string,
  candidateContent: string = ''
): { isDuplicate: boolean; matchedSubject?: string } {
  const { subjects, keywords } = getPastSubjectsForCourse(courseId);

  const normCandidate = normalizeSubject(candidateSubject);
  const normContent = candidateContent.toLowerCase();

  // 1. Direct normalized match
  for (const past of subjects) {
    const normPast = normalizeSubject(past);
    if (normCandidate.includes(normPast) || normPast.includes(normCandidate)) {
      return { isDuplicate: true, matchedSubject: past };
    }
  }

  // 2. High-salience keyword stem collision
  // E.g. "zipper" or "sundback" or "静夜思" or "mary's room"
  for (const kw of keywords) {
    if (kw.length >= 4) {
      // If candidate subject title explicitly contains the past keyword
      if (normCandidate.includes(kw)) {
        return { isDuplicate: true, matchedSubject: `Keyword stem match: "${kw}"` };
      }
      // If content focuses heavily on the past keyword
      const occurrences = (normContent.match(new RegExp(`\\b${kw}\\b`, 'gi')) || []).length;
      if (occurrences >= 3) {
        return { isDuplicate: true, matchedSubject: `Heavy content recurrence: "${kw}" (${occurrences}x)` };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Returns a list of past topic summaries for prompt injection
 */
export function getPastTopicsForCourse(courseId: string): string[] {
  const history = getServerHistory();
  const topics: string[] = [];

  for (const issue of history) {
    const section = issue.sections.find((s) => s.courseId === courseId);
    if (section) {
      const subject = extractSubjectFromSection(section);
      topics.push(`${subject} (Edition #${issue.editionNumber}, ${issue.date})`);
    }
  }

  return topics;
}

export function recordDispatch(issue: NewsletterIssue): void {
  const history = getServerHistory();

  // Ensure every section has subject and subjectKeywords populated
  const enrichedSections = issue.sections.map((sec) => {
    const subject = extractSubjectFromSection(sec);
    const keywords = normalizeSubject(subject)
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((w) => w.length >= 3);
    return {
      ...sec,
      subject,
      subjectKeywords: keywords,
    };
  });

  const enrichedIssue: NewsletterIssue = {
    ...issue,
    sections: enrichedSections,
  };

  const existingIdx = history.findIndex((h) => h.id === issue.id);
  if (existingIdx >= 0) {
    history[existingIdx] = enrichedIssue;
  } else {
    history.push(enrichedIssue);
  }
  saveServerHistory(history);
}

export function hasDispatchedToday(dateStr: string): boolean {
  const history = getServerHistory();
  return history.some((issue) => issue.date.trim() === dateStr.trim());
}
