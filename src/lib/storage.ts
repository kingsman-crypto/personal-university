import { Course, NewsletterSettings } from './types';
import { INITIAL_COURSES, INITIAL_NEWSLETTER_SETTINGS } from './initialData';

const COURSES_STORAGE_KEY = 'personal_university_courses_v1';
const SETTINGS_STORAGE_KEY = 'personal_university_settings_v1';
const API_KEY_STORAGE_KEY = 'personal_university_gemini_key';
const CHAT_STORAGE_PREFIX = 'personal_university_chat_';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function dispatchStorageEvent(key: string) {
  if (isBrowser) {
    window.dispatchEvent(new CustomEvent('pu_storage_updated', { detail: { key } }));
  }
}

export function getCourses(): Course[] {
  if (!isBrowser) return INITIAL_COURSES;
  try {
    const raw = window.localStorage.getItem(COURSES_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(INITIAL_COURSES));
      return INITIAL_COURSES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_COURSES;
    }
    // Ensure properly sorted by order property
    return parsed.sort((a: Course, b: Course) => a.order - b.order);
  } catch (err) {
    console.error('Failed to read courses from localStorage:', err);
    return INITIAL_COURSES;
  }
}

export function saveCourses(courses: Course[]): void {
  if (!isBrowser) return;
  try {
    // Normalise order indices
    const normalized = courses.map((course, idx) => ({
      ...course,
      order: idx,
      updatedAt: new Date().toISOString(),
    }));
    window.localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(normalized));
    dispatchStorageEvent(COURSES_STORAGE_KEY);

    fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    }).catch((err) => console.warn('Failed to sync courses to server:', err));
  } catch (err) {
    console.error('Failed to save courses to localStorage:', err);
  }
}

export function getCourseById(id: string): Course | undefined {
  const courses = getCourses();
  return courses.find((c) => c.id === id);
}

export function updateCourse(id: string, updates: Partial<Course>): Course | undefined {
  const courses = getCourses();
  const index = courses.findIndex((c) => c.id === id);
  if (index === -1) return undefined;

  const updated: Course = {
    ...courses[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  courses[index] = updated;
  saveCourses(courses);
  return updated;
}

export function createCourse(newCourse: Omit<Course, 'id' | 'order' | 'createdAt' | 'updatedAt'>): Course {
  const courses = getCourses();
  const id = newCourse.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `course-${Date.now()}`;

  // Check unique ID
  const uniqueId = courses.some((c) => c.id === id) ? `${id}-${Date.now().toString().slice(-4)}` : id;

  const course: Course = {
    ...newCourse,
    id: uniqueId,
    order: courses.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  courses.push(course);
  saveCourses(courses);
  return course;
}

export function deleteCourse(id: string): void {
  const courses = getCourses();
  const filtered = courses.filter((c) => c.id !== id);
  saveCourses(filtered);
}

export function toggleCourseEnabled(id: string): boolean {
  const courses = getCourses();
  const course = courses.find((c) => c.id === id);
  if (!course) return false;
  const newStatus = !course.enabled;
  updateCourse(id, { enabled: newStatus });
  return newStatus;
}

export function reorderCourses(activeId: string, overId: string): Course[] {
  const courses = getCourses();
  const oldIndex = courses.findIndex((c) => c.id === activeId);
  const newIndex = courses.findIndex((c) => c.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return courses;
  }

  const reordered = [...courses];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  saveCourses(reordered);
  return reordered;
}

export function getNewsletterSettings(): NewsletterSettings {
  if (!isBrowser) return INITIAL_NEWSLETTER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(INITIAL_NEWSLETTER_SETTINGS));
      return INITIAL_NEWSLETTER_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    if (parsed.recipientEmail === 'scholar@example.com') {
      parsed.recipientEmail = INITIAL_NEWSLETTER_SETTINGS.recipientEmail;
      parsed.recipientName = INITIAL_NEWSLETTER_SETTINGS.recipientName;
    }
    if (!parsed.gmailUser && INITIAL_NEWSLETTER_SETTINGS.gmailUser) {
      parsed.gmailUser = INITIAL_NEWSLETTER_SETTINGS.gmailUser;
    }
    if (!parsed.gmailAppPassword && INITIAL_NEWSLETTER_SETTINGS.gmailAppPassword) {
      parsed.gmailAppPassword = INITIAL_NEWSLETTER_SETTINGS.gmailAppPassword;
    }
    if (!parsed.emailProvider || parsed.emailProvider === 'mock') {
      parsed.emailProvider = INITIAL_NEWSLETTER_SETTINGS.emailProvider;
    }
    return { ...INITIAL_NEWSLETTER_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Failed to read settings from localStorage:', err);
    return INITIAL_NEWSLETTER_SETTINGS;
  }
}

export function saveNewsletterSettings(settings: NewsletterSettings): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    dispatchStorageEvent(SETTINGS_STORAGE_KEY);

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch((err) => console.warn('Failed to sync settings to server:', err));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}

export function getStoredApiKey(): string {
  if (!isBrowser) return '';
  return window.localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

export function saveStoredApiKey(key: string): void {
  if (!isBrowser) return;
  window.localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  dispatchStorageEvent(API_KEY_STORAGE_KEY);
}

export function getChatHistory(courseId: string) {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(`${CHAT_STORAGE_PREFIX}${courseId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(courseId: string, messages: unknown[]): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(`${CHAT_STORAGE_PREFIX}${courseId}`, JSON.stringify(messages));
  } catch (err) {
    console.error('Failed to save chat history:', err);
  }
}

export function resetToDefaults(): void {
  if (!isBrowser) return;
  window.localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(INITIAL_COURSES));
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(INITIAL_NEWSLETTER_SETTINGS));
  dispatchStorageEvent(COURSES_STORAGE_KEY);
  dispatchStorageEvent(SETTINGS_STORAGE_KEY);
}
