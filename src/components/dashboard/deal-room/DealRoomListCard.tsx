"use client";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_AVATAR_GRADIENT } from "@/lib/connections";
import { DEAL_STATUS_BADGE, initials } from "./deal-room-meta";
import type { DealRoom } from "./types";

interface DealRoomListCardProps {
  room: DealRoom;
  onOpen: (room: DealRoom) => void;
}

/**
 * One deal-room card — blue accent bar, deal title + status badge, counterparty and
 * last-activity meta, and the "Open Deal Room →" pill on the right.
 */
export function DealRoomListCard({ room, onOpen }: DealRoomListCardProps) {
  const { counterparty: cp } = room;
  const badge = DEAL_STATUS_BADGE[room.status];

  return (
    <button
      type="button"
      onClick={() => onOpen(room)}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-surface-container-lowest py-3 pr-3 pl-5 text-left shadow-sm transition-shadow hover:shadow-md sm:pr-4 sm:pl-7"
    >
      {/* Accent bar */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${room.status === "CLOSED" ? "bg-outline-variant" : "bg-primary"}`}
      />

      {/* Company avatar */}
      <Avatar photoKey={cp.photoKey} alt={cp.name} className="size-10 shrink-0 rounded-lg">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${ROLE_AVATAR_GRADIENT[cp.role]} font-headline text-sm font-bold text-on-primary`}
        >
          {initials(cp.company)}
        </div>
      </Avatar>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-headline text-sm font-bold tracking-[-0.01em] text-on-surface">
            {room.title}
          </p>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
            {badge.label}
          </span>
          {room.unread > 0 && (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
              {room.unread}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-on-surface-variant">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Icon name="person" size={13} className="shrink-0" />
            <span className="truncate">
              {cp.name}, {cp.title}
            </span>
          </span>
        </div>
      </div>

      {/* Open pill (visual only — the whole card is the button) */}
      <span className="hidden shrink-0 items-center gap-1 rounded-full border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors group-hover:border-primary/40 group-hover:text-primary sm:inline-flex">
        Open Deal Room
        <Icon name="arrow_forward" size={15} />
      </span>
    </button>
  );
}
