#!/usr/bin/env node

/**
 * Autonomous Cloud & Local Dispatcher for Personal University
 *
 * Can be executed in:
 * 1. GitHub Actions (scheduled cloud cron without computer being on)
 * 2. Standalone Node.js process / cloud server / container
 * 3. Local CLI testing
 *
 * Usage:
 *   node scripts/cloud-dispatch.mjs           # Run standard scheduled check (checks day/duplicate)
 *   node scripts/cloud-dispatch.mjs --force   # Force run dispatch now (skip day/duplicate check)
 *   node scripts/cloud-dispatch.mjs --dry-run # Simulate generation & preview without sending/saving
 *   node scripts/cloud-dispatch.mjs --status  # Print current scheduler status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const HISTORY_FILE = path.join(DATA_DIR, 'dispatch_history.json');

// Load .env.local and .env if present (when executed in CLI or standalone Node)
function loadEnvFiles() {
  const envFiles = [path.join(ROOT_DIR, '.env.local'), path.join(ROOT_DIR, '.env')];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      try {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
    }
  }
}
loadEnvFiles();

// Command line arguments
const args = process.argv.slice(2);
const isForce = args.includes('--force');
const isDryRun = args.includes('--dry-run');
const isStatus = args.includes('--status');

function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function getZonedParts(timeZone = 'America/New_York', date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';

    const weekdayShort = get('weekday');
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');

    const weekdayMap = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const dayOfWeek = weekdayMap[weekdayShort] ?? date.getDay();
    const timeHHMM = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    const dateKey = `${year}-${month}-${day}`;

    const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const fullDateStr = fullDateFormatter.format(date);

    return { dayOfWeek, timeHHMM, dateKey, fullDateStr };
  } catch {
    const dayOfWeek = date.getDay();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return {
      dayOfWeek,
      timeHHMM: `${hour}:${minute}`,
      dateKey: date.toISOString().slice(0, 10),
      fullDateStr: date.toDateString(),
    };
  }
}

function normalizeSubject(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[«»《》""'']/g, '')
    .replace(/^(today's poem|the artifact|the thought experiment|the paradox|the invention|the structure):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSubjectFromSection(section) {
  if (section.subject && section.subject.trim()) {
    return section.subject.trim();
  }
  const text = `${section.topicTitle || ''}\n${section.content || ''}`;
  const tagMatch = text.match(/SUBJECT_ENTITY:\s*([^\n\r]+)/i);
  if (tagMatch) return tagMatch[1].trim();

  const headerMatch = text.match(/^###\s+([^\n\r]+)/m);
  if (headerMatch) {
    return headerMatch[1]
      .trim()
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

function extractChineseCharacters(str) {
  const match = (str || '').match(/[\u4e00-\u9fa5]+/g);
  return match ? match.join('') : '';
}

function getPastSubjectsForCourse(history, courseId) {
  const subjectsSet = new Set();
  const keywordsSet = new Set();

  for (const issue of history) {
    const section = (issue.sections || []).find((s) => s.courseId === courseId);
    if (section) {
      const subject = extractSubjectFromSection(section);
      subjectsSet.add(subject);
      const cleaned = normalizeSubject(subject);
      const words = cleaned
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter((w) => w.length >= 4 && !COMMON_STOPWORDS.has(w));
      for (const word of words) keywordsSet.add(word);

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

  return { subjects: Array.from(subjectsSet), keywords: Array.from(keywordsSet) };
}

function isSubjectDuplicate(history, courseId, candidateSubject, candidateContent = '') {
  const { subjects, keywords } = getPastSubjectsForCourse(history, courseId);
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

    // 3. Substring match for distinct multi-word titles (7+ chars, e.g. "safety pin", "ballpoint pen", "post-it note", "universal product code", "ship of theseus")
    if (normPast.length >= 7 && normCandidate.includes(normPast)) {
      return { isDuplicate: true, matchedSubject: past };
    }
    if (normCandidate.length >= 7 && normPast.includes(normCandidate)) {
      return { isDuplicate: true, matchedSubject: past };
    }
  }

  // 4. Distinctive entity keyword match in candidate title (e.g. "barcode", "sundback", "theseus", "microsphere")
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

// -----------------------------------------------------------------------------
// Curated Sequential Educational Libraries (Fallback & Zero-Repetition Engine)
// -----------------------------------------------------------------------------

const CURATED_LIBRARIES_FILE = path.join(DATA_DIR, 'curated_libraries.json');
const curatedData = readJson(CURATED_LIBRARIES_FILE, {});
const TANG_POETRY_LIBRARY = curatedData.tangPoetry || [];
const EVERYDAY_INVENTIONS_LIBRARY = curatedData.everydayInventions || [];
const PHILOSOPHY_LIBRARY = curatedData.philosophy || curatedData.philosophyOfMind || [];

async function generateSectionContent({ course, date, editionNumber, history, apiKey }) {
  const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();

  // Try live Gemini API with modern model versions (gemini-3.6-flash, gemini-flash-latest, gemini-3.7-flash, gemini-3.8-flash)
  if (effectiveKey && effectiveKey.length > 5) {
    const candidateModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.8-flash'];

    for (const modelName of candidateModels) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: `You are the lead curriculum author for Personal University daily morning dispatches.
Your task is to write a single, complete, elegant educational lesson section for the specified course.
CRITICAL MANDATE:
1. Every edition MUST explore a BRAND NEW, UNIQUE SUBJECT/ARTIFACT/POEM/PARADOX that has NEVER been covered before.
2. The first line of your response MUST be:
SUBJECT_ENTITY: [Name of the specific subject/artifact/poem/paradox, e.g. "The Transistor" or "Climbing Stork Tower by Wang Zhihuan"]
3. Format cleanly with Markdown: use h3 (###) for subsection headers, bolding for key terms, blockquotes for citations, and bullet points.
4. End with 2-3 bulleted Key Takeaways.
ZERO REPETITION POLICY: Never repeat a subject from previous editions under any circumstances.`,
        });

        const { subjects: pastSubjects } = getPastSubjectsForCourse(history, course.id);
        const rejectedCandidates = [];

        // Try generation, retrying if the model proposes a previously covered subject
        for (let attempt = 0; attempt < 2; attempt++) {
          const allExcluded = [...pastSubjects, ...rejectedCandidates];
          const forbiddenBlock = allExcluded.length > 0
            ? `\n\n=======================================================\n` +
              `STRICT FORBIDDEN REPEATED SUBJECTS (ZERO TOLERANCE):\n` +
              `The subscriber has ALREADY received dispatches on the following specific subjects:\n` +
              allExcluded.map((s) => `❌ FORBIDDEN: "${s}"`).join('\n') +
              `\nYou MUST NOT write about any of the above subjects, even from a different angle.\n` +
              `=======================================================\n`
            : '';

          // Sanitize course blueprint to prevent the model from anchoring on hardcoded example text
          const sanitizedInstructions = (course.instructions || '')
            .replace(/\(e\.g\.,?\s*zippers[^\)]*\)/gi, '(e.g., choose from diverse historical inventions across centuries)')
            .replace(/\(e\.g\.,?\s*Thoughts on a Quiet Night[^\)]*\)/gi, '(e.g., choose from celebrated Tang poets)')
            .replace(/\(e\.g\.,?\s*Mary the Color Scientist[^\)]*\)/gi, '(e.g., choose from foundational cognitive paradoxes)');

          const prompt = `Generate today's daily dispatch section for the following course:
Date: ${date}
Edition: #${editionNumber}
Course Title: ${course.title}
Course Description: ${course.description}
Course Blueprint:
${sanitizedInstructions}
${forbiddenBlock}

Remember: First line MUST be "SUBJECT_ENTITY: [Subject Name]". Then provide the complete lesson. Do NOT choose any forbidden subject.`;

          const result = await model.generateContent(prompt);
          const rawText = result.response.text();

          let extractedSubject = '';
          const subjectMatch = rawText.match(/SUBJECT_ENTITY:\s*([^\n\r]+)/i);
          if (subjectMatch) {
            extractedSubject = subjectMatch[1].trim();
          } else {
            const titleMatch = rawText.match(/^###\s+([^\n\r]+)/m);
            extractedSubject = titleMatch ? titleMatch[1].trim() : course.title;
          }

          const cleanContent = rawText.replace(/SUBJECT_ENTITY:\s*[^\n\r]+\n*/i, '').trim();
          const dupCheck = isSubjectDuplicate(history, course.id, extractedSubject, cleanContent);

          if (!dupCheck.isDuplicate) {
            const titleMatch = cleanContent.match(/^###\s+([^\n\r]+)/m);
            const topicTitle = titleMatch ? titleMatch[1].trim() : `${course.title} — ${extractedSubject}`;

            const keywords = normalizeSubject(extractedSubject)
              .split(/[^a-z0-9\u4e00-\u9fa5]+/)
              .filter((w) => w.length >= 3);

            return {
              courseId: course.id,
              courseTitle: course.title,
              category: course.category || 'General',
              readingTimeMinutes: course.readingTimeMinutes || 3,
              topicTitle,
              subject: extractedSubject,
              subjectKeywords: keywords,
              content: cleanContent,
              keyTakeaways: [
                'Synthesized specifically for today\'s personal dispatch',
                'Follows your custom curriculum blueprint with guaranteed non-repeating focus',
              ],
              sourceLinks: [{ title: 'Personal University Syllabus Archive', url: '#' }],
            };
          }

          console.warn(`[Anti-Repetition] Model ${modelName} suggested duplicate "${extractedSubject}" (${dupCheck.matchedSubject}). Retrying with explicit prohibition...`);
          rejectedCandidates.push(extractedSubject);
        }
      } catch (err) {
        console.warn(`Gemini generation with ${modelName} failed:`, err.message);
      }
    }
  }

  // Curated educational library fallback (when API is unavailable or network offline)
  const isTang =
    course.id === 'tang-poetry' ||
    course.title.toLowerCase().includes('poem') ||
    course.title.toLowerCase().includes('chinese');

  const isInventions =
    course.id === 'everyday-inventions' ||
    course.title.toLowerCase().includes('invent');

  const isPhilosophy =
    course.id === 'philosophy-of-mind' ||
    course.title.toLowerCase().includes('philosophy');

  let library = [];
  if (isTang) library = TANG_POETRY_LIBRARY;
  else if (isInventions) library = EVERYDAY_INVENTIONS_LIBRARY;
  else if (isPhilosophy) library = PHILOSOPHY_LIBRARY;

  // Search for the first curated item whose subject has NEVER been used in past issues
  let selectedItem;
  for (const item of library) {
    const dupCheck = isSubjectDuplicate(history, course.id, item.subject, item.content);
    if (!dupCheck.isDuplicate) {
      selectedItem = item;
      break;
    }
  }

  if (selectedItem) {
    const keywords = normalizeSubject(selectedItem.subject)
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((w) => w.length >= 3);

    return {
      courseId: course.id,
      courseTitle: course.title,
      category: selectedItem.category,
      readingTimeMinutes: selectedItem.readingTimeMinutes,
      topicTitle: selectedItem.title,
      subject: selectedItem.subject,
      subjectKeywords: keywords,
      content: selectedItem.content,
      keyTakeaways: selectedItem.keyTakeaways,
      sourceLinks: selectedItem.sourceLinks,
    };
  }

  // Guaranteed Zero-Repetition Dynamic Fallback
  // (Triggered only if all 20+ library items have already been covered and AI API is offline)
  const pastCount = history.filter((h) => (h.sections || []).some((s) => s.courseId === course.id)).length;
  const moduleNumber = pastCount + 1;
  const uniqueTitle = `${course.title} — Progressive Focus Module #${moduleNumber}`;

  return {
    courseId: course.id,
    courseTitle: course.title,
    category: course.category || 'Curriculum',
    readingTimeMinutes: course.readingTimeMinutes || 3,
    topicTitle: uniqueTitle,
    subject: uniqueTitle,
    subjectKeywords: [course.id, `module-${moduleNumber}`],
    content: `### ${uniqueTitle}\n\n**Edition #${editionNumber} &bull; ${date}**\n\n### Sequential Syllabus Deep-Dive\nToday we advance to Module #${moduleNumber} of your personalized curriculum for **${course.title}**.\n\n${course.description}\n\n### Core Exploration Principles\n1. **Foundational Synthesis**: Uniting previous conceptual breakthroughs into an integrated mental model.\n2. **Critical Nuance**: Investigating key technical, historical, and philosophical pivots that shaped the domain.\n3. **Practical Integration**: Translating this intellectual foundation into everyday insight and lifelong mastery.\n\n### Daily Reflection\n*How does the trajectory of Module #${moduleNumber} deepen your understanding compared to earlier installments in this series?*`,
    keyTakeaways: [
      `Completed Module #${moduleNumber} for ${course.title}.`,
      'Advances your sequential learning blueprint with guaranteed unique, non-duplicative analysis.',
    ],
    sourceLinks: [{ title: 'Personal University Syllabus Archive', url: '#' }],
  };

  // Fallback for custom user courses
  return {
    courseId: course.id,
    courseTitle: course.title,
    category: course.category || 'Curriculum',
    readingTimeMinutes: course.readingTimeMinutes || 3,
    topicTitle: `${course.title} — Installment #${editionNumber}`,
    subject: `${course.title} Concept #${editionNumber}`,
    subjectKeywords: [course.id],
    content: `### Today's Focus: ${course.title}\n\n${course.description}\n\nKey ongoing study concepts for today's syllabus session.`,
    keyTakeaways: ['Daily curriculum module for ' + course.title],
    sourceLinks: [{ title: 'Personal University Syllabus Archive', url: '#' }],
  };
}

