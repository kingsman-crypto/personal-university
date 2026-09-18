'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Clock,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Sliders,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { ArchitectChat } from '@/components/ArchitectChat';
import { CurriculumBlueprint } from '@/components/CurriculumBlueprint';
import { Course } from '@/lib/types';
import {
  getCourseById,
  updateCourse,
  deleteCourse,
  toggleCourseEnabled,
} from '@/lib/storage';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [mobileTab, setMobileTab] = useState<'chat' | 'blueprint'>('chat');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');

  useEffect(() => {
    if (courseId) {
      const found = getCourseById(courseId);
      if (found) {
        setCourse(found);
        setTitleInput(found.title);
        setDescInput(found.description);
      }
    }
  }, [courseId]);

  if (!course) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
        <Header />
        <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-16 text-center">
          <p className="text-sm text-[#78716C] mb-4">Course not found.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1C1917] text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Curriculum
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveMetadata = () => {
    const updated = updateCourse(course.id, {
      title: titleInput.trim() || course.title,
      description: descInput.trim() || course.description,
    });
    if (updated) setCourse(updated);
    setIsEditingTitle(false);
  };

  const handleToggle = () => {
    const newStatus = toggleCourseEnabled(course.id);
    setCourse({ ...course, enabled: newStatus });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${course.title}"?`)) {
      deleteCourse(course.id);
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col selection:bg-[#EAE0D5]">
      <Header />

      {/* Top Banner Navigation */}
      <div className="border-b border-[#E8E2D8] bg-[#FAF8F5]/80 backdrop-blur-xs sticky top-18 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] hover:bg-[#F0EBE1] transition-colors shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#78350F] bg-[#FDF4E7] px-2 py-0.5 rounded-md">
                  {course.category || 'Course'}
                </span>
                <span className="text-xs text-[#8C827A] hidden sm:inline">
                  &bull; Sequence #{course.order + 1}
                </span>
              </div>

              {isEditingTitle ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="px-2 py-1 text-sm font-serif font-bold bg-white border border-[#DCD5C9] rounded-md"
                  />
                  <button
                    onClick={handleSaveMetadata}
                    className="px-2 py-1 text-xs font-semibold bg-[#1C1917] text-white rounded-md"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="font-serif text-lg sm:text-xl font-bold text-[#1C1917] truncate cursor-pointer hover:text-[#78350F] transition-colors"
                  title="Click to edit course title"
                >
                  {course.title}
                </h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Enabled / Paused Toggle */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#E2DACF]">
              <span className="text-xs font-medium text-[#78716C] hidden sm:inline">
                {course.enabled ? 'Included in Daily Dispatch' : 'Paused'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={course.enabled}
                onClick={handleToggle}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  course.enabled ? 'bg-[#1C1917]' : 'bg-[#D6CFC4]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    course.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleDelete}
              className="p-2 text-[#A8A29E] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Delete course"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden border-t border-[#E8E2D8] px-4">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              mobileTab === 'chat'
                ? 'border-[#1C1917] text-[#1C1917]'
                : 'border-transparent text-[#78716C]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#9E5A38]" />
            <span>AI Architect</span>
          </button>
          <button
            onClick={() => setMobileTab('blueprint')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              mobileTab === 'blueprint'
                ? 'border-[#1C1917] text-[#1C1917]'
                : 'border-transparent text-[#78716C]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#78350F]" />
            <span>Course Blueprint</span>
          </button>
        </div>
      </div>

      {/* Main Split Conversational Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-175px)] min-h-[580px]">
          
          {/* Left Column: AI Architect Conversational Workspace */}
          <div
            className={`lg:col-span-7 h-full ${
              mobileTab === 'chat' ? 'block' : 'hidden lg:block'
            }`}
          >
            <ArchitectChat
              course={course}
              onCourseUpdated={(updated) => setCourse(updated)}
            />
          </div>

          {/* Right Column: Live Curriculum Blueprint & Sample Generator */}
          <div
            className={`lg:col-span-5 h-full ${
              mobileTab === 'blueprint' ? 'block' : 'hidden lg:block'
            }`}
          >
            <CurriculumBlueprint
              course={course}
              onCourseUpdated={(updated) => setCourse(updated)}
            />
          </div>

        </div>
      </main>

    </div>
  );
}
