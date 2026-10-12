import React from "react";

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  className?: string;
  trackClassName?: string;
}

export function ProgressBar({ value, className = "", trackClassName = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high ${trackClassName}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r from-primary to-primary_dim transition-all duration-500 ${className}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
