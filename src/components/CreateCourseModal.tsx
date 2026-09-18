'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, BookOpen, Lightbulb, Compass, ArrowRight } from 'lucide-react';
import { createCourse } from '@/lib/storage';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newCourseId: string) => void;
}

const TEMPLATES = [
  {
    title: 'Daily Classical Japanese Haiku',
    description: 'One master haiku each day by Bashō, Buson, or Issa with seasonal kigo analysis, romaji, and English rendering.',
    category: 'Literature & Language',
    readingTimeMinutes: 3,
  },
  {
    title: 'Cognitive Biases in Daily Decision-Making',
    description: 'One mental blindspot each morning, explaining its evolutionary origin, modern traps, and a corrective heuristic.',
    category: 'Psychology',
    readingTimeMinutes: 3,
  },
  {
    title: 'Decisive Treaties That Shaped the Modern World',
    description: 'Daily exploration of historic diplomacy, unexpected compromises, and the geographical borders they forged.',
    category: 'World History',
    readingTimeMinutes: 4,
  },
  {
    title: 'Cosmic Mysteries & Astrophysical Anomalies',
    description: 'Bite-sized briefings on dark matter, magnetars, gravitational lensing, and unsolved cosmological paradoxes.',
    category: 'Science',
    readingTimeMinutes: 4,
  },
];

export function CreateCourseModal({ isOpen, onClose, onCreated }: CreateCourseModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General Curriculum');
  const [readingTimeMinutes, setReadingTimeMinutes] = useState(3);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a course title.');
      return;
    }

    const newCourse = createCourse({
      title: title.trim(),
      description: description.trim() || 'Custom course curated with Personal University Architect.',
      category: category.trim() || 'General Curriculum',
      readingTimeMinutes: Number(readingTimeMinutes) || 3,
      enabled: true,
      instructions: `### Course Objective\nDaily educational deep dive into ${title.trim()}.\n\n### Daily Issue Format\n1. **Core Concept**\n2. **Historical or Theoretical Context**\n3. **Practical Breakdown**\n4. **Daily Takeaways & References**`,
    });

    onCreated(newCourse.id);
    onClose();
    router.push(`/course/${newCourse.id}`);
  };

  const handleSelectTemplate = (template: typeof TEMPLATES[0]) => {
    setTitle(template.title);
    setDescription(template.description);
    setCategory(template.category);
    setReadingTimeMinutes(template.readingTimeMinutes);
    setError('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE3D9] bg-[#F5F2EB]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1C1917] text-[#FAF8F5]">
              <Sparkles className="w-4 h-4 text-[#E7C7A8]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                Create a New Course
              </h3>
              <p className="text-xs text-[#78716C]">
                Define a subject to add to your daily personal university
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8C827A] hover:text-[#1C1917] p-1.5 rounded-lg hover:bg-[#EAE3D9]/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Inspiration Starters */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2.5">
              <Lightbulb className="w-3.5 h-3.5 text-[#9E5A38]" />
              Quick Inspiration Starters
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.title}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className="text-left p-3 rounded-lg border border-[#E2DACF] bg-white hover:bg-[#F9F7F2] hover:border-[#CFC4B5] transition-all text-xs group"
                >
                  <span className="font-serif font-semibold text-[#1C1917] block group-hover:text-[#78350F] mb-1">
                    {tpl.title}
                  </span>
                  <span className="text-[11px] text-[#78716C] line-clamp-2">
                    {tpl.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-[#E8E2D8]" />
            <span className="shrink mx-3 text-[10px] uppercase font-bold tracking-widest text-[#A8A29E]">
              Or Custom Specification
            </span>
            <div className="grow border-t border-[#E8E2D8]" />
          </div>

          <form id="create-course-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tang Poetry & Classical Chinese"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError('');
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 focus:border-[#9E5A38] transition-all font-serif font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                Short Description / Learning Intent
              </label>
              <textarea
                rows={2}
                placeholder="e.g. One poem each morning with characters, pinyin, historical context, and translation."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 focus:border-[#9E5A38] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Category Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Language, History, Art"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#DCD5C9] rounded-lg text-xs text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                  Est. Daily Reading Time (Minutes)
                </label>
                <select
                  value={readingTimeMinutes}
                  onChange={(e) => setReadingTimeMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-[#DCD5C9] rounded-lg text-xs text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30"
                >
                  <option value={2}>2 minutes (Quick bite)</option>
                  <option value={3}>3 minutes (Standard)</option>
                  <option value={5}>5 minutes (Deep study)</option>
                  <option value={7}>7 minutes (Comprehensive)</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
                {error}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EAE3D9] bg-[#F5F2EB]/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-[#57524C] hover:bg-[#EAE3D9]/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-course-form"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#1C1917] hover:bg-[#332E2B] text-white transition-colors cursor-pointer shadow-xs"
          >
            <span>Create &amp; Open Architect</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#E7C7A8]" />
          </button>
        </div>

      </div>
    </div>
  );
}
