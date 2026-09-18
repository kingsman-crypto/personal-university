'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  BookOpen,
  Mail,
  Sparkles,
  Compass,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { CourseList } from '@/components/CourseList';
import { CreateCourseModal } from '@/components/CreateCourseModal';
import { Course, NewsletterSettings } from '@/lib/types';
import {
  getCourses,
  saveCourses,
  toggleCourseEnabled,
  deleteCourse,
  reorderCourses,
  getNewsletterSettings,
  resetToDefaults,
} from '@/lib/storage';

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<NewsletterSettings | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadData = () => {
    setCourses(getCourses());
    setSettings(getNewsletterSettings());
  };

  useEffect(() => {
    setMounted(true);
    loadData();
    window.addEventListener('pu_storage_updated', loadData);
    return () => window.removeEventListener('pu_storage_updated', loadData);
  }, []);

  const handleToggle = (id: string) => {
    toggleCourseEnabled(id);
    loadData();
  };

  const handleDelete = (id: string) => {
    deleteCourse(id);
    loadData();
  };

  const handleReorder = (activeId: string, overId: string) => {
    const updated = reorderCourses(activeId, overId);
    setCourses(updated);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset curriculum and settings to default demo courses?')) {
      resetToDefaults();
      loadData();
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
        <Header />
        <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12 animate-pulse space-y-6">
          <div className="h-10 bg-[#EAE3D9] rounded-lg w-1/3" />
          <div className="h-32 bg-[#EAE3D9] rounded-xl" />
        </div>
      </div>
    );
  }

  const enabledCourses = courses.filter((c) => c.enabled);
  const totalReadingTime = enabledCourses.reduce(
    (sum, c) => sum + (c.readingTimeMinutes || 3),
    0
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col selection:bg-[#EAE0D5]">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        
        {/* Editorial Masthead Hero */}
        <section className="relative pb-6 border-b border-[#E8E2D8]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-[11px] uppercase tracking-widest font-bold text-[#78350F] bg-[#FDF4E7] px-2.5 py-1 rounded-full inline-block mb-3">
                Curriculum Dashboard
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1C1917] leading-[1.15]">
                Curate your personal morning syllabus.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-[#57524C] leading-relaxed">
                Design custom courses with an AI Curriculum Architect. Each morning, receive a unified, beautifully typeset newsletter containing your enabled subjects in your chosen sequence.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#332E2B] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4 text-[#E7C7A8]" />
                <span>Create Course</span>
              </button>

              <Link
                href="/preview"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCD5C9] bg-white hover:bg-[#F9F7F2] text-[#1C1917] text-xs sm:text-sm font-semibold transition-colors shadow-2xs"
              >
                <BookOpen className="w-4 h-4 text-[#78350F]" />
                <span>Read Dispatch</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <div className="p-4 bg-white border border-[#E7E2DA] rounded-xl shadow-2xs">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#78716C] block mb-1">
                Total Courses
              </span>
              <span className="font-serif text-2xl font-bold text-[#1C1917]">
                {courses.length}
              </span>
            </div>

            <div className="p-4 bg-white border border-[#E7E2DA] rounded-xl shadow-2xs">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#78716C] block mb-1">
                Active in Newsletter
              </span>
              <div className="flex items-center gap-2">
                <span className="font-serif text-2xl font-bold text-[#78350F]">
                  {enabledCourses.length}
                </span>
                <span className="text-[10px] text-[#8C827A]">
                  of {courses.length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white border border-[#E7E2DA] rounded-xl shadow-2xs">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#78716C] block mb-1">
                Est. Daily Reading
              </span>
              <span className="font-serif text-2xl font-bold text-[#1C1917] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#78350F]" />
                {totalReadingTime} min
              </span>
            </div>

            <div className="p-4 bg-white border border-[#E7E2DA] rounded-xl shadow-2xs">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#78716C] block mb-1">
                Delivery Schedule
              </span>
              <Link
                href="/settings"
                className="font-serif text-base font-semibold text-[#1C1917] hover:text-[#78350F] flex items-center justify-between group"
              >
                <span>{settings?.deliveryDays.length || 5} days/week</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8C827A] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Course Reordering Notice & List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1C1917]">
                Your Courses
              </h2>
              <p className="text-xs text-[#78716C]">
                Drag cards using the handle on the left to reorder sections in your daily email. Toggle to pause or include.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-[11px] text-[#A8A29E] hover:text-[#57524C] flex items-center gap-1 cursor-pointer transition-colors"
              title="Reset sample courses"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Samples</span>
            </button>
          </div>

          {/* DnD Sortable Course List */}
          <CourseList
            courses={courses}
            onReorder={handleReorder}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onCreateOpen={() => setIsCreateOpen(true)}
          />
        </section>

        {/* Newsletter Preview Banner */}
        {enabledCourses.length > 0 && (
          <section className="p-6 bg-[#F5EFE6] border border-[#DDD5C9] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2 bg-[#1C1917] rounded-lg text-white shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-[#E7C7A8]" />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold text-[#1C1917]">
                  Ready to read today&apos;s personal edition?
                </h3>
                <p className="text-xs text-[#57524C] mt-0.5">
                  Generated with {enabledCourses.length} active courses in your custom sequence.
                </p>
              </div>
            </div>

            <Link
              href="/preview"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1C1917] hover:bg-[#332E2B] text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <span>View Today&apos;s Dispatch</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E7C7A8]" />
            </Link>
          </section>
        )}

      </main>

      {/* Course Creation Modal */}
      <CreateCourseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => loadData()}
      />
    </div>
  );
}
