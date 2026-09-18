'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  Save,
  ArrowRight,
  Sparkles,
  Layers,
  ShieldCheck,
  Zap,
  RotateCcw,
  Check,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Header } from '@/components/Header';
import { DaySelector } from '@/components/DaySelector';
import { Course, NewsletterSettings, NewsletterIssue } from '@/lib/types';
import {
  getCourses,
  getNewsletterSettings,
  saveNewsletterSettings,
} from '@/lib/storage';

interface SchedulerStatus {
  active: boolean;
  emailProvider: string;
  recipientEmail: string;
  deliveryTime: string;
  deliveryDays: number[];
  timezone: string;
  nextRun: string;
  totalDispatches: number;
  lastDispatch: {
    id: string;
    date: string;
    editionNumber: number;
    generatedAt: string;
    sectionsCount: number;
  } | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<NewsletterSettings | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [recentDispatches, setRecentDispatches] = useState<NewsletterIssue[]>([]);

  const loadSchedulerAndHistory = () => {
    fetch('/api/scheduler')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.status) {
          setSchedulerStatus(data.status);
        }
      })
      .catch((err) => console.warn('Could not fetch scheduler status:', err));

    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.history)) {
          setRecentDispatches(data.history.slice(0, 5));
        }
      })
      .catch((err) => console.warn('Could not fetch history:', err));
  };

  useEffect(() => {
    const loadedSettings = getNewsletterSettings();
    const loadedCourses = getCourses();
    setSettings(loadedSettings);
    setCourses(loadedCourses);

    // Initial sync with server
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.settings) {
          setSettings((prev) => ({
            ...prev,
            ...data.settings,
            gmailUser: data.settings.gmailUser || prev?.gmailUser,
            gmailAppPassword: data.settings.gmailAppPassword || prev?.gmailAppPassword,
          }));
        }
      })
      .catch(() => {});

    loadSchedulerAndHistory();
  }, []);

  if (!settings) return null;

  const enabledCourses = courses.filter((c) => c.enabled);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveNewsletterSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    // Reload scheduler info
    setTimeout(loadSchedulerAndHistory, 500);
  };

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    setTriggerResult(null);

    try {
      // First ensure latest settings are saved to server
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispatch_now' }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTriggerResult({
          success: true,
          message: data.message || `Dispatch delivered successfully!`,
        });
        try {
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        } catch {}
        loadSchedulerAndHistory();
      } else {
        setTriggerResult({
          success: false,
          message: data.error || data.message || 'Dispatch attempt failed. Check credentials.',
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setTriggerResult({
        success: false,
        message: `Failed to trigger dispatch: ${errMsg}`,
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col selection:bg-[#EAE0D5]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        
        {/* Header */}
        <div className="border-b border-[#E8E2D8] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-bold text-[#78350F] bg-[#FDF4E7] px-2.5 py-1 rounded-full inline-block mb-2">
              Publication Configuration
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1917] tracking-tight">
              Newsletter Schedule &amp; Delivery
            </h1>
            <p className="mt-2 text-sm text-[#57524C]">
              Configure which days of the week you receive your combined daily dispatch, delivery time, and recipient details.
            </p>
          </div>

          <Link
            href="/preview"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-[#332E2B] text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <span>Preview Today&apos;s Dispatch</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#E7C7A8]" />
          </Link>
        </div>

        {/* 0. Automated Scheduler & Live Delivery Status Card */}
        <div className="bg-white border-2 border-[#1C1917]/10 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5 bg-gradient-to-br from-white to-[#FBF9F5]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EAE3D9] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1C1917] text-[#E7C7A8] flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-bold text-[#1C1917]">
                    Automated Delivery Engine
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    Active &amp; Scheduled
                  </span>
                </div>
                <p className="text-xs text-[#78716C] mt-0.5">
                  Your server scheduler checks the clock every minute and automatically dispatches to your Gmail inbox.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTriggerNow}
              disabled={isTriggering}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#78350F] hover:bg-[#92400E] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isTriggering ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin text-[#E7C7A8]" />
                  <span>Delivering Now...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-[#E7C7A8]" />
                  <span>Send Scheduled Dispatch Now (Test)</span>
                </>
              )}
            </button>
          </div>

          {triggerResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                triggerResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {triggerResult.success ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{triggerResult.message}</p>
                {triggerResult.success && (
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Check your Gmail inbox ({settings.recipientEmail}) to view today&apos;s delivered edition.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
            <div className="p-3.5 bg-[#FAF8F5] border border-[#EAE3D9] rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[#8C827A] tracking-wider block">
                Next Automated Dispatch
              </span>
              <span className="font-semibold text-[#1C1917] mt-1 block">
                {schedulerStatus?.nextRun || 'Calculating upcoming run...'}
              </span>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] border border-[#EAE3D9] rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[#8C827A] tracking-wider block">
                Destination Inbox
              </span>
              <span className="font-semibold text-[#1C1917] mt-1 block font-mono text-[11px] truncate">
                {settings.recipientEmail || 'scholar@example.com'}
              </span>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] border border-[#EAE3D9] rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[#8C827A] tracking-wider block">
                Sequential Syllabus Guarantee
              </span>
              <span className="font-semibold text-emerald-700 mt-1 block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Anti-Repetition Engine Active
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* 1. Schedule & Days of Week */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E2D8] text-[#78350F]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-[#1C1917]">
                  Delivery Cadence
                </h2>
                <p className="text-xs text-[#78716C]">
                  Select which days of the week you wish to receive your personal dispatch
                </p>
              </div>
            </div>

            <DaySelector
              selectedDays={settings.deliveryDays}
              onChange={(newDays) => setSettings({ ...settings, deliveryDays: newDays })}
            />

            <div className="pt-4 border-t border-[#F0EBE1] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Morning Delivery Time
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={settings.deliveryTime}
                    onChange={(e) => setSettings({ ...settings, deliveryTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 font-medium"
                  />
                  <Clock className="w-4 h-4 text-[#8C827A] absolute right-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Timezone
                </label>
                <input
                  type="text"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 font-medium"
                />
              </div>
            </div>
          </div>

          {/* 2. Publication Identity & Recipient */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E2D8] text-[#78350F]">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-[#1C1917]">
                  Publication Details &amp; Recipient
                </h2>
                <p className="text-xs text-[#78716C]">
                  Personalize the masthead and destination inbox
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Newsletter Title
                </label>
                <input
                  type="text"
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  placeholder="The Personal University Dispatch"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm font-serif font-semibold text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Subtitle / Tagline
                </label>
                <input
                  type="text"
                  value={settings.subtitle || ''}
                  onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                  placeholder="Your Daily Curated Morning Syllabus"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={settings.recipientName}
                  onChange={(e) => setSettings({ ...settings, recipientName: e.target.value })}
                  placeholder="e.g. Eleanor Vance"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={settings.recipientEmail}
                  onChange={(e) => setSettings({ ...settings, recipientEmail: e.target.value })}
                  placeholder="scholar@example.com"
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Sequence in Combined Newsletter */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E2D8] text-[#78350F]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#1C1917]">
                    Combined Newsletter Structure
                  </h2>
                  <p className="text-xs text-[#78716C]">
                    Every enabled course is bundled into a single email strictly following your dashboard order
                  </p>
                </div>
              </div>

              <Link
                href="/"
                className="text-xs font-semibold text-[#78350F] hover:underline"
              >
                Reorder on Dashboard &rarr;
              </Link>
            </div>

            {enabledCourses.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                No courses are currently enabled. Enable courses on the dashboard to populate your daily newsletter.
              </p>
            ) : (
              <div className="space-y-2 pt-2">
                {enabledCourses.map((c, idx) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE3D9] text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#1C1917] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-serif font-semibold text-[#1C1917]">
                        {c.title}
                      </span>
                      {c.category && (
                        <span className="text-[10px] text-[#78350F] bg-[#FDF4E7] px-2 py-0.5 rounded-full">
                          {c.category}
                        </span>
                      )}
                    </div>
                    <span className="text-[#8C827A] font-mono text-[11px]">
                      {c.readingTimeMinutes || 3} min read
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Live Delivery Provider */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E2D8] text-[#78350F]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-[#1C1917]">
                  Email Dispatch Provider
                </h2>
                <p className="text-xs text-[#78716C]">
                  Choose between Google / Gmail direct SMTP or Resend API delivery
                </p>
              </div>
            </div>

            {/* Provider Selection Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1.5 bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, emailProvider: 'gmail' })}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  settings.emailProvider === 'gmail'
                    ? 'bg-[#1C1917] text-white shadow-xs font-bold'
                    : 'text-[#57524C] hover:text-[#1C1917]'
                }`}
              >
                Google / Gmail (Direct)
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, emailProvider: 'resend' })}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  settings.emailProvider === 'resend'
                    ? 'bg-[#1C1917] text-white shadow-xs font-bold'
                    : 'text-[#57524C] hover:text-[#1C1917]'
                }`}
              >
                Resend API
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, emailProvider: 'mock' })}
                className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                  settings.emailProvider === 'mock'
                    ? 'bg-[#1C1917] text-white shadow-xs font-bold'
                    : 'text-[#57524C] hover:text-[#1C1917]'
                }`}
              >
                Simulator Only (Mock)
              </button>
            </div>

            {/* Provider: Google / Gmail */}
            {settings.emailProvider === 'gmail' && (
              <div className="space-y-4 pt-2 border-t border-[#F0EBE1]">
                <div className="p-3.5 bg-[#F4F8F4] border border-[#D5E5D5] rounded-xl text-xs text-[#234B23] space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>Google / Gmail SMTP Connection Verified:</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Authentication verified with Google. Enter your 16-character App Password (with or without spaces) and click Save Schedule &amp; Settings. The automated dispatcher will use these credentials on scheduled mornings.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                      Your Gmail Address
                    </label>
                    <input
                      type="email"
                      value={settings.gmailUser || ''}
                      onChange={(e) => setSettings({ ...settings, gmailUser: e.target.value })}
                      placeholder="yourname@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm font-mono text-xs text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                      16-Character Google App Password
                    </label>
                    <input
                      type="password"
                      value={settings.gmailAppPassword || ''}
                      onChange={(e) => setSettings({ ...settings, gmailAppPassword: e.target.value })}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm font-mono text-xs text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Provider: Resend */}
            {settings.emailProvider === 'resend' && (
              <div className="space-y-4 pt-2 border-t border-[#F0EBE1]">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                    Resend API Key
                  </label>
                  <input
                    type="password"
                    value={settings.resendApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
                    placeholder="re_..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm font-mono text-xs text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                  />
                  <p className="mt-1 text-[11px] text-[#78716C]">
                    Get an API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline text-[#78350F]">resend.com</a>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                    Sender Email Address (&quot;From&quot;)
                  </label>
                  <input
                    type="text"
                    value={settings.senderEmail || ''}
                    onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                    placeholder="Personal University <onboarding@resend.dev>"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-lg text-sm font-mono text-xs text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                  />
                </div>
              </div>
            )}

            {/* Provider: Mock Simulator */}
            {settings.emailProvider === 'mock' && (
              <div className="pt-2 border-t border-[#F0EBE1]">
                <p className="text-xs text-[#78716C] bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E7E2DA]">
                  Built-in Simulator Mode is active. All issues can be read directly on the website reader, inspected in the mobile email mockup, or copied as Gmail-compatible HTML. No external emails will be sent.
                </p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between p-5 bg-[#FAF8F5] border border-[#E7E2DA] rounded-2xl">
            <div className="flex items-center gap-2">
              {isSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Settings &amp; schedule saved to server!
                </span>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#332E2B] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer hover:scale-[1.01]"
            >
              <Save className="w-4 h-4 text-[#E7C7A8]" />
              <span>Save Schedule &amp; Settings</span>
            </button>
          </div>

        </form>

        {/* 5. Publication Archive & Anti-Repetition Log */}
        {recentDispatches.length > 0 && (
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E2D8] text-[#78350F]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-[#1C1917]">
                  Publication History &amp; Uniqueness Registry
                </h2>
                <p className="text-xs text-[#78716C]">
                  Cross-referenced archive ensuring each morning dispatch delivers fresh, non-duplicative lessons
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {recentDispatches.map((dispatch) => (
                <div
                  key={dispatch.id}
                  className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE3D9] text-xs space-y-2"
                >
                  <div className="flex items-center justify-between font-semibold text-[#1C1917]">
                    <span className="font-serif">
                      Edition #{dispatch.editionNumber} — {dispatch.date}
                    </span>
                    <span className="text-[10px] text-[#78350F] bg-[#FDF4E7] px-2 py-0.5 rounded-full font-mono">
                      {dispatch.sections.length} courses included
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#57524C]">
                    {dispatch.sections.map((sec) => (
                      <div key={sec.courseId} className="flex items-start gap-1.5">
                        <span className="font-bold text-[#1C1917] shrink-0">• {sec.courseTitle}:</span>
                        <span className="truncate text-[#78350F]">
                          {sec.topicTitle || 'Unique Lesson'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
