"use client";

import { Icon } from "@/components/ui/Icon";
import { DEAL_STAGES, DEAL_STAGE_ICONS, DEAL_STAGE_INFO } from "./deal-room-meta";

// Colours are applied via inline styles, not Tailwind classes: this Tailwind v4 setup
// doesn't reliably generate arbitrary colour utilities (green/hex), so inline is safe.
const GREEN = "#15803d"; // completed stage
const BLUE = "#0c56d0"; // current stage (matches --color-primary)
const BLUE_DIM = "#004aba"; // gradient end (matches --color-primary-dim)
const TRACK = "#e4e9ea"; // upcoming connector + circle border
const MUTED = "#586064"; // upcoming number + label

// Circle geometry — the connector sits at the circle's vertical centre.
const CIRCLE = 40;
const BAR = 4;

interface DealStageStepperProps {
  /** 0-based index of the stage the deal is currently in. */
  stage: number;
}

/**
 * The 4-step deal pipeline (LOI Signed → Due Diligence → Term Sheet → Closing).
 *
 * A single gradient track runs the full width and fills proportionally to overall
 * progress (glowing where it's lit), with each stage's circle sitting on top — solid
 * green + check when done, a glowing pulsing primary dot on the current stage, and a
 * flat outlined dot for what's ahead.
 */
export function DealStageStepper({ stage }: DealStageStepperProps) {
  const last = DEAL_STAGES.length - 1;

  return (
    <div className="rounded-2xl bg-surface-container-low px-2 py-4 sm:px-7 sm:py-5">
      <div className="flex">
        {DEAL_STAGES.map((label, i) => {
          const done = i < stage;
          const current = i === stage;

          // Fill of the connector leaving this circle toward the next — only a fully
          // completed segment fills; the current stage's outgoing segment stays empty.
          const fillWidth = i < stage ? "100%" : "0%";

          return (
            <div key={label} className="group relative flex min-w-0 flex-1 flex-col items-center">
              {/* Connector: from this circle's centre to the next circle's centre. Only
                  fully-completed segments fill (the current stage's own segment stays
                  empty — the colour stops right at its circle, not partway to the next). */}
              {i < last && (
                <span
                  aria-hidden
                  className="absolute left-1/2 w-full overflow-hidden rounded-full"
                  style={{ top: (CIRCLE - BAR) / 2, height: BAR, backgroundColor: TRACK }}
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: fillWidth,
                      background: GREEN,
                      boxShadow: done ? `0 0 8px 0 ${GREEN}66` : "none",
                    }}
                  />
                </span>
              )}

              {/* Circle */}
              <span
                className={`relative z-10 flex items-center justify-center rounded-full text-[13px] font-bold transition-transform duration-300 ${current ? "scale-[1.08]" : ""}`}
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  ...(done
                    ? { backgroundColor: GREEN, color: "#fff", boxShadow: `0 4px 12px 0 ${GREEN}4d` }
                    : current
                      ? {
                          background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DIM} 100%)`,
                          color: "#fff",
                          animation: "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                        }
                      : {
                          backgroundColor: "#fff",
                          color: MUTED,
                          border: `1.5px solid ${TRACK}`,
                        }),
                }}
              >
                {done ? (
                  <Icon name="check" size={18} />
                ) : current ? (
                  <Icon name={DEAL_STAGE_ICONS[i]} size={18} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>

              {/* Label */}
              <span
                className={`mt-2.5 px-0.5 text-center text-[9px] leading-tight tracking-[0.06em] uppercase sm:text-[11px] sm:tracking-[0.08em] ${current ? "font-extrabold" : "font-bold"}`}
                style={{ color: done ? GREEN : current ? BLUE : MUTED }}
              >
                {label}
              </span>

              {/* Info tooltip — styled flyout below the label, shown on hover/focus. */}
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[220px] -translate-x-1/2 scale-95 rounded-lg bg-surface-container-highest px-3 py-2 text-center text-xs font-medium normal-case tracking-normal text-on-surface opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
              >
                {DEAL_STAGE_INFO[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
