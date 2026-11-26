"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { isUserRole } from "@/lib/roles";
import { ConnectionsScreen } from "@/components/dashboard/connections/ConnectionsScreen";
import { fetchConnections, actOnConnection } from "@/services/connections.service";
import type { ConnectionRequest, ConnectionStatus } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/**
 * Connections — the user's received/sent requests (plus a History of resolved ones),
 * with inline + drawer actions (accept / decline for received, withdraw for sent). Data + actions are API-driven via `connections.service`.
 */
export default function ConnectionsPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isUserRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    // Both directions are loaded up-front: the Received / Sent / History tabs (and their
    // counts) are derived client-side by the screen.
    Promise.all([fetchConnections("received"), fetchConnections("sent")])
      .then(([received, sent]) => setRequests([...received, ...sent]))
      .catch(() => setError("Couldn't load your connection requests. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() drives loading state
    if (isLoaded && isUserRole(role)) load();
  }, [isLoaded, role, load]);

  if (!isLoaded || !isUserRole(role)) return null;

  /**
   * Update one row in place. A status change affects exactly one request, so refetching
   * the whole list for it is a wasted round-trip (and made the list flicker behind the
   * open drawer). Mirrors the `patchAdmin` pattern in admin-management.
   */
  const patchRequest = (id: string, status: ConnectionStatus, declineReason?: string) =>
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, ...(declineReason ? { declineReason } : {}) } : r)),
    );

  const handleAction = async (id: string, status: ConnectionStatus, reason?: string) => {
    try {
      const res = await actOnConnection(id, status, reason);
      toast.success(res.message ?? "Action completed.");

      const dealRoomId = res.data?.deal_room_id;
      if (status === "ACCEPTED" && dealRoomId) {
        router.push(`/dashboard/deal-room/${dealRoomId}`);
        return; // navigating away — no need to update the list
      }

      patchRequest(id, status, status === "DECLINED" ? reason : undefined);
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't complete the action. Please try again.");
      throw err; // keep the drawer/modal open on failure
    }
  };

  // Read receipt — mark a received, pending request as Viewed on open (silent).
  const handleView = async (id: string) => {
    try {
      await actOnConnection(id, "VIEWED");
      patchRequest(id, "VIEWED");
    } catch {
      /* silent — a failed read receipt shouldn't interrupt the user */
    }
  };

  return (
    <ConnectionsScreen
      requests={requests}
      loading={loading}
      error={error}
      onRetry={load}
      onAction={handleAction}
      onView={handleView}
    />
  );
}
