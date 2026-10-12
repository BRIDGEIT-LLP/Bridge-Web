"use client";

import { AsyncState } from "@/components/ui/AsyncState";
import { DealRoomListCard } from "./DealRoomListCard";
import type { DealRoom } from "./types";

interface DealRoomListProps {
  rooms: DealRoom[];
  onOpen: (room: DealRoom) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/** List of deal rooms with shared loading / error / empty states. */
export function DealRoomList({ rooms, onOpen, loading, error, onRetry }: DealRoomListProps) {
  return (
    <AsyncState
      loading={!!loading}
      error={error ?? null}
      isEmpty={rooms.length === 0}
      emptyIcon="handshake"
      emptyText="No deal rooms here yet."
      onRetry={onRetry}
    >
      <div className="flex flex-col gap-2">
        {rooms.map((room) => (
          <DealRoomListCard key={room.id} room={room} onOpen={onOpen} />
        ))}
      </div>
    </AsyncState>
  );
}
