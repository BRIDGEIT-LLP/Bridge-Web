"use client";

import { useState, useEffect, useCallback } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, initials } from "@/lib/admin-format";
import { KYC_STATUS_META, StatusPill, USER_STATUS_META, VERIFY_META } from "@/components/dashboard/kyc-status";
import { fetchUserDetail, fetchUserLimitConfig, updateUserLimitConfig } from "@/services/admin.service";
import { toRoleCode } from "@/lib/roles";
import type { AdminUserDetail, AdminUserListItem, UpdateUserLimitConfigPayload } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/* -------------------------------------------------------------------------- */
/*  Helper components                                                          */
/* -------------------------------------------------------------------------- */

/** One label/value row inside a detail drawer. Also used by AdminDetailDrawer. */
export function Field({ icon, label, value }: { icon: string; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-on-surface-variant" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">{label}</p>
        <p className="break-words text-sm font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

/** Render a role-detail field's value as text; arrays join with a comma. */
function formatFieldValue(value: string | number | boolean | string[] | null): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (Array.isArray(value)) return value.length ? value.join(", ") : undefined;
  return String(value);
}

/** A "<thing> — Verified/Pending" row reusing the shared StatusPill. */
function VerifyRow({ icon, label, verified }: { icon: string; label: string; verified: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
        <Icon name={icon} size={18} className="text-on-surface-variant" />
        {label}
      </span>
      <StatusPill {...(verified ? VERIFY_META.VERIFIED : VERIFY_META.UNVERIFIED)} />
    </div>
  );
}

/** One suspend/reactivate entry inside the Suspension History timeline. */
function SuspensionEntry({ entry, isCurrent }: { entry: AdminUserDetail["suspensionHistory"][number]; isCurrent?: boolean }) {
  const suspended = entry.lastAction === "suspended";
  return (
    <div className="relative pb-4 last:pb-0">
      <span
        className={`absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border-2 border-surface-container-lowest ${
          suspended ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"
        }`}
      >
        <Icon name={suspended ? "block" : "restart_alt"} size={13} />
      </span>
      <div className={`rounded-xl bg-surface-container-low p-3 ${isCurrent ? "outline outline-2 outline-error/35" : ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={`text-sm font-bold ${suspended ? "text-error" : "text-primary"}`}>
            {suspended ? "Suspended" : "Reactivated"}
            {isCurrent && (
              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-error">· current</span>
            )}
          </span>
          {entry.actionAt && (
            <span className="whitespace-nowrap text-xs font-medium text-on-surface-variant">
              {formatDate(entry.actionAt)}
            </span>
          )}
        </div>
        {entry.reason && <p className="mt-1.5 text-sm text-on-surface-variant">{entry.reason}</p>}
        {entry.isLockedBySuperAdmin && (
          <p className="mt-1.5 text-xs font-medium text-on-surface-variant">
            Set by a super admin — only a super admin can change this.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Suspension History section: the current entry is always visible; earlier
 * entries stay collapsed behind a toggle so a long history doesn't dominate
 * the drawer. Renders nothing if the user has no suspension history at all.
 */
function SuspensionHistorySection({ suspensionHistory }: { suspensionHistory: AdminUserDetail["suspensionHistory"] }) {
  const [expanded, setExpanded] = useState(false);
  if (suspensionHistory.length === 0) return null;

  const [current, ...earlier] = suspensionHistory;

  return (
    <>
      <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        Suspension History
      </h3>
      <div className="relative pl-6 mx-[-6px] before:absolute before:inset-y-1.5 before:left-[9px] before:w-px before:bg-outline-variant/50">
        <SuspensionEntry entry={current} isCurrent />

        {earlier.length > 0 && (
          <div className="relative pb-4 last:pb-0">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="group flex w-full items-center gap-2.5 rounded-lg py-0.5 text-left"
            >
              <span className="absolute -left-6 top-0 flex size-5 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-surface-container-high text-on-surface-variant transition-colors group-hover:bg-primary-container group-hover:text-on-primary-container">
                <Icon
                  name="expand_more"
                  size={15}
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </span>
              <span className="text-sm font-bold text-on-surface-variant transition-colors group-hover:text-primary">
                {expanded ? "Hide earlier history" : `${earlier.length} earlier ${earlier.length === 1 ? "action" : "actions"}`}
              </span>
            </button>

            {expanded && <div className="mt-3">{earlier.map((entry, i) => <SuspensionEntry key={i} entry={entry} />)}</div>}
          </div>
        )}
      </div>
    </>
  );
}

/** Labeled number input for the limit config section. */
function LimitInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-container-low px-3 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-on-surface-variant">{label}</p>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder="0"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface LimitFields {
  allowed_connections: string;
  allowed_free_trial_days: string;
  allowed_premium_days: string;
}

const LIMIT_EMPTY: LimitFields = {
  allowed_connections: "",
  allowed_free_trial_days: "",
  allowed_premium_days: "",
};

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Right-side drawer showing one user's full profile + their configurable connection
 * limits. `user` (the list row) only supplies which user was clicked and the
 * userId/companyId/role needed to fetch GET /admin/users/:userId — every displayed
 * profile field (name, email, phone, company, KYC/verification, role-specific
 * fields, suspension history) is rendered from that fetch's response, not from the
 * list row, so it always reflects the single-user endpoint rather than the list.
 * The limit config section is unrelated and still fetches from
 * /admin/users/:userId/limit-config when the drawer opens.
 */
export function UserDetailDrawer({ user, onClose }: { user: AdminUserListItem | null; onClose: () => void }) {
  // ── Role details + suspension history ─────────────────────────────────────
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch role-shaped fields + latest suspension reason whenever the selected user
  // changes. companyId + role come from the list row already loaded on the page.
  useEffect(() => {
    if (!user?.userId || !user?.companyId || !user?.role) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale detail when the selected user changes/clears
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    fetchUserDetail(user.userId, user.companyId, toRoleCode(user.role))
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setDetailError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.companyId, user?.role]);

  const detailName = detail
    ? [detail.firstName, detail.lastName].filter(Boolean).join(" ").trim() ||
      detail.companyName ||
      detail.email ||
      "—"
    : "";
  const detailPhone = detail
    ? `${detail.countryCode ? `${detail.countryCode} ` : ""}${detail.mobileNumber ?? ""}`.trim()
    : "";

  // ── Limit config state ────────────────────────────────────────────────────
  const [limits, setLimits] = useState<LimitFields>(LIMIT_EMPTY);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitSuccess, setLimitSuccess] = useState(false);

  // Fetch limit config whenever the selected user changes.
  useEffect(() => {
    if (!user?.userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale limit config when the selected user changes/clears
      setLimits(LIMIT_EMPTY);
      setHasSubscription(false);
      setLimitError(null);
      setLimitSuccess(false);
      return;
    }
    let cancelled = false;
    setLimitLoading(true);
    setLimitError(null);
    setLimitSuccess(false);
    fetchUserLimitConfig(user.userId)
      .then((config) => {
        if (cancelled) return;
        setHasSubscription(!!config.has_subscription);
        setLimits({
          allowed_connections: config.allowed_connections != null ? String(config.allowed_connections) : "",
          allowed_free_trial_days: config.allowed_free_trial_days != null ? String(config.allowed_free_trial_days) : "",
          allowed_premium_days: config.allowed_premium_days != null ? String(config.allowed_premium_days) : "",
        });
      })
      .catch((err: ApiError) => {
        if (!cancelled) setLimitError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLimitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.userId]);

  // Auto-clear the success message after 3 seconds.
  useEffect(() => {
    if (!limitSuccess) return;
    const t = setTimeout(() => setLimitSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [limitSuccess]);

  const handleLimitChange = (field: keyof LimitFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLimits((prev) => ({ ...prev, [field]: e.target.value }));
    setLimitError(null);
    setLimitSuccess(false);
  };

  const handleSaveLimits = useCallback(async () => {
    if (!user?.userId) return;
    // Only the fields shown for this user are sent, so the hidden ones aren't overwritten.
    const raw = hasSubscription
      ? [limits.allowed_premium_days]
      : [limits.allowed_connections, limits.allowed_free_trial_days];
    if (raw.some((v) => v.trim() === "")) {
      setLimitError("All values are required.");
      return;
    }
    const payload: UpdateUserLimitConfigPayload = hasSubscription
      ? { allowed_premium_days: Number(limits.allowed_premium_days) }
      : {
          allowed_connections: Number(limits.allowed_connections),
          allowed_free_trial_days: Number(limits.allowed_free_trial_days),
        };
    if (Object.values(payload).some((v) => isNaN(v) || v < 0 || !Number.isInteger(v))) {
      setLimitError("All values must be non-negative whole numbers.");
      return;
    }
    setLimitSaving(true);
    setLimitError(null);
    try {
      await updateUserLimitConfig(user.userId, payload);
      setLimitSuccess(true);
    } catch (err: unknown) {
      setLimitError((err as ApiError).message ?? "Failed to save limits.");
    } finally {
      setLimitSaving(false);
    }
  }, [user, limits, hasSubscription]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Drawer
      open={user !== null}
      onClose={onClose}
      title={user?.name ?? "User profile"}
      subtitle={user?.companyName}
      footer={null}
    >
      {user && (
        <>
          {/* Profile — sourced entirely from GET /admin/users/:userId, not the list row. */}
          {detailLoading && !detail ? (
            <>
              <div className="flex items-center gap-4 pb-4">
                <div className="size-14 shrink-0 animate-pulse rounded-full bg-surface-container-low" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded bg-surface-container-low" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-surface-container-low" />
                </div>
              </div>
              <div className="space-y-2 border-t border-outline/10 pt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-container-low" />
                ))}
              </div>
            </>
          ) : detailError && !detail ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Icon name="error" size={28} className="text-error" />
              <p className="text-sm font-medium text-on-surface-variant">{detailError}</p>
            </div>
          ) : detail ? (
            <>
              {/* Identity header */}
              <div className="flex items-center gap-4 pb-4">
                <Avatar photoKey={detail.profilePhoto} alt={detailName} className="size-14 shrink-0 rounded-full">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline text-lg font-bold text-on-primary-container">
                    {initials(detailName)}
                  </div>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-headline text-lg font-bold text-on-surface">{detailName}</p>
                  {detail.roleName && (
                    <p className="truncate text-xs text-on-surface-variant">{detail.roleName}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusPill {...KYC_STATUS_META[detail.kycStatus]} />
                    <StatusPill {...USER_STATUS_META[detail.suspension.isSuspended ? "SUSPENDED" : "ACTIVE"]} />
                  </div>
                </div>
              </div>

              <div className="divide-y divide-outline/10 border-t border-outline/10">
                <Field icon="mail" label="Email" value={detail.email} />
                <Field icon="call" label="Phone" value={detailPhone || undefined} />
                <Field icon="corporate_fare" label="Company" value={detail.companyName} />
              </div>

              {/* Verification summary */}
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                Verification
              </h3>
              <div className="space-y-2">
                <VerifyRow icon="mail" label="Email" verified={detail.emailVerified} />
                <VerifyRow icon="call" label="Mobile" verified={detail.mobileVerified} />
                <VerifyRow icon="verified_user" label="KYC" verified={detail.kycStatus === "VERIFIED"} />
              </div>

              {/* Role Details — fields resolved server-side for this user's role. */}
              {detail.fields.length > 0 && (
                <>
                  <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    {detail.roleName ?? "Role"} Details
                  </h3>
                  <div className="divide-y divide-outline/10 border-t border-outline/10">
                    {detail.fields.map((f) => (
                      <Field key={f.fieldName} icon="list_alt" label={f.label} value={formatFieldValue(f.value)} />
                    ))}
                  </div>
                </>
              )}

              {/* Suspension / reactivation history — only shown once the user has at
                  least one entry in user_suspension_history. */}
              <SuspensionHistorySection suspensionHistory={detail.suspensionHistory} />
            </>
          ) : null}

          {/* Connection Limits */}
          <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            {hasSubscription ? "Premium Config" : "Free Trial Config"}
          </h3>

          {limitLoading ? (
            // Skeleton placeholders while the config loads.
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container-low" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Subscribers get premium days; everyone else gets connections + trial days. */}
              {hasSubscription ? (
                <LimitInput
                  label="Premium Days"
                  value={limits.allowed_premium_days}
                  onChange={handleLimitChange("allowed_premium_days")}
                  disabled={limitSaving}
                />
              ) : (
                <>
                  <LimitInput
                    label="Connections Allowed"
                    value={limits.allowed_connections}
                    onChange={handleLimitChange("allowed_connections")}
                    disabled={limitSaving}
                  />
                  <LimitInput
                    label="Free Trial Days"
                    value={limits.allowed_free_trial_days}
                    onChange={handleLimitChange("allowed_free_trial_days")}
                    disabled={limitSaving}
                  />
                </>
              )}

              {limitError && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-error">
                  <Icon name="error" size={14} />
                  {limitError}
                </p>
              )}

              {limitSuccess && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Icon name="check_circle" size={14} />
                  Limits saved successfully.
                </p>
              )}

              <button
                type="button"
                onClick={handleSaveLimits}
                disabled={limitSaving || !user.userId}
                className="mt-1 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {limitSaving ? "Saving…" : "Save Limits"}
              </button>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
