"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isUserRole } from "@/lib/roles";
import { DealRoomScreen } from "@/components/dashboard/deal-room/DealRoomScreen";
import { roomInTab } from "@/components/dashboard/deal-room/deal-room-meta";
import { fetchDealRooms } from "@/services/deal-room.service";
import type { DealRoom, DealRoomTab } from "@/components/dashboard/deal-room/types";

/**
 * Deal Rooms — the user's chat workspaces (Active / Closed toggle), API-driven via
 * `deal-room.service` (GET /api/v1/deal-rooms). Renders the shared `DealRoomScreen`.
 * Opening a room routes to the live chat at `/dashboard/deal-room/[dealRoomId]`.
 */
export default function DealRoomPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();
  const [tab, setTab] = useState<DealRoomTab>("ACTIVE");
  const [rooms, setRooms] = useState<DealRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isUserRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  // The backend splits archived vs active rooms server-side, so the Archived tab fetches
  // a different set. Active ↔ Closed share the non-archived set (no refetch between them).
  const isArchivedTab = tab === "ARCHIVED";

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDealRooms(isArchivedTab)
      .then((data) => setRooms(data))
      .catch(() => setError("Couldn't load your deal rooms. Please try again."))
      .finally(() => setLoading(false));
  }, [isArchivedTab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() drives loading state
    if (isLoaded && isUserRole(role)) load();
  }, [isLoaded, role, load]);

  const visible = useMemo(() => rooms.filter((r) => roomInTab(r, tab)), [rooms, tab]);

  if (!isLoaded || !isUserRole(role)) return null;

  return (
    <DealRoomScreen
      rooms={visible}
      loading={loading}
      error={error}
      onRetry={load}
      tab={tab}
      onTabChange={setTab}
      onOpen={(room) => router.push(`/dashboard/deal-room/${room.id}`)}
    />
  );
}
