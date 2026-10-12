"use client";

import { DealRoomList } from "./DealRoomList";
import { DEAL_TABS } from "./deal-room-meta";
import type { DealRoom, DealRoomTab } from "./types";

interface DealRoomScreenProps {
  rooms: DealRoom[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  tab: DealRoomTab;
  onTabChange: (t: DealRoomTab) => void;
  onOpen: (room: DealRoom) => void;
}

/**
 * The Deal Rooms list screen — "Workspace Overview" header, Active/Closed Deals
 * toggle, then the rooms list. Data-source agnostic (same shape as ConnectionsScreen),
 * so a future live page could render this unchanged.
 */
export function DealRoomScreen({
  rooms,
  loading,
  error,
  onRetry,
  tab,
  onTabChange,
  onOpen,
}: DealRoomScreenProps) {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header row — eyebrow + title on the left, deals toggle on the right */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase">
            Workspace Overview
          </p>
          <h1 className="mt-1 font-headline text-2xl font-extrabold tracking-[-0.02em] text-primary sm:text-3xl">
            Deal Rooms
          </h1>
        </div>

        <div className="inline-flex w-full gap-1 rounded-full bg-surface-container-high p-1 sm:w-auto">
          {DEAL_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className={`flex-1 whitespace-nowrap rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm ${
                tab === t.key
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <DealRoomList rooms={rooms} onOpen={onOpen} loading={loading} error={error} onRetry={onRetry} />
    </div>
  );
}
