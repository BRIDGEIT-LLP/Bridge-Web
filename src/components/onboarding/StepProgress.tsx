"use client";

import { usePathname } from "next/navigation";
import { ONBOARDING_STEPS, stepNumber, getStepByRoute } from "@/lib/onboarding-steps";

interface StepProgressProps {
  /**
   * Optional explicit step. When omitted, the active step is derived from the
   * current route so the progress bar always reflects where the user actually is.
   */
  stepKey?: string;
  /** Show the numbered segment labels below the bar. Defaults to true. */
  showLabels?: boolean;
}

/** Segmented step bar (one pill per step, gapped) used across all five onboarding screens. */
export function StepProgress({ stepKey, showLabels = true }: StepProgressProps) {
  const pathname = usePathname();
  // Route is the source of truth; `stepKey` is only a fallback/override.
  const activeKey = getStepByRoute(pathname)?.key ?? stepKey ?? ONBOARDING_STEPS[0].key;

  const n = stepNumber(activeKey);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-4">
        {ONBOARDING_STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
              i < n ? "bg-primary" : "bg-surface-container"
            }`}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-4">
          {ONBOARDING_STEPS.map((s, i) => {
            const stepNo = i + 1;
            const isCurrent = stepNo === n;
            const isDone = stepNo < n;
            return (
              <span
                key={s.key}
                className={`flex-1 text-xs ${
                  isCurrent
                    ? "font-bold text-primary"
                    : isDone
                      ? "font-medium text-on-surface"
                      : "font-medium text-on-surface-variant"
                }`}
              >
                {stepNo} {s.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
