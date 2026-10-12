"use client";

import { Icon } from "@/components/ui/Icon";

interface WeightRowProps {
  label: string;
  description: string;
  icon: string;
  value: number;
  onChange: (value: number) => void;
}

export function WeightRow({ label, description, icon, value, onChange }: WeightRowProps) {
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    onChange(isNaN(v) ? 0 : Math.max(0, Math.min(100, v)));
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-container-low">
      {/* Icon + label */}
      <div className="flex w-52 shrink-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
          <Icon name={icon} size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface">{label}</p>
          <p className="truncate text-xs text-on-surface-variant">{description}</p>
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={handleSlider}
        className="flex-1 cursor-pointer"
        style={{ accentColor: "var(--color-primary)" }}
      />

      {/* Numeric input */}
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={handleInput}
        className="h-9 w-16 shrink-0 rounded-lg border border-outline-variant/30 bg-surface-container-low text-center text-sm font-bold text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
      />

      <span className="w-3 shrink-0 text-xs text-on-surface-variant">%</span>
    </div>
  );
}
