'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Mail,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Code,
  Send,
  Printer,
  ExternalLink,
  Clock,
  ArrowUpRight,
  ListOrdered,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Course, NewsletterIssue, NewsletterSettings } from '@/lib/types';
import {
  getCourses,
  getNewsletterSettings,
  getStoredApiKey,
} from '@/lib/storage';
import { renderEmailHtml } from '@/lib/emailTemplate';

export function NewsletterPreview() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<NewsletterSettings | null>(null);
  const [issue, setIssue] = useState<NewsletterIssue | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'reader' | 'email_mobile' | 'html'>('reader');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [serverConfig, setServerConfig] = useState<{
    configured: boolean;
    hasResend?: boolean;
    hasGmail?: boolean;
  }>({ configured: false });
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    mode?: 'resend' | 'gmail' | 'mock' | 'resend_error' | 'gmail_error';
  } | null>(null);

  useEffect(() => {
    const loadedCourses = getCourses();
    const loadedSettings = getNewsletterSettings();
    setCourses(loadedCourses);
    setSettings(loadedSettings);

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {});

    fetch('/api/send')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setServerConfig(data);
        }
      })
      .catch(() => {});
  }, []);

  const enabledCourses = courses.filter((c) => c.enabled);

  const generateNewsletter = async () => {
    if (enabledCourses.length === 0) return;

    setIsGenerating(true);
    setSendResult(null);

    try {
      const apiKey = getStoredApiKey();
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'full',
          courses: enabledCourses,
          settings,
          apiKey,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate combined newsletter');
      }

      const generatedIssue: NewsletterIssue = await res.json();
      setIssue(generatedIssue);
    } catch (err) {
      console.error('Error generating newsletter:', err);
      alert('Encountered an issue generating the newsletter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate on first load if we have enabled courses and no issue yet
  useEffect(() => {
    if (enabledCourses.length > 0 && !issue && !isGenerating) {
      generateNewsletter();
    }
  }, [enabledCourses.length]);

  const handleCopyHtml = () => {
    if (!issue || !settings) return;
    const html = renderEmailHtml(issue, settings);
    navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2500);
  };

  const handleSendTest = async () => {
    if (!issue || !settings) return;
    setIsSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue, settings }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSendResult({
          success: true,
          mode: data.mode,
          message: data.message || `Dispatched to ${settings.recipientEmail}`,
        });
        if (data.mode === 'resend' || data.mode === 'gmail') {
          try {
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
          } catch {
            // ignore if canvas-confetti fails
          }
        }
      } else {
        setSendResult({
          success: false,
          mode: data.mode || 'resend_error',
          message: data.error || 'Failed to dispatch email.',
        });
      }
    } catch {
      setSendResult({
        success: false,
        message: 'Network error sending test email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const provider = settings?.emailProvider || 'mock';
  const hasGmailConfig = Boolean(
    (settings?.gmailUser && settings?.gmailAppPassword) || serverConfig.hasGmail
  );
  const hasResendConfig = Boolean(
    (settings?.resendApiKey && settings.resendApiKey.trim().length > 5) || serverConfig.hasResend
  );

  const hasLiveDelivery =
    (provider === 'gmail' && hasGmailConfig) ||
    (provider === 'resend' && hasResendConfig) ||
    (provider !== 'mock' && (hasGmailConfig || hasResendConfig));

  const providerLabel =
    provider === 'gmail' || (provider !== 'resend' && hasGmailConfig)
      ? 'Gmail'
      : provider === 'resend' || hasResendConfig
      ? 'Resend'
      : 'Simulator';

  const totalReadingTime = issue?.sections.reduce(
    (acc, s) => acc + (s.readingTimeMinutes || 3),
    0
  ) || 0;

  if (enabledCourses.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center bg-white border border-[#E7E2DA] rounded-2xl shadow-xs">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-[#1C1917] mb-2">
          No courses currently enabled
        </h2>
        <p className="text-sm text-[#78716C] max-w-md mx-auto mb-6 leading-relaxed">
          The Personal University dispatch compiles all enabled courses in your exact dashboard order. Enable at least one course on your curriculum dashboard to generate today\'s edition.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C1917] text-white text-xs font-semibold hover:bg-[#332E2B] transition-colors"
        >
          Return to Curriculum Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Control Toolbar */}
      <div className="bg-white border border-[#E7E2DA] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left: Metadata & Status */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-widest text-[#78350F] bg-[#FDF4E7] px-2.5 py-0.5 rounded-full">
              {enabledCourses.length} Active Courses Included
            </span>
            <span className="text-xs text-[#78716C] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{totalReadingTime} min read
            </span>
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1C1917]">
            {settings?.title || "Today's Personal Dispatch"}
          </h2>
          <p className="text-xs text-[#78716C]">
            Ordered strictly according to your curriculum dashboard sequence
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'reader'
                  ? 'bg-[#1C1917] text-white shadow-2xs'
                  : 'text-[#57524C] hover:text-[#1C1917]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reader</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('email_mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'email_mobile'
                  ? 'bg-[#1C1917] text-white shadow-2xs'
                  : 'text-[#57524C] hover:text-[#1C1917]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mobile Email</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('html')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'html'
                  ? 'bg-[#1C1917] text-white shadow-2xs'
                  : 'text-[#57524C] hover:text-[#1C1917]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HTML</span>
            </button>
          </div>

          {/* Regenerate Button */}
          <button
            type="button"
            onClick={generateNewsletter}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCD5C9] bg-white hover:bg-[#F9F7F2] text-[#443E3A] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="Regenerate issue"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#78350F] ${isGenerating ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Regenerate</span>
          </button>

          {/* Copy HTML Button */}
          <button
            type="button"
            onClick={handleCopyHtml}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCD5C9] bg-white hover:bg-[#F9F7F2] text-[#443E3A] text-xs font-semibold transition-colors cursor-pointer"
            title="Copy email HTML"
          >
            {copiedHtml ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#78350F]" />
                <span className="hidden sm:inline">Copy HTML</span>
              </>
            )}
          </button>

          {/* Send Test Email Button */}
          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSending || isGenerating}
            title={
              hasLiveDelivery
                ? `Dispatch live email via ${providerLabel}`
                : 'Simulate dispatch (Configure Google/Gmail or Resend in Settings for live delivery)'
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-[#332E2B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E7C7A8]" />
            ) : (
              <Send className="w-3.5 h-3.5 text-[#E7C7A8]" />
            )}
            <span>Send Test Issue</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                hasLiveDelivery
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                  : 'bg-[#38332F] text-[#D6CEBE]'
              }`}
            >
              {hasLiveDelivery ? providerLabel : 'Simulator'}
            </span>
          </button>

        </div>
      </div>

      {/* Send Feedback Alert */}
      {sendResult && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start sm:items-center justify-between gap-3 border ${
            sendResult.success
              ? sendResult.mode === 'mock'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {sendResult.success ? (
              sendResult.mode === 'mock' ? (
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{sendResult.message}</p>
              {sendResult.mode === 'mock' && (
                <p className="text-[11px] text-amber-800">
                  Notice: Mock Mode is active because no Google/Gmail or Resend credentials are configured. To deliver issues to your real inbox, choose a provider in{' '}
                  <a href="/settings" className="underline font-bold hover:text-amber-950">
                    Settings
                  </a>{' '}
                  or in <code>.env.local</code>.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setSendResult(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="p-16 text-center bg-white border border-[#E7E2DA] rounded-2xl shadow-xs">
          <RefreshCw className="w-8 h-8 mx-auto text-[#78350F] animate-spin mb-4" />
          <h3 className="font-serif text-xl font-semibold text-[#1C1917] mb-1">
            Publishing Today's Combined Dispatch...
          </h3>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto">
            Generating educational sections for every enabled course according to your architected blueprints.
          </p>
        </div>
      )}

      {/* View Mode: Reader */}
      {!isGenerating && issue && viewMode === 'reader' && (
        <article className="bg-white border border-[#E7E2DA] rounded-2xl shadow-sm p-6 sm:p-12 max-w-3xl mx-auto">
          
          {/* Masthead */}
          <header className="text-center pb-8 mb-8 border-b-2 border-[#EAE3D9]">
            <p className="text-[11px] uppercase font-bold tracking-widest text-[#8C827A] mb-2">
              Personal University Dispatch &bull; Edition #{issue.editionNumber}
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1917] tracking-tight mb-2">
              {settings?.title || 'Personal University'}
            </h1>
            <p className="text-xs sm:text-sm text-[#78716C] italic">
              {issue.date} &bull; Prepared exclusively for {settings?.recipientName || 'Scholar'}
            </p>
          </header>

          {/* Table of Contents */}
          <nav className="mb-10 p-5 bg-[#FAF8F5] border border-[#EAE3D9] rounded-xl">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1C1917] mb-3">
              <ListOrdered className="w-3.5 h-3.5 text-[#78350F]" />
              Today's Curriculum Syllabus
            </h3>
            <ol className="space-y-2 text-xs sm:text-sm">
              {issue.sections.map((sec, idx) => (
                <li key={sec.courseId} className="flex items-baseline justify-between gap-2">
                  <a
                    href={`#section-${sec.courseId}`}
                    className="text-[#78350F] hover:underline font-medium flex items-center gap-1"
                  >
                    <span>{idx + 1}.</span>
                    <span>{sec.courseTitle}</span>
                  </a>
                  <span className="text-[11px] text-[#A8A29E] shrink-0 font-mono">
                    {sec.readingTimeMinutes || 3} min
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          {/* Course Sections */}
          <main className="space-y-12">
            {issue.sections.map((sec, idx) => (
              <section
                key={sec.courseId}
                id={`section-${sec.courseId}`}
                className="pt-8 border-t border-[#EAE3D9] first:border-t-0 first:pt-0 scroll-mt-24"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] uppercase font-bold tracking-widest text-[#78350F] bg-[#FDF4E7] px-2.5 py-0.5 rounded-full">
                    Course 0{idx + 1} &bull; {sec.category || 'Curriculum'}
                  </span>
                  <span className="text-xs text-[#8C827A] font-mono">
                    {sec.readingTimeMinutes || 3} min read
                  </span>
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C1917] mb-4">
                  {sec.courseTitle}
                </h2>

                {/* Section Educational Content */}
                <div className="prose-editorial max-w-none text-sm sm:text-base leading-relaxed text-[#292524]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {sec.content}
                  </ReactMarkdown>
                </div>

                {/* Key Takeaways */}
                {sec.keyTakeaways && sec.keyTakeaways.length > 0 && (
                  <div className="mt-6 p-4 sm:p-5 bg-[#FAF8F5] rounded-xl border-l-3 border-[#78350F]">
                    <p className="text-xs uppercase font-bold tracking-wider text-[#78350F] mb-2">
                      Key Takeaways
                    </p>
                    <ul className="text-xs sm:text-sm space-y-1.5 text-[#443E3A] list-disc list-inside">
                      {sec.keyTakeaways.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Source links */}
                {sec.sourceLinks && sec.sourceLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#78716C]">
                    <span className="font-semibold text-[#443E3A]">Primary Sources:</span>
                    {sec.sourceLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#78350F] hover:underline"
                      >
                        {link.title}
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </main>

          {/* Issue Footer */}
          <footer className="mt-14 pt-8 border-t border-[#EAE3D9] text-center text-xs text-[#A8A29E] space-y-1">
            <p>
              Published by <strong>Personal University</strong> &bull; Personalized educational newsletters
            </p>
            <p>
              Delivered according to your weekly schedule: {settings?.deliveryDays.length} days / week at {settings?.deliveryTime}
            </p>
          </footer>

        </article>
      )}

      {/* View Mode: Mobile Email Mockup */}
      {!isGenerating && issue && settings && viewMode === 'email_mobile' && (
        <div className="flex justify-center py-4">
          <div className="w-[380px] bg-black rounded-[44px] p-3.5 shadow-2xl border-4 border-[#333]">
            {/* Phone Notch */}
            <div className="w-28 h-4 bg-black rounded-full mx-auto mb-2" />
            <div className="bg-white rounded-[32px] overflow-hidden h-[640px] overflow-y-auto">
              <iframe
                title="Mobile Email Preview"
                srcDoc={renderEmailHtml(issue, settings)}
                className="w-full h-full border-none"
              />
            </div>
            <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-2" />
          </div>
        </div>
      )}

      {/* View Mode: Raw HTML */}
      {!isGenerating && issue && settings && viewMode === 'html' && (
        <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Inline HTML Email Output (Gmail / Apple Mail Compatible)
            </h3>
            <button
              type="button"
              onClick={handleCopyHtml}
              className="flex items-center gap-1 text-xs text-[#78350F] font-semibold hover:underline cursor-pointer"
            >
              {copiedHtml ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copiedHtml ? 'Copied' : 'Copy All'}
            </button>
          </div>
          <textarea
            readOnly
            value={renderEmailHtml(issue, settings)}
            rows={18}
            className="w-full p-4 bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl font-mono text-xs text-[#292524] resize-none focus:outline-hidden"
          />
        </div>
      )}

    </div>
  );
}
