"use client";

import { useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Drawer";
import { AsyncState } from "@/components/ui/AsyncState";
import type { SharedFileItem } from "@/services/deal-room.service";
import type { PreviewableFile } from "./types";
import { DEAL_STAGES, DEAL_STAGE_ICONS, stageIndexFromValue } from "./deal-room-meta";

/** Human-readable file size, e.g. "1.4 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Same palette as DealStageStepper (kept local — see that file's comment: this Tailwind
// v4 setup doesn't reliably generate arbitrary colour utilities, so inline is safe).
const GREEN = "#15803d"; // completed stage
const BLUE = "#0c56d0"; // current stage
const BLUE_DIM = "#004aba";
const TRACK = "#e4e9ea"; // upcoming connector + circle border
const MUTED = "#586064"; // upcoming label

const CIRCLE = 32;

interface SharedFilesDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Every file in the room, already fetched by DealSidePanel. */
  files: SharedFileItem[];
  loading: boolean;
  error: string | null;
  /** Refetch the shared file list. Owned by DealSidePanel. */
  onRetry: () => void;
  /** 0-based index of the stage the deal is currently in — colours the stepper the same
   *  way as DealStageStepper (done / current / upcoming). */
  currentStage: number;
  /** Open the watermarked preview modal for the chosen file. */
  onPreview: (file: PreviewableFile) => void;
}

/**
 * Right-side drawer listing EVERY file shared in a deal room, grouped by the pipeline
 * stage it was shared under — a vertical mirror of `DealStageStepper` (circle + stage
 * name per row, connected top-to-bottom) with that stage's files nested underneath.
 *
 * Presentational: the list comes from `DealSidePanel`, which already fetches the full
 * (unfiltered) set for its inline preview — opening this drawer used to refetch the
 * identical payload. Each file row opens the shared watermarked preview modal (download
 * gated by `downloadAllowed`).
 */
export function SharedFilesDrawer({
  open,
  onClose,
  files,
  loading,
  error,
  onRetry,
  currentStage,
  onPreview,
}: SharedFilesDrawerProps) {
  // Bucket every file under its stage, in stepper order — mirrors DealStageStepper's
  // fixed 4-step layout so a stage with 0 files still renders its row (consistent with
  // the horizontal stepper always showing all 4 stages, done or not).
  const groups = useMemo(
    () =>
      DEAL_STAGES.map((label, i) => ({
        index: i,
        label,
        icon: DEAL_STAGE_ICONS[i],
        files: files.filter((f) => stageIndexFromValue(f.stage) === i),
      })),
    [files],
  );

  return (
    <Drawer open={open} onClose={onClose} title="Shared Files" subtitle="All files shared in this deal room" footer={null}>
      <AsyncState
        loading={loading}
        error={error}
        isEmpty={files.length === 0}
        emptyIcon="folder_off"
        emptyText="No files shared yet."
        onRetry={onRetry}
      >
        <div className="flex flex-col p-1">
          {groups.map((g, i) => {
            const done = g.index < currentStage;
            const current = g.index === currentStage;
            const last = i === groups.length - 1;

            return (
              <div key={g.label} className="flex gap-3">
                {/* Circle + connector column — stretches to match the files column's
                    height (default items-stretch), so the line always reaches the next circle. */}
                <div className="flex flex-col items-center">
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      width: CIRCLE,
                      height: CIRCLE,
                      ...(done
                        ? { backgroundColor: GREEN, color: "#fff" }
                        : current
                          ? { background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DIM} 100%)`, color: "#fff" }
                          : { backgroundColor: "#fff", color: MUTED, border: `1.5px solid ${TRACK}` }),
                    }}
                  >
                    {done ? <Icon name="check" size={16} /> : current ? <Icon name={g.icon} size={16} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  {!last && (
                    <span
                      aria-hidden
                      className="my-1 w-[3px] flex-1 rounded-full"
                      style={{ backgroundColor: done ? GREEN : TRACK }}
                    />
                  )}
                </div>

                {/* Stage name + its files */}
                <div className="min-w-0 flex-1 pb-6">
                  <p
                    className="pt-1.5 text-xs font-extrabold tracking-[0.06em] uppercase"
                    style={{ color: done ? GREEN : current ? BLUE : MUTED }}
                  >
                    {g.label}
                  </p>

                  {g.files.length === 0 ? (
                    <p className="mt-1.5 text-xs text-on-surface-variant">No files shared in this stage.</p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {g.files.map((f) => (
                        <li key={f.messageId}>
                          <button
                            type="button"
                            onClick={() => onPreview(f)}
                            className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-surface-container-low"
                          >
                            <Icon name={f.kind === "image" ? "image" : "description"} size={24} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-on-surface">{f.name}</span>
                              <span className="block truncate text-xs text-on-surface-variant">
                                {formatSize(f.size)} · {f.by}
                              </span>
                              {f.atLabel && (
                                <span className="block truncate text-[11px] text-on-surface-variant/70">
                                  Created {f.atLabel}
                                </span>
                              )}
                            </span>
                            <Icon
                              name={f.downloadAllowed ? "download" : "visibility"}
                              size={16}
                              className="shrink-0 text-on-surface-variant"
                              aria-label={f.downloadAllowed ? "Downloadable" : "View only"}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AsyncState>
    </Drawer>
  );
}
