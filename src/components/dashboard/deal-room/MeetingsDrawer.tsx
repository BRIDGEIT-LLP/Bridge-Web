"use client";

import { Drawer } from "@/components/ui/Drawer";
import { AsyncState } from "@/components/ui/AsyncState";
import { Icon } from "@/components/ui/Icon";
import type { ScheduledMeeting } from "./types";

interface MeetingsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Every meeting in the room, already fetched by DealSidePanel. */
  meetings: ScheduledMeeting[];
  now: number;
  loading: boolean;
  error: string | null;
  /** Refetch the meeting list. Owned by DealSidePanel. */
  onRetry: () => void;
  /** Open the details modal for the chosen meeting. */
  onSelect: (meeting: ScheduledMeeting) => void;
  /** Open the Schedule Meeting drawer. */
  onScheduleNew: () => void;
  closed: boolean;
}

/**
 * Right-side drawer listing EVERY meeting scheduled in this deal room, mirroring
 * `SharedFilesDrawer`. Presentational: `DealSidePanel` owns the single `GET /meetings`
 * call and derives its inline "upcoming" card from the same list, so opening this no
 * longer costs a request. Each row opens `MeetingDetailsModal` with the whole row.
 * Also surfaces "Schedule Meeting" in the footer since meetings (unlike files) are
 * created here.
 */
export function MeetingsDrawer({
  open,
  onClose,
  meetings,
  now,
  loading,
  error,
  onRetry,
  onSelect,
  onScheduleNew,
  closed,
}: MeetingsDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Upcoming Meetings"
      subtitle="All meetings scheduled in this deal room"
      footer={
        <button
          type="button"
          disabled={closed}
          onClick={onScheduleNew}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold max-sm:px-3 max-sm:text-sm text-on-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="add" size={18} />
          Schedule Meeting
        </button>
      }
    >
      <AsyncState
        loading={loading}
        error={error}
        isEmpty={meetings.length === 0}
        emptyIcon="event_busy"
        emptyText="No meetings scheduled yet."
        onRetry={onRetry}
      >
        <ul className="flex flex-col gap-1">
          {(() => {
            const upcoming = meetings
              .filter((mtg) => new Date(mtg.scheduledAt).getTime() >= now)
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            const past = meetings
              .filter((mtg) => new Date(mtg.scheduledAt).getTime() < now)
              .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
            return [...upcoming, ...past];
          })().map((mtg, index, sorted) => {
            const isPast = new Date(mtg.scheduledAt).getTime() < now;
            const prevIsPast = index > 0 && new Date(sorted[index - 1].scheduledAt).getTime() < now;
            const showHistoryDivider = isPast && !prevIsPast;
            return (
              <li key={mtg.id}>
                {showHistoryDivider && (
                  <div className="my-2 flex items-center gap-3 px-1" role="separator">
                    <span className="h-px flex-1 bg-outline-variant" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      History
                    </span>
                    <span className="h-px flex-1 bg-outline-variant" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(mtg)}
                  className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-surface-container-low"
                >
                  <Icon name="event" size={22} className={`shrink-0 ${isPast ? "text-on-surface-variant" : "text-primary"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${isPast ? "text-on-surface-variant" : "text-on-surface"}`}>
                      {mtg.title}
                    </span>
                    <span className="block truncate text-xs text-on-surface-variant">
                      {mtg.when}
                      {mtg.requesterName && ` · ${mtg.requesterName}`}
                    </span>
                    {mtg.createdAtLabel && (
                      <span className="block truncate text-[11px] text-on-surface-variant/70">
                        Created {mtg.createdAtLabel}
                      </span>
                    )}
                  </span>
                  <Icon name="chevron_right" size={18} className="shrink-0 text-on-surface-variant" />
                </button>
              </li>
            );
          })}
        </ul>
      </AsyncState>
    </Drawer>
  );
}
