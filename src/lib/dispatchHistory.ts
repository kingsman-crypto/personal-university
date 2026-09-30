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

const COMMON_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'today', 'poem', 'artifact', 'thought',
  'experiment', 'paradox', 'invention', 'history', 'design', 'philosophy',
  'mind', 'consciousness', 'over', 'time', 'into', 'what', 'like', 'some',
  'about', 'world', 'modern', 'human', 'first', 'idea', 'theory', 'view',
  'plain', 'spring', 'night', 'river', 'room', 'park', 'note', 'case',
  'problem', 'focus', 'module', 'series', 'wang', 'li', 'du', 'bai', 'zhang'
]);

function extractChineseCharacters(str: string): string {
  const match = (str || '').match(/[\u4e00-\u9fa5]+/g);
  return match ? match.join('') : '';
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

  for (const issue of history) {
    const section = (issue.sections || []).find((s) => s.courseId === courseId);
    if (section) {
      const subject = extractSubjectFromSection(section);
      subjectsSet.add(subject);
      const cleaned = normalizeSubject(subject);
      const words = cleaned
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter((w) => w.length >= 4 && !COMMON_STOPWORDS.has(w));
      for (const word of words) {
        keywordsSet.add(word);
      }

      if (Array.isArray(section.subjectKeywords)) {
        for (const kw of section.subjectKeywords) {
          const cleanKw = kw.toLowerCase().trim();
          if (cleanKw.length >= 4 && !COMMON_STOPWORDS.has(cleanKw)) {
            keywordsSet.add(cleanKw);
          }
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
 * Checks if a candidate subject duplicates any past subject
 */
export function isSubjectDuplicate(
  courseId: string,
  candidateSubject: string,
  _candidateContent: string = ''
): { isDuplicate: boolean; matchedSubject?: string } {
  const { subjects, keywords } = getPastSubjectsForCourse(courseId);

  const normCandidate = normalizeSubject(candidateSubject);
  const candChinese = extractChineseCharacters(candidateSubject);

  for (const past of subjects) {
    const normPast = normalizeSubject(past);
    const pastChinese = extractChineseCharacters(past);

    // 1. Exact normalized match
    if (normPast === normCandidate) {
      return { isDuplicate: true, matchedSubject: past };
    }

    // 2. Chinese poem title match (e.g. 《静夜思》, 《鹿柴》, 《春望》)
    if (candChinese && pastChinese && candChinese.length >= 2 && pastChinese.length >= 2) {
      if (candChinese.includes(pastChinese) || pastChinese.includes(candChinese)) {
        return { isDuplicate: true, matchedSubject: `Chinese title match: "${past}"` };
      }
    }

    // 3. Substring match for distinct multi-word titles (7+ chars)
    if (normPast.length >= 7 && normCandidate.includes(normPast)) {
      return { isDuplicate: true, matchedSubject: past };
    }
    if (normCandidate.length >= 7 && normPast.includes(normCandidate)) {
      return { isDuplicate: true, matchedSubject: past };
    }
  }

  // 4. Distinctive entity keyword match in candidate title
  const candidateWords = normCandidate
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter((w) => w.length >= 4 && !COMMON_STOPWORDS.has(w));

  for (const kw of keywords) {
    if (candidateWords.includes(kw)) {
      return { isDuplicate: true, matchedSubject: `Entity keyword match: "${kw}"` };
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
