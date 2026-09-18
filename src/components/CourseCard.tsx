'use client';

import React from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Sparkles,
  Clock,
  Trash2,
  CheckCircle2,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Course } from '@/lib/types';

interface CourseCardProps {
  course: Course;
  index: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CourseCard({ course, index, onToggle, onDelete }: CourseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const hasBlueprint = Boolean(course.instructions && course.instructions.length > 50);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border transition-all duration-200 ${
        isDragging
          ? 'bg-[#F5EFE6] border-[#B8A490] shadow-xl opacity-90 scale-[1.02]'
          : course.enabled
          ? 'bg-white border-[#E7E2DA] hover:border-[#D1C7BA] shadow-xs hover:shadow-md'
          : 'bg-[#F7F5F0]/60 border-[#EAE5DE] opacity-75 hover:opacity-100'
      }`}
    >
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Left section: Drag Handle, Number, & Info */}
        <div className="flex items-start gap-3.5 sm:gap-4 w-full sm:w-auto">
          
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="mt-1 sm:mt-0 p-1.5 -ml-1 text-[#A8A29E] hover:text-[#44403C] hover:bg-[#F2ECE4] rounded-md cursor-grab active:cursor-grabbing transition-colors"
            title="Drag to reorder course in newsletter"
            aria-label="Drag handle"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Sequence badge */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-semibold shrink-0 transition-colors ${
              course.enabled
                ? 'bg-[#1C1917] text-[#FAF8F5]'
                : 'bg-[#E5E0D8] text-[#78716C]'
            }`}
          >
            {index + 1}
          </div>

          {/* Course Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {course.category && (
                <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-[#F4EFE6] text-[#7A583A] border border-[#EBE4D8]">
                  {course.category}
                </span>
              )}
              {course.readingTimeMinutes && (
                <span className="flex items-center gap-1 text-xs text-[#8C827A]">
                  <Clock className="w-3 h-3" />
                  {course.readingTimeMinutes} min
                </span>
              )}
              {hasBlueprint ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Blueprint Architected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <Sparkles className="w-3 h-3" />
                  Needs Architecture
                </span>
              )}
            </div>

            <Link
              href={`/course/${course.id}`}
              className="block group-hover:text-[#78350F] transition-colors"
            >
              <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#1C1917] leading-snug tracking-tight">
                {course.title}
              </h3>
            </Link>

            <p className="mt-1 text-sm text-[#57524C] line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          </div>
        </div>

        {/* Right section: Toggle Switch & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#EFE9DF]">
          
          {/* Active Status Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#78716C] select-none">
              {course.enabled ? 'Included' : 'Paused'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={course.enabled}
              onClick={() => onToggle(course.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 ${
                course.enabled ? 'bg-[#1C1917]' : 'bg-[#D6CFC4]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  course.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#E7E2DA] hidden sm:block" />

          {/* AI Architect Link */}
          <Link
            href={`/course/${course.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FAF8F5] hover:bg-[#F2EDE4] text-[#1C1917] border border-[#DDD5C9] transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#9E5A38]" />
            <span>AI Architect</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#8C827A]" />
          </Link>

          {/* Delete Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remove "${course.title}" from your courses?`)) {
                onDelete(course.id);
              }
            }}
            className="p-1.5 text-[#A8A29E] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Delete course"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
