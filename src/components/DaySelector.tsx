'use client';

import React from 'react';
import { Calendar, Check } from 'lucide-react';

interface DaySelectorProps {
  selectedDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  onChange: (days: number[]) => void;
}

const DAYS = [
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
  { value: 0, label: 'Sun', full: 'Sunday' },
];

export function DaySelector({ selectedDays, onChange }: DaySelectorProps) {
  const toggleDay = (val: number) => {
    if (selectedDays.includes(val)) {
      if (selectedDays.length === 1) {
        alert('Please select at least one delivery day.');
        return;
      }
      onChange(selectedDays.filter((d) => d !== val));
    } else {
      onChange([...selectedDays, val].sort((a, b) => a - b));
    }
  };

  const setEveryday = () => onChange([0, 1, 2, 3, 4, 5, 6]);
  const setWeekdays = () => onChange([1, 2, 3, 4, 5]);
  const setWeekends = () => onChange([0, 6]);

  const isEveryday = selectedDays.length === 7;
  const isWeekdays =
    selectedDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => selectedDays.includes(d));
  const isWeekends =
    selectedDays.length === 2 &&
    [0, 6].every((d) => selectedDays.includes(d));

  const summaryText = isEveryday
    ? 'Every day (7 days a week)'
    : isWeekdays
    ? 'Weekdays (Monday to Friday)'
    : isWeekends
    ? 'Weekends (Saturday & Sunday)'
    : `${selectedDays.length} days a week: ${DAYS.filter((d) =>
        selectedDays.includes(d.value)
      )
        .map((d) => d.label)
        .join(', ')}`;

  return (
    <div className="space-y-3">
      
      {/* Preset shortcut chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={setEveryday}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            isEveryday
              ? 'bg-[#1C1917] text-white'
              : 'bg-[#F2EDE4] hover:bg-[#EAE2D5] text-[#57524C]'
          }`}
        >
          Every Day
        </button>
        <button
          type="button"
          onClick={setWeekdays}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            isWeekdays
              ? 'bg-[#1C1917] text-white'
              : 'bg-[#F2EDE4] hover:bg-[#EAE2D5] text-[#57524C]'
          }`}
        >
          Weekdays
        </button>
        <button
          type="button"
          onClick={setWeekends}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            isWeekends
              ? 'bg-[#1C1917] text-white'
              : 'bg-[#F2EDE4] hover:bg-[#EAE2D5] text-[#57524C]'
          }`}
        >
          Weekends
        </button>
      </div>

      {/* Tactile Day Buttons */}
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`py-3 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#1C1917] border-[#1C1917] text-white shadow-xs'
                  : 'bg-white border-[#E0D9CE] text-[#57524C] hover:bg-[#F9F7F2]'
              }`}
            >
              <span className="text-xs font-semibold">{day.label}</span>
              <span className="mt-1">
                {isSelected ? (
                  <Check className="w-3.5 h-3.5 text-[#E7C7A8]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D6CFC4] inline-block" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary readout */}
      <p className="flex items-center gap-1.5 text-xs text-[#78716C] mt-2">
        <Calendar className="w-3.5 h-3.5 text-[#9E5A38]" />
        <span>
          <strong>Schedule:</strong> {summaryText}
        </span>
      </p>

    </div>
  );
}
