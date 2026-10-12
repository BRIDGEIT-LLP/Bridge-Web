"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { ConnectionsList } from "@/components/dashboard/connections/ConnectionsList";
import { ConnectionDetailDrawer } from "@/components/dashboard/connections/ConnectionDetailDrawer";
import { STATUS_FILTER_OPTIONS, type StatusFilter } from "@/lib/connections";
import type {
  ConnectionDirection,
  ConnectionRequest,
  ConnectionStatus,
} from "@/types/api.types";

const DIRECTIONS: { key: ConnectionDirection; label: string; icon: string }[] = [
  { key: "received", label: "Incoming", icon: "inbox" },
  { key: "sent", label: "Sent", icon: "send" },
];

interface ConnectionsScreenProps {
  requests: ConnectionRequest[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  direction: ConnectionDirection;
  onDirectionChange: (d: ConnectionDirection) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  /** Perform an action by setting the new status; resolves on success (drawer then closes). */
  onAction: (id: string, status: ConnectionStatus, reason?: string) => Promise<void>;
  /** Silent read-receipt: mark a received, pending request as Viewed when opened. */
  onView?: (id: string) => void | Promise<void>;
}

/**
 * The whole Connections screen UI — Incoming/Sent toggle + status filter, the
 * request list, and the detail drawer. Data-source agnostic: both the live page
 * and the demo page render this and only differ in how they load data / run actions.
 */
export function ConnectionsScreen({
  requests,
  loading,
  error,
  onRetry,
  direction,
  onDirectionChange,
  status,
  onStatusChange,
  onAction,
  onView,
}: ConnectionsScreenProps) {
  const [selected, setSelected] = useState<ConnectionRequest | null>(null);

  // Open a request; if it's a received, still-pending one, mark it Viewed (read
  // receipt) via the change-status API — optimistically in the drawer too.
  const openRequest = (r: ConnectionRequest) => {
    if (r.direction === "received" && r.status === "PENDING") {
      setSelected({ ...r, status: "VIEWED" });
      void onView?.(r.id);
    } else {
      setSelected(r);
    }
  };

  // Close the drawer on a successful action; errors keep it open (page toasts).
  const handleAction = async (id: string, status: ConnectionStatus, reason?: string) => {
    await onAction(id, status, reason);
    setSelected(null);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-headline text-xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-2xl md:text-3xl">
          Connections
        </h1>
      </div>

      {/* Incoming / Sent toggle + status dropdown (same row) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex shrink-0 gap-1 rounded-xl bg-surface-container-high p-1">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => onDirectionChange(d.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:px-4 ${
                direction === d.key
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name={d.icon} size={17} className="shrink-0" />
              {d.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-56">
          <Select
            aria-label="Filter by status"
            options={STATUS_FILTER_OPTIONS}
            value={status}
            onChange={(v) => onStatusChange(v as StatusFilter)}
            searchable={false}
          />
        </div>
      </div>

      {/* List */}
      <ConnectionsList
        requests={requests}
        status={status}
        onSelect={openRequest}
        loading={loading}
        error={error}
        onRetry={onRetry}
      />

      {/* Detail + actions */}
      <ConnectionDetailDrawer request={selected} onClose={() => setSelected(null)} onAction={handleAction} />
    </div>
  );
}
