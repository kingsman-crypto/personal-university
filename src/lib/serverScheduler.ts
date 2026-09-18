import nodemailer from 'nodemailer';
import { getServerSettings, getServerCourses, getServerHistory } from './serverStorage';
import { getPastTopicsForCourse, recordDispatch, hasDispatchedToday, getLastDispatch } from './dispatchHistory';
import { generateCourseSectionContent } from './gemini';
import { renderEmailHtml } from './emailTemplate';
import { NewsletterIssue, NewsletterSettings } from './types';

// Global singleton to prevent multiple intervals during Next.js hot-reloads
const globalForScheduler = globalThis as unknown as {
  __pu_scheduler_interval__?: NodeJS.Timeout;
  __pu_scheduler_initialized__?: boolean;
  __pu_last_dispatched_key__?: string;
};

export function initServerScheduler() {
  if (globalForScheduler.__pu_scheduler_initialized__) {
    console.log('[Scheduler] Already initialized in this process.');
    return;
  }

  globalForScheduler.__pu_scheduler_initialized__ = true;
  console.log('[Scheduler] Initializing Personal University automated dispatcher service...');

  // Run immediate initial check (catch up or verify)
  checkAndExecuteSchedule().catch((err) => {
    console.error('[Scheduler] Initial check error:', err);
  });

  // Ticker: checks every 60 seconds
  if (globalForScheduler.__pu_scheduler_interval__) {
    clearInterval(globalForScheduler.__pu_scheduler_interval__);
  }

  globalForScheduler.__pu_scheduler_interval__ = setInterval(() => {
    checkAndExecuteSchedule().catch((err) => {
      console.error('[Scheduler] Interval tick error:', err);
    });
  }, 60 * 1000);

  console.log('[Scheduler] Background interval active (60-second polling).');
}

export function reloadScheduler() {
  console.log('[Scheduler] Reloading scheduler with latest settings...');
  checkAndExecuteSchedule().catch((err) => {
    console.error('[Scheduler] Reload check error:', err);
  });
}

function getZonedParts(timeZone: string, date: Date = new Date()) {
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
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const weekdayShort = get('weekday'); // 'Mon', 'Tue', etc.
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');

    const weekdayMap: Record<string, number> = {
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

    // Full formatted date string like "Thursday, September 17, 2026"
    const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const fullDateStr = fullDateFormatter.format(date);

    return {
      dayOfWeek,
      timeHHMM,
      dateKey,
      fullDateStr,
    };
  } catch {
    // Fallback if timezone invalid
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

export async function checkAndExecuteSchedule(): Promise<void> {
  const settings = getServerSettings();
  const tz = settings.timezone || 'America/New_York';
  const { dayOfWeek, timeHHMM, dateKey, fullDateStr } = getZonedParts(tz);

  // Check if today is a configured delivery day
  const isDeliveryDay = Array.isArray(settings.deliveryDays) && settings.deliveryDays.includes(dayOfWeek);
  if (!isDeliveryDay) {
    return;
  }

  // Check if current time has reached or passed configured delivery time (HH:MM)
  const configuredTime = (settings.deliveryTime || '07:00').trim();
  if (timeHHMM < configuredTime) {
    return;
  }

  // Prevent double sending within the same calendar day
  const dispatchKey = `${dateKey}_dispatched`;
  if (globalForScheduler.__pu_last_dispatched_key__ === dispatchKey) {
    return;
  }

  if (hasDispatchedToday(fullDateStr)) {
    return;
  }

  globalForScheduler.__pu_last_dispatched_key__ = dispatchKey;
  const isCatchUp = timeHHMM > configuredTime;
  console.log(
    `[Scheduler] Triggering ${isCatchUp ? 'catch-up' : 'scheduled'} dispatch for ${fullDateStr} (current time: ${timeHHMM}, target: ${configuredTime} ${tz})...`
  );

  try {
    const result = await executeScheduledDispatch(isCatchUp ? 'catch-up' : 'scheduled');
    console.log('[Scheduler] Dispatch result:', result.message);
  } catch (err) {
    console.error('[Scheduler] Failed executing scheduled dispatch:', err);
  }
}

export async function executeScheduledDispatch(trigger: 'scheduled' | 'manual' | 'catch-up' = 'scheduled'): Promise<{
  success: boolean;
  message: string;
  issue?: NewsletterIssue;
  error?: string;
}> {
  const settings = getServerSettings();
  const courses = getServerCourses();
  const enabledCourses = courses.filter((c) => c.enabled);

  if (enabledCourses.length === 0) {
    return {
      success: false,
      message: 'No courses are currently enabled for dispatch.',
    };
  }

  const tz = settings.timezone || 'America/New_York';
  const { fullDateStr } = getZonedParts(tz);
  const history = getServerHistory();
  const editionNumber = history.length + 1;

  // Generate each course section with anti-repetition past topics
  const sections = await Promise.all(
    enabledCourses.map((course) => {
      const pastTopics = getPastTopicsForCourse(course.id);
      return generateCourseSectionContent({
        course,
        date: fullDateStr,
        pastTopics,
        editionNumber,
      });
    })
  );

  const issue: NewsletterIssue = {
    id: `dispatch-${Date.now()}`,
    date: fullDateStr,
    editionNumber,
    title: settings.title || 'The Personal University Dispatch',
    sections,
    generatedAt: new Date().toISOString(),
  };

  const htmlContent = renderEmailHtml(issue, settings);

  const effectiveGmailUser = (
    settings.gmailUser ||
    process.env.GMAIL_USER ||
    ''
  ).trim();

  const effectiveGmailPassword = (
    settings.gmailAppPassword ||
    process.env.GMAIL_APP_PASSWORD ||
    ''
  ).trim().replace(/\s+/g, '');

  const effectiveResendKey = (
    settings.resendApiKey ||
    process.env.RESEND_API_KEY ||
    ''
  ).trim();

  const useGmail =
    settings.emailProvider === 'gmail' ||
    (effectiveGmailUser.length > 3 && effectiveGmailPassword.length > 5 && settings.emailProvider !== 'resend');

  const useResend =
    !useGmail &&
    (settings.emailProvider === 'resend' || effectiveResendKey.length > 5);

  let deliverySuccess = false;
  let deliveryMessage = '';

  // 1. Deliver via Google/Gmail SMTP
  if (useGmail) {
    if (!effectiveGmailUser || !effectiveGmailPassword) {
      throw new Error('Gmail address or App Password missing. Please configure them in Settings.');
    }

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
      to: settings.recipientEmail,
      subject: `${issue.title} — ${issue.date} (Edition #${issue.editionNumber})`,
      html: htmlContent,
    });

    deliverySuccess = true;
    deliveryMessage = `Successfully delivered Edition #${issue.editionNumber} via Gmail to ${settings.recipientEmail} (ID: ${info.messageId})`;
  } else if (useResend && effectiveResendKey.length > 5) {
    // 2. Deliver via Resend API
    let senderAddress = (settings.senderEmail || '').trim();
    if (!senderAddress || senderAddress.includes('personaluniversity.edu')) {
      senderAddress = 'Personal University <onboarding@resend.dev>';
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveResendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderAddress,
        to: [settings.recipientEmail],
        subject: `${issue.title} — ${issue.date} (Edition #${issue.editionNumber})`,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Resend delivery failed');
    }

    deliverySuccess = true;
    deliveryMessage = `Successfully delivered Edition #${issue.editionNumber} via Resend to ${settings.recipientEmail}`;
  } else {
    // 3. Mock delivery
    deliverySuccess = true;
    deliveryMessage = `Simulated dispatch: Edition #${issue.editionNumber} prepared for ${settings.recipientEmail} (${trigger})`;
  }

  // Record dispatch in history archive to guarantee future uniqueness
  if (deliverySuccess) {
    recordDispatch(issue);
  }

  return {
    success: deliverySuccess,
    message: deliveryMessage,
    issue,
  };
}

