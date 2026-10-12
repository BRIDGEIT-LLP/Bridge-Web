"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/modal/Modal";
import { Icon } from "@/components/ui/Icon";
import { Loader } from "@/components/common/loader";
import { formatRelativeTime, formatDateTime } from "@/lib/utils";
import { ERROR_MESSAGES } from "@/lib/messages";
import type { ActiveSession } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

interface SessionChooserModalProps {
  open: boolean;
  sessions: ActiveSession[];
  /**
   * Called with the selected session IDs when the user confirms. The parent is
   * responsible for calling the correct portal-scoped revoke endpoint — the modal
   * itself is portal-agnostic. Throw an ApiError to show an inline error message.
   */
  onRevoke: (sessionIds: string[]) => Promise<void>;
  /**
   * Called when the user cancels — the parent should redirect to the login page.
   * Also fires on backdrop-click and Escape (via Modal's onClose).
   */
  onCancel: () => void;
  /**
   * Called after sessions are successfully revoked — the parent should redirect
   * to the dashboard exactly as it would in the normal post-OTP flow.
   */
  onSuccess: () => void;
}

/**
 * Shown when the user has reached the active-session limit after MFA verification.
 * Lists every existing session (the backend always excludes the current one) and
 * requires the user to select ≥ 1 to revoke before they can proceed to the
 * dashboard. Errors from the revoke endpoint are shown inline; the modal stays
 * open so the user can adjust their selection and retry.
 *
 * Portal-agnostic: the parent (VerifyOtpScreen) supplies `onRevoke` with the
 * correct endpoint already baked in, so this component works for user, admin,
 * and superadmin logins without any changes here.
 */
export function SessionChooserModal({
  open,
  sessions,
  onRevoke,
  onCancel,
  onSuccess,
}: SessionChooserModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset selection and inline error every time the modal opens fresh.
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setError(null);
    }
  }, [open]);

  const toggle = (id: string) => {
    // Clear any previous inline error as soon as the selection changes.
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setError(null);
    setRevoking(true);
    try {
      await onRevoke(Array.from(selected));
      onSuccess();
    } catch (err) {
      // Show the backend's message (e.g. "Please select at least 1 device(s) to
      // log out.") directly; fall back to the generic string.
      setError((err as ApiError).message ?? ERROR_MESSAGES.SESSION_REVOKE_FAILED);
    } finally {
      setRevoking(false);
    }
  };

  const footer = (
    <div className="flex w-full items-center gap-3">
      {/* Inline error lives on the left so buttons stay anchored to the right */}
      <div className="flex-1">
        {error && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-error">
            <Icon name="error" size={16} className="shrink-0" />
            {error}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={revoking}
          className="flex h-10 items-center justify-center rounded-xl border border-outline/30 px-5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size === 0 || revoking}
          className="cta-gradient flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {revoking && <Loader size={14} />}
          {revoking
            ? "Logging out…"
            : selected.size > 0
              ? `Log out (${selected.size})`
              : "Log out"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Device Session Limit Reached"
      footer={footer}
      maxWidthClass="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          You&apos;ve reached the maximum number of active sessions. Select one or more sessions
          below to log out, then continue to your dashboard.
        </p>

        {sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-on-surface-variant">
            No active sessions found.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => {
              const isChecked = selected.has(session.id);
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => toggle(session.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    isChecked
                      ? "border-primary bg-primary/5"
                      : "border-outline/20 bg-surface-container-lowest hover:bg-surface-container"
                  }`}
                >
                  {/* Custom checkbox — mirrors the design system's primary colour */}
                  <span
                    className={`mt-[3px] flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      isChecked ? "border-primary bg-primary" : "border-outline/50"
                    }`}
                  >
                    {isChecked && (
                      <Icon name="check" size={12} className="text-on-primary" />
                    )}
                  </span>

                  {/* Session detail rows */}
                  <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
                    {/* Device name */}
                    <div className="flex items-center gap-2">
                      <Icon
                        name={session.deviceName === "Mobile" ? "smartphone" : "devices"}
                        size={18}
                        className="shrink-0 text-primary"
                      />
                      <span className="truncate font-headline text-sm font-bold text-on-surface">
                        {session?.deviceName}
                      </span>
                    </div>

                    {/* Browser · OS  and  IP address */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                        <Icon name="language" size={12} />
                        {session.browser} · {session.os}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                        <Icon name="wifi" size={12} />
                        {session.ipAddress}
                      </span>
                    </div>

                    {/* Last active  and  session started */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                        <Icon name="schedule" size={12} />
                        Active {formatRelativeTime(session.lastActivityAt)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                        <Icon name="calendar_today" size={12} />
                        Started {formatDateTime(session.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
