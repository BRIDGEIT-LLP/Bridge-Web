"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Loader } from "@/components/common/loader";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { ConnectionAvatar } from "@/components/dashboard/connections/ConnectionsList";
import { formatDate } from "@/lib/admin-format";
import { ACTION_TO_STATUS, CONNECTION_STATUS_META, actionOptions, roleLabelFor } from "@/lib/connections";
import type { ConnectionActionType, ConnectionRequest, ConnectionStatus } from "@/types/api.types";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">{children}</h3>;
}

interface ConnectionDetailDrawerProps {
  request: ConnectionRequest | null;
  onClose: () => void;
  /** Perform an action by setting the new status; resolves on success. */
  onAction: (id: string, status: ConnectionStatus, reason?: string) => Promise<void>;
}

/**
 * Right-side drawer showing one connection request's full details (the info sent at
 * request time) plus an action dropdown. Pick an action → Save → `onAction` runs.
 * Declining requires a reason. Presentational + data-source agnostic.
 */
export function ConnectionDetailDrawer({ request, onClose, onAction }: ConnectionDetailDrawerProps) {
  const [action, setAction] = useState<ConnectionActionType | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset the action form whenever a different request opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets on open
    setAction("");
    setReason("");
  }, [request?.id]);

  const options = request ? actionOptions(request.direction, request.status) : [];
  const needsReason = action === "DECLINE";
  const canSave = !!action && (!needsReason || reason.trim().length > 0) && !submitting;

  const save = async () => {
    if (!request || !action) return;
    setSubmitting(true);
    try {
      await onAction(request.id, ACTION_TO_STATUS[action], needsReason ? reason.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const footer =
    options.length > 0 ? (
      <>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center whitespace-nowrap rounded-xl px-4 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container sm:px-5 sm:text-base"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:text-base"
        >
          {submitting ? <Loader size={16} /> : <Icon name="check" size={18} />}
          Save
        </button>
      </>
    ) : null;

  return (
    <Drawer
      open={request !== null}
      onClose={onClose}
      widthClass="max-w-md"
      footer={footer}
    >
      {request && (
        <>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <ConnectionAvatar name={request.name} role={request.role} size={48} photoKey={request.photoKey} />
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate font-headline text-base font-bold text-on-surface">{request.name}</p>
              <p className="truncate text-sm text-on-surface-variant">
                {roleLabelFor(request.role)} · {request.company}
              </p>
            </div>
            <StatusPill {...CONNECTION_STATUS_META[request.status]} />
          </div>

          {/* Request details (what was sent) */}
          <SectionTitle>Request Details</SectionTitle>
          <div className="space-y-3 rounded-xl border border-outline/10 bg-surface-container-low p-3 sm:p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">Purpose / Intent</p>
              <p className="mt-1 flex min-w-0 items-start gap-1.5 text-sm font-semibold text-on-surface">
                <Icon name="bolt" size={15} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0 break-words">{request.intent}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">Product / Service Details</p>
              {request.productServiceDetails ? (
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{request.productServiceDetails}</p>
              ) : (
                <p className="mt-1 text-sm italic text-on-surface-variant/70">Not provided.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">Message</p>
              {request.message ? (
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">“{request.message}”</p>
              ) : (
                <p className="mt-1 text-sm italic text-on-surface-variant/70">No message included.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-outline/10 pt-3 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1">
                <Icon name={request.direction === "received" ? "call_received" : "call_made"} size={14} className="shrink-0" />
                {request.direction === "received" ? "Received" : "Sent"}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="calendar_today" size={14} className="shrink-0" />
                {formatDate(request.createdAt)}
              </span>
            </div>
          </div>

          {/* Action */}
          <SectionTitle>Take Action</SectionTitle>
          {options.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant/40 px-4 py-6 text-center text-sm text-on-surface-variant">
              No actions available for a {CONNECTION_STATUS_META[request.status].label.toLowerCase()} request.
            </p>
          ) : (
            <div className="space-y-3">
              <Select
                label="Action"
                placeholder="Select an action…"
                options={options}
                value={action}
                onChange={(v) => setAction(v as ConnectionActionType)}
                searchable={false}
              />
              {needsReason && (
                <Textarea
                  label="Reason for declining"
                  required
                  rows={3}
                  placeholder="Add a reason for declining…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
