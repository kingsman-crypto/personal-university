import { NewsletterIssue, NewsletterSettings } from './types';

export function renderEmailHtml(issue: NewsletterIssue, settings: NewsletterSettings): string {
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
        Curriculum configured to your personal lifelong learning goals &bull; Built with Gemini AI
      </p>
    </footer>

  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-family: \'Newsreader\', serif; font-size: 19px; color: #1C1917; margin: 20px 0 8px 0; font-weight: 600;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-family: \'Newsreader\', serif; font-size: 21px; color: #1C1917; margin: 22px 0 10px 0; font-weight: 600;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-family: \'Newsreader\', serif; font-size: 24px; color: #1C1917; margin: 24px 0 12px 0; font-weight: 600;">$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid #C4B5A5; margin: 16px 0; padding: 6px 0 6px 16px; color: #57524C; font-style: italic; background: #F8F6F2;">$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1C1917;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Bullet points
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 6px;">$1</li>');

  // Wrap lists
  html = html.replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="margin: 12px 0; padding-left: 20px;">$1</ul>');

  // Paragraphs
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
