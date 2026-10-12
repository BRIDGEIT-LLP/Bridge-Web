"use client";

import { usePathname } from "next/navigation";
import {
  ONBOARDING_STEPS,
  STEP_LABELS,
  stepNumber,
  progressForStep,
  getStepByRoute,
} from "@/lib/onboarding-steps";

interface StepProgressProps {
  /**
   * Optional explicit step. When omitted, the active step is derived from the
   * current route so the progress bar always reflects where the user actually is.
   */
  stepKey?: string;
  /** Show the 5 labelled segments (Step-1 style). Defaults to true. */
  showLabels?: boolean;
}

/** Unified Step N / 05 progress header used across all five screens. */
export function StepProgress({ stepKey, showLabels = true }: StepProgressProps) {
  const pathname = usePathname();
  // Route is the source of truth; `stepKey` is only a fallback/override.
  const activeKey = getStepByRoute(pathname)?.key ?? stepKey ?? ONBOARDING_STEPS[0].key;

  const n = stepNumber(activeKey);
  const total = ONBOARDING_STEPS.length;
  const pct = progressForStep(activeKey);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <p className="font-label text-xs font-bold uppercase tracking-[0.1em] text-primary">
          Step {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
        <p className="text-sm font-medium text-on-surface-variant">{pct}% Complete</p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full cta-gradient transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between px-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {STEP_LABELS.map((label, i) => (
            <span key={label} className={i < n ? "text-primary" : ""}>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
