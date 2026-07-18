"use client";

import { WEEKDAY_OPTIONS } from "@/lib/time";

export function WeekdaySelector({
  selected,
  onChange,
  disabled = false,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  function toggleDay(day: number) {
    if (disabled) return;
    if (selected.includes(day)) {
      if (selected.length === 1) return;
      onChange(selected.filter((value) => value !== day));
      return;
    }
    onChange([...selected, day].sort((a, b) => a - b));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Days of week</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={() => toggleDay(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
