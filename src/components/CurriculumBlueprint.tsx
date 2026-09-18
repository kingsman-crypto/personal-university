'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  Edit3,
  Eye,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Clock,
  BookOpen,
  X,
} from 'lucide-react';
import { Course, NewsletterSection } from '@/lib/types';
import { updateCourse, getStoredApiKey } from '@/lib/storage';

interface CurriculumBlueprintProps {
  course: Course;
  onCourseUpdated: (updated: Course) => void;
}

export function CurriculumBlueprint({ course, onCourseUpdated }: CurriculumBlueprintProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [instructions, setInstructions] = useState(course.instructions || '');
  const [savedAlert, setSavedAlert] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleSection, setSampleSection] = useState<NewsletterSection | null>(null);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);

  // Sync instructions if parent course updates
  React.useEffect(() => {
    setInstructions(course.instructions || '');
  }, [course.instructions]);

  const handleSave = () => {
    const updated = updateCourse(course.id, { instructions });
    if (updated) {
      onCourseUpdated(updated);
      setSavedAlert(true);
      setTimeout(() => setSavedAlert(false), 2000);
      setIsEditing(false);
    }
  };

  const handleGenerateSample = async () => {
    setIsGeneratingSample(true);
    try {
      const apiKey = getStoredApiKey();
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          course: { ...course, instructions },
          apiKey,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate sample');
      const data: NewsletterSection = await res.json();
      setSampleSection(data);
      setIsSampleModalOpen(true);
    } catch (err) {
      console.error('Sample generation error:', err);
      alert('Could not generate sample lesson. Please try again.');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border border-[#E7E2DA] rounded-2xl shadow-xs overflow-hidden">
      
      {/* Blueprint Top Bar */}
      <div className="px-5 py-4 border-b border-[#EAE3D9] bg-[#FAF8F5] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#78350F]" />
          <h3 className="font-serif text-base font-semibold text-[#1C1917]">
            Curriculum Blueprint
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {savedAlert && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (isEditing) handleSave();
              else setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#DCD5C9] bg-white hover:bg-[#F7F5F0] text-[#443E3A] transition-colors cursor-pointer"
          >
            {isEditing ? (
              <>
                <Save className="w-3 h-3 text-[#78350F]" />
                Save Brief
              </>
            ) : (
              <>
                <Edit3 className="w-3 h-3 text-[#78350F]" />
                Direct Edit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Blueprint Body */}
      <div className="flex-1 p-5 overflow-y-auto">
        {isEditing ? (
          <div className="h-full flex flex-col">
            <label className="text-[11px] uppercase tracking-wider font-semibold text-[#8C827A] mb-1.5">
              Course Instructions &amp; Daily Specification (Markdown)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="### Course Objective\n..."
              className="flex-1 w-full p-3.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-xl text-xs font-mono text-[#1C1917] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 resize-none leading-relaxed"
            />
          </div>
        ) : (
          <div className="prose-editorial max-w-none text-xs sm:text-sm">
            {instructions ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {instructions}
              </ReactMarkdown>
            ) : (
              <div className="text-center py-12 text-[#8C827A]">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#C4B5A5]" />
                <p className="font-serif text-base text-[#443E3A]">
                  No blueprint saved yet
                </p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Chat with the AI Architect on the left to refine your learning goals and craft a bespoke daily format.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Blueprint Action Footer */}
      <div className="p-4 border-t border-[#EAE3D9] bg-[#FAF8F5] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
          <Clock className="w-3.5 h-3.5" />
          <span>Est. {course.readingTimeMinutes || 3} min daily read</span>
        </div>

        <button
          type="button"
          onClick={handleGenerateSample}
          disabled={isGeneratingSample}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#1C1917] hover:bg-[#332E2B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {isGeneratingSample ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E7C7A8]" />
              Architecting Sample...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#E7C7A8]" />
              Generate Sample Lesson
            </>
          )}
        </button>
      </div>

      {/* Sample Lesson Modal */}
      {isSampleModalOpen && sampleSection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSampleModalOpen(false);
          }}
        >
          <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE3D9] bg-[#F5F2EB]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#78350F]" />
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                    Sample Daily Lesson Preview
                  </h3>
                  <p className="text-xs text-[#78716C]">
                    Generated strictly according to your current curriculum blueprint
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="text-[#8C827A] hover:text-[#1C1917] p-1.5 rounded-lg hover:bg-[#EAE3D9]/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-white border border-[#E7E2DA] rounded-xl p-6 shadow-2xs">
                <div className="prose-editorial max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {sampleSection.content}
                  </ReactMarkdown>
                </div>

                {sampleSection.keyTakeaways && (
                  <div className="mt-6 p-4 bg-[#F8F6F1] rounded-lg border-l-3 border-[#78350F]">
                    <p className="text-xs uppercase font-bold tracking-wider text-[#78350F] mb-2">
                      Key Takeaways
                    </p>
                    <ul className="text-xs space-y-1 text-[#443E3A] list-disc list-inside">
                      {sampleSection.keyTakeaways.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#EAE3D9] bg-[#F5F2EB]/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSampleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1C1917] hover:bg-[#332E2B] text-white transition-colors cursor-pointer"
              >
                Looks Good &bull; Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
