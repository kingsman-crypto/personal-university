import fs from 'fs';
import path from 'path';
import { Course, NewsletterSettings, NewsletterIssue } from './types';
import { INITIAL_COURSES, INITIAL_NEWSLETTER_SETTINGS } from './initialData';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const HISTORY_FILE = path.join(DATA_DIR, 'dispatch_history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getServerSettings(): NewsletterSettings {
  ensureDataDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...INITIAL_NEWSLETTER_SETTINGS,
        ...parsed,
        gmailUser: parsed.gmailUser || process.env.GMAIL_USER || INITIAL_NEWSLETTER_SETTINGS.gmailUser,
        gmailAppPassword: parsed.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || INITIAL_NEWSLETTER_SETTINGS.gmailAppPassword,
      };
    }
  } catch (err) {
    console.error('Error reading settings from data/settings.json:', err);
  }

  // First time initialization
  const initialSettings: NewsletterSettings = {
    ...INITIAL_NEWSLETTER_SETTINGS,
    gmailUser: process.env.GMAIL_USER || INITIAL_NEWSLETTER_SETTINGS.gmailUser,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || INITIAL_NEWSLETTER_SETTINGS.gmailAppPassword,
  };
  saveServerSettings(initialSettings);
  return initialSettings;
}

export function saveServerSettings(settings: NewsletterSettings): void {
  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings to data/settings.json:', err);
  }
}

export function getServerCourses(): Course[] {
  ensureDataDir();
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const raw = fs.readFileSync(COURSES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a: Course, b: Course) => a.order - b.order);
      }
    }
  } catch (err) {
    console.error('Error reading courses from data/courses.json:', err);
  }

  saveServerCourses(INITIAL_COURSES);
  return INITIAL_COURSES;
}

export function saveServerCourses(courses: Course[]): void {
  ensureDataDir();
  try {
    const normalized = courses.map((course, idx) => ({
      ...course,
      order: idx,
      updatedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(COURSES_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving courses to data/courses.json:', err);
  }
}

export function getServerHistory(): NewsletterIssue[] {
  ensureDataDir();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading history from data/dispatch_history.json:', err);
  }
  return [];
}

export function saveServerHistory(history: NewsletterIssue[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving history to data/dispatch_history.json:', err);
  }
}