export function getNextScheduledRun(settings: NewsletterSettings): string {
  if (!settings.deliveryDays || settings.deliveryDays.length === 0) {
    return 'No delivery days selected';
  }

  const tz = settings.timezone || 'America/New_York';
  const [targetHour, targetMinute] = (settings.deliveryTime || '07:00').split(':').map(Number);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Check upcoming 7 days
  const now = new Date();
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const { dayOfWeek, timeHHMM } = getZonedParts(tz, candidate);

    if (settings.deliveryDays.includes(dayOfWeek)) {
      if (offset === 0) {
        // Today: if target time is still ahead
        const [currHour, currMinute] = timeHHMM.split(':').map(Number);
        if (targetHour > currHour || (targetHour === currHour && targetMinute > currMinute)) {
          return `Today at ${settings.deliveryTime} (${tz})`;
        }
        // If target time has passed but today has not been dispatched yet, it is due for catch-up
        const { fullDateStr } = getZonedParts(tz);
        if (!hasDispatchedToday(fullDateStr)) {
          return `Today (missed delivery at ${settings.deliveryTime}, ready for catch-up)`;
        }
      } else {
        const dayLabel = offset === 1 ? 'Tomorrow' : dayNames[dayOfWeek];
        return `${dayLabel} at ${settings.deliveryTime} (${tz})`;
      }
    }
  }

  return `Scheduled at ${settings.deliveryTime} (${tz})`;
}

export function getSchedulerStatus() {
  const settings = getServerSettings();
  const history = getServerHistory();
  const last = getLastDispatch();
  const nextRun = getNextScheduledRun(settings);

  return {
    active: true,
    emailProvider: settings.emailProvider,
    recipientEmail: settings.recipientEmail,
    deliveryTime: settings.deliveryTime,
    deliveryDays: settings.deliveryDays,
    timezone: settings.timezone,
    nextRun,
    totalDispatches: history.length,
    lastDispatch: last
      ? {
          id: last.id,
          date: last.date,
          editionNumber: last.editionNumber,
          generatedAt: last.generatedAt,
          sectionsCount: last.sections.length,
        }
      : null,
  };
}