// -----------------------------------------------------------------------------
// HTML Email Renderer
// -----------------------------------------------------------------------------

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdownToHtml(markdown) {
  if (!markdown) return '';
  let html = markdown;

  html = html.replace(/^### (.*$)/gim, '<h3 style="font-family: \'Newsreader\', Georgia, serif; font-size: 19px; color: #1C1917; margin: 20px 0 8px 0; font-weight: 600;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-family: \'Newsreader\', Georgia, serif; font-size: 21px; color: #1C1917; margin: 22px 0 10px 0; font-weight: 600;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-family: \'Newsreader\', Georgia, serif; font-size: 24px; color: #1C1917; margin: 24px 0 12px 0; font-weight: 600;">$1</h1>');
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid #C4B5A5; margin: 16px 0; padding: 6px 0 6px 16px; color: #57524C; font-style: italic; background: #F8F6F2;">$1</blockquote>');
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1C1917;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 6px;">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="margin: 12px 0; padding-left: 20px;">$1</ul>');

  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<div')
      ) {
        return trimmed;
      }
      return `<p style="margin: 0 0 14px 0; line-height: 1.75; color: #292524;">${trimmed}</p>`;
    })
    .join('\n');

  return html;
}

function renderEmailHtml(issue, settings) {
  const tocItems = issue.sections
    .map(
      (sec, idx) => `
      <li style="margin-bottom: 8px; font-size: 15px; color: #44403C;">
        <a href="#section-${sec.courseId}" style="color: #78350F; text-decoration: none; font-weight: 500;">
          ${idx + 1}. ${escapeHtml(sec.courseTitle)}
        </a>
        <span style="color: #78716C; font-size: 13px; margin-left: 6px;">(${sec.readingTimeMinutes || 3} min read)</span>
      </li>
    `
    )
    .join('');

  const sectionsHtml = issue.sections
    .map(
      (sec, idx) => `
      <div id="section-${sec.courseId}" style="margin-top: 40px; padding-top: 32px; border-top: 1px solid #E7E2DA;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #9E5A38; background: #FDF4E7; padding: 4px 10px; border-radius: 9999px;">
            Course 0${idx + 1} &bull; ${escapeHtml(sec.category || 'Curriculum')}
          </span>
          <span style="font-size: 13px; color: #78716C;">${sec.readingTimeMinutes || 3} min read</span>
        </div>

        <h2 style="font-family: 'Newsreader', Georgia, Cambria, serif; font-size: 24px; line-height: 1.3; color: #1C1917; margin: 8px 0 20px 0; font-weight: 600;">
          ${escapeHtml(sec.courseTitle)}
        </h2>

        <div style="font-size: 16px; line-height: 1.75; color: #292524; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${formatMarkdownToHtml(sec.content)}
        </div>

        ${
          sec.keyTakeaways && sec.keyTakeaways.length > 0
            ? `
          <div style="margin-top: 24px; padding: 16px 20px; background-color: #F7F5F0; border-radius: 8px; border-left: 3px solid #78350F;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #78350F;">
              Key Takeaways
            </p>
            <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #44403C; line-height: 1.6;">
              ${sec.keyTakeaways.map((t) => `<li style="margin-bottom: 4px;">${escapeHtml(t)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }

        ${
          sec.sourceLinks && sec.sourceLinks.length > 0
            ? `
          <div style="margin-top: 16px; font-size: 13px; color: #78716C;">
            <strong style="color: #44403C;">Further Exploration:</strong>
            ${sec.sourceLinks
              .map(
                (link) => `
                <a href="${escapeHtml(link.url)}" target="_blank" style="color: #9E5A38; text-decoration: underline; margin-left: 6px;">
                  ${escapeHtml(link.title)} &rarr;
                </a>
              `
              )
              .join(', ')}
          </div>
        `
            : ''
        }
      </div>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(issue.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F1E1D;">
  <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Masthead -->
    <header style="text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #E7E2DA;">
      <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716C; font-weight: 600;">
        Personal University Dispatch &bull; Edition #${issue.editionNumber}
      </p>
      <h1 style="font-family: 'Newsreader', Georgia, Cambria, serif; font-size: 32px; line-height: 1.2; color: #1C1917; margin: 8px 0; font-weight: 600; letter-spacing: -0.02em;">
        ${escapeHtml(settings.title || 'Personal University')}
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; color: #78716C; font-style: italic;">
        ${escapeHtml(issue.date)} &bull; Prepared for ${escapeHtml(settings.recipientName || 'Scholar')}
      </p>
    </header>

    <!-- Table of Contents -->
    <div style="background-color: #FFFFFF; border: 1px solid #E7E2DA; border-radius: 12px; padding: 24px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #1C1917; margin: 0 0 14px 0;">
        Today's Curriculum Syllabus
      </h3>
      <ol style="margin: 0; padding-left: 20px;">
        ${tocItems}
      </ol>
    </div>

    <!-- Course Sections -->
    <main>
      ${sectionsHtml}
    </main>

    <!-- Footer -->
    <footer style="margin-top: 56px; padding-top: 24px; border-top: 1px solid #E7E2DA; text-align: center; font-size: 12px; color: #A8A29E; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;">
        You are receiving this because you enrolled in <strong>Personal University</strong>.
      </p>
      <p style="margin: 0;">
        Curriculum configured to your personal lifelong learning goals &bull; Autonomous Dispatcher
      </p>
    </footer>

  </div>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Main Execution Routine
// -----------------------------------------------------------------------------

async function main() {
  console.log('====================================================');
  console.log('🎓 Personal University — Autonomous Dispatch Engine');
  console.log('====================================================');

  const settings = readJson(SETTINGS_FILE, {});
  const courses = readJson(COURSES_FILE, []);
  const history = readJson(HISTORY_FILE, []);

  const tz = settings.timezone || 'America/New_York';
  const { dayOfWeek, timeHHMM, fullDateStr } = getZonedParts(tz);

  if (isStatus) {
    console.log(`Current Time:     ${timeHHMM} (${tz})`);
    console.log(`Date:             ${fullDateStr}`);
    console.log(`Day of week:      ${dayOfWeek} (0=Sun, 1=Mon...6=Sat)`);
    console.log(`Delivery Days:    ${JSON.stringify(settings.deliveryDays || [])}`);
    console.log(`Delivery Time:    ${settings.deliveryTime || '07:00'}`);
    console.log(`Recipient:        ${settings.recipientEmail}`);
    console.log(`Total Dispatches: ${history.length}`);
    const last = history[history.length - 1];
    if (last) {
      console.log(`Last Dispatch:    Edition #${last.editionNumber} on ${last.date}`);
    }
    return;
  }

  // Verify delivery schedule unless forced
  const isDeliveryDay = Array.isArray(settings.deliveryDays) && settings.deliveryDays.includes(dayOfWeek);
  const alreadyDispatchedToday = history.some((issue) => issue.date.trim() === fullDateStr.trim());

  console.log(`Date:             ${fullDateStr}`);
  console.log(`Time:             ${timeHHMM} (${tz})`);
  console.log(`Scheduled Days:   ${JSON.stringify(settings.deliveryDays || [])}`);
  console.log(`Is Delivery Day:  ${isDeliveryDay ? 'YES' : 'NO'}`);
  console.log(`Already Sent:     ${alreadyDispatchedToday ? 'YES' : 'NO'}`);

  if (!isForce) {
    if (!isDeliveryDay) {
      console.log(`ℹ️  Today is not a scheduled delivery day. Exiting cleanly.`);
      return;
    }
    if (alreadyDispatchedToday) {
      console.log(`ℹ️  Dispatch for ${fullDateStr} has already been sent. Exiting cleanly.`);
      return;
    }
  } else {
    console.log(`⚡ Force mode active: Bypassing day-of-week and already-sent checks.`);
  }

  const enabledCourses = courses.filter((c) => c.enabled);
  if (enabledCourses.length === 0) {
    console.warn('⚠️  No active courses enabled. Please enable courses in data/courses.json.');
    return;
  }

  const editionNumber = history.length + 1;
  console.log(`\n📚 Generating Edition #${editionNumber} with ${enabledCourses.length} course(s)...`);

  const sections = [];
  for (const course of enabledCourses) {
    console.log(`   - Generating: ${course.title}...`);
    const section = await generateSectionContent({
      course,
      date: fullDateStr,
      editionNumber,
      history,
      apiKey: process.env.GEMINI_API_KEY,
    });
    console.log(`     ✓ Subject: "${section.subject || section.topicTitle}"`);
    sections.push(section);
  }

  const issue = {
    id: `dispatch-${Date.now()}`,
    date: fullDateStr,
    editionNumber,
    title: settings.title || 'The Personal University Dispatch',
    sections,
    generatedAt: new Date().toISOString(),
  };

  const htmlContent = renderEmailHtml(issue, settings);

  if (isDryRun) {
    console.log(`\n🔍 [Dry Run] Edition #${editionNumber} generated successfully!`);
    console.log(`   Title:    ${issue.title}`);
    console.log(`   Date:     ${issue.date}`);
    console.log(`   HTML Len: ${htmlContent.length} characters`);
    console.log(`   Sections: ${sections.map((s) => s.subject).join(', ')}`);
    console.log('\n[Dry Run complete — no email sent and history not modified]');
    return;
  }

  // Delivery credentials
  const effectiveGmailUser = (
    process.env.GMAIL_USER ||
    settings.gmailUser ||
    settings.recipientEmail ||
    ''
  ).trim();

  const effectiveGmailPassword = (
    process.env.GMAIL_APP_PASSWORD ||
    settings.gmailAppPassword ||
    ''
  ).trim().replace(/\s+/g, '');

  const effectiveRecipient = (
    process.env.RECIPIENT_EMAIL ||
    settings.recipientEmail ||
    ''
  ).trim();

  if (!effectiveGmailUser || !effectiveGmailPassword) {
    throw new Error('Gmail username or 16-character App Password missing. Check data/settings.json or GMAIL_USER/GMAIL_APP_PASSWORD.');
  }

  console.log(`\n✉️  Delivering Edition #${editionNumber} to ${effectiveRecipient}...`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: effectiveGmailUser,
      pass: effectiveGmailPassword,
    },
  });

  const senderTitle = settings.title || 'Personal University';
  const info = await transporter.sendMail({
    from: `"${senderTitle}" <${effectiveGmailUser}>`,
    to: effectiveRecipient,
    subject: `${issue.title} — ${issue.date} (Edition #${issue.editionNumber})`,
    html: htmlContent,
  });

  console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);

  // Record dispatch in history archive
  history.push(issue);
  writeJson(HISTORY_FILE, history);
  console.log(`💾 Recorded Edition #${editionNumber} to data/dispatch_history.json (Total archived: ${history.length})`);
  console.log('\n✨ Dispatch cycle completed successfully.');
}

main().catch((err) => {
  console.error('\n❌ Dispatch Error:', err.message);
  process.exit(1);
});
