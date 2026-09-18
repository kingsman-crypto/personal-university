'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Course } from '@/lib/types';
import { CourseCard } from './CourseCard';
import { BookOpen, PlusCircle } from 'lucide-react';

interface CourseListProps {
  courses: Course[];
  onReorder: (activeId: string, overId: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateOpen: () => void;
}

export function CourseList({
  courses,
  onReorder,
  onToggle,
  onDelete,
  onCreateOpen,
}: CourseListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Avoid accidental drags when clicking links
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  if (courses.length === 0) {
    return (
      <div className="text-center py-16 px-6 bg-white border border-dashed border-[#DDD5C9] rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-[#F5EFE6] text-[#78350F] flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="font-serif text-xl font-semibold text-[#1C1917] mb-2">
          Your syllabus is empty
        </h3>
        <p className="text-sm text-[#78716C] max-w-md mx-auto mb-6 leading-relaxed">
          Create your first course to begin architecting custom educational sections for your personalized daily newsletter.
        </p>
        <button
          type="button"
          onClick={onCreateOpen}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C1917] text-white text-xs font-semibold hover:bg-[#332E2B] transition-colors cursor-pointer shadow-xs"
        >
          <PlusCircle className="w-4 h-4 text-[#E7C7A8]" />
          Create First Course
        </button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={courses.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3.5">
          {courses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
