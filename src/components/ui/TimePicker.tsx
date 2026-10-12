"use client";

import { Select } from "@/components/ui/Select";

interface TimePickerProps {
  label?: string;
  required?: boolean;
  /** 24h "HH:mm", e.g. "14:30". */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Minutes between options. Defaults to 15. */
  stepMinutes?: number;
  /** If set (24h "HH:mm"), options before this time are hidden — used to block past times when the selected date is today. */
  minTime?: string;
}

/** Build every "HH:mm" of the day at the given step, labeled in 12h form (e.g. "2:30 PM"). */
function buildTimeOptions(stepMinutes: number) {
  const options: { value: string; label: string }[] = [];
  for (let mins = 0; mins < 24 * 60; mins += stepMinutes) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 < 12 ? "AM" : "PM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    options.push({
      value: `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      label: `${h12}:${String(m).padStart(2, "0")} ${period}`,
    });
  }
  return options;
}

/**
 * Dropdown time picker (searchable list of "2:30 PM"-style options) — replaces the
 * native `<input type="time">`, whose scrubber/segment UI users found confusing.
 * Reuses the shared `Select`, so it gets the same search box + keyboard/outside-click
 * handling for free.
 */
export function TimePicker({ label = "Time", required, value, onChange, error, stepMinutes = 15, minTime }: TimePickerProps) {
  const options = buildTimeOptions(stepMinutes).filter((o) => !minTime || o.value >= minTime);
  return (
    <Select
      label={label}
      required={required}
      placeholder="Select time…"
      options={options}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
