"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";
import { Textarea } from "@/components/ui/Textarea";
import { AsyncState } from "@/components/ui/AsyncState";
import { Loader } from "@/components/common/loader";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { KYC_REVIEW_STATUS_META, StatusPill } from "@/components/dashboard/kyc-status";
import { normalizeValue } from "@/app/dashboard/profile/page";
import { fetchRoleSwitchUserDetails, fetchSwitchedRoleUsers, reviewRoleSwitch } from "@/services/admin.service";
import { profilePhotoKey } from "@/lib/useMyProfilePhoto";
import { fieldLabel, getFieldOptionConfig } from "@/lib/profile-field-options";
import { initials, formatDate, roleLabel } from "@/lib/admin-format";
import { isStaffRole } from "@/lib/roles";
import type { ProfileField } from "@/services/user.service";
import type { KycReviewStatus, RoleSwitchRequest } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const TABS: { value: "all" | Lowercase<KycReviewStatus>; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];
type Tab = (typeof TABS)[number]["value"];

/** Columns whose value is a stored document key rather than text. */
const DOCUMENT_COLUMNS = new Set(["incorporation_certificate", "pitch_deck_certificate"]);
/** Shown as the avatar, so it isn't repeated as a field row. */
const PHOTO_COLUMN = "profile_photo";

/** A field's value as text — option values resolved to their registration labels. */
function displayValue(field: ProfileField): string {
  const cfg = getFieldOptionConfig(field.columnName);
  const toLabel = (v: string) =>
    cfg?.options.find((o) => o.value === v)?.label ?? field.options?.find((o) => o.value === v)?.label ?? v;

  const value = normalizeValue(field);
  return Array.isArray(value) ? value.map(toLabel).join(", ") : value ? toLabel(value) : "";
}

/** One label / value line in the review drawer. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-outline/5 py-2 last:border-b-0">
      <span className="font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className="break-words text-sm text-on-surface">{children}</span>
    </div>
  );
}

/**
 * Role Switch review (admin / super_admin) — the queue of extra roles users have added
 * to their account. The backend lists one row per role for every user holding more than
 * one, so a user appears once per role: their original (`is_default_role`) plus each
 * added role awaiting a decision.
 *
 * Deliberately the same shape as KYC Review (tabs → search → list Card → status pill →
 * row opens a review drawer), and it reuses that page's `StatusPill` +
 * `KYC_REVIEW_STATUS_META` because the backend writes the same Pending/Approved/Rejected
 * values for both flows. Approve/reject live in `RoleSwitchDrawer`, next to the profile
 * the decision is actually about — and stay disabled until that profile is completed.
 */
export default function RoleSwitchReviewPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<RoleSwitchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- Review drawer ----- */
  /** Row open in the review drawer; null = closed. */
  const [selected, setSelected] = useState<RoleSwitchRequest | null>(null);
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  /** Bumped by the drawer's Retry button to re-run the detail fetch. */
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSwitchedRoleUsers()
      .then(setItems)
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading; runs once on mount
    load();
  }, [load]);

  /**
   * The profile behind the open request — one call per opened row.
   *
   * Fetched inside the effect, and every result is gated on a `cancelled` flag scoped
   * to that effect run (the same guard `useFilePreview` uses). Without it, opening row
   * A then row B while A is still in flight lets A's slower response land last and
   * overwrite B's fields: the header would name B while the profile below showed A —
   * and the reviewer would approve or reject against the wrong person's data.
   * Cleanup runs before the next effect, so a late response is dropped, not rendered.
   *
   * Resetting here too (rather than in a second effect) keeps that reset ordered with
   * the fetch it belongs to. `retry` re-runs this for the AsyncState Retry button.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets on open
    setFields([]);
    setReason("");
    setDetailError(null);

    const { userId, companyId, roleId } = selected ?? {};
    if (!userId || !companyId || !roleId) {
      // Closing the drawer cancels any in-flight fetch, whose `finally` is then
      // skipped — clear the flag here so the next open doesn't inherit a stale spinner.
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    fetchRoleSwitchUserDetails({ userId, companyId, roleId })
      .then((data) => {
        if (!cancelled) {
          // Same column can arrive twice (company + user). Keep the last row so
          // email / mobile / country code render once, matching My Profile.
          setFields([...new Map(data.map((f) => [f.columnName, f])).values()]);
        }
      })
      .catch((err: ApiError) => {
        if (!cancelled) setDetailError(err.message ?? "Couldn't load this user's details.");
      })
      .finally(() => {
        // A cancelled run must not clear the loading state its successor just set.
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, retry]);

  const review = async (action: "approve" | "reject") => {
    if (!selected) return;
    if (!selected.isProfileCompleted) {
      toast.error("This user hasn't completed their profile for this role yet.");
      return;
    }
    if (action === "reject" && !reason.trim()) {
      toast.error("Please add a reason for the rejection.");
      return;
    }
    setSubmitting(action);
    try {
      await reviewRoleSwitch(selected.companyUserRoleId, action, reason.trim() || undefined);
      toast.success(
        `${roleLabel(selected.roleCode)} role ${action === "approve" ? "approved" : "rejected"} for ${selected.userName}.`,
      );
      setSelected(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message ?? "Couldn't update the role switch. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      // The original role isn't a switch request — it has nothing to review.
      if (item.isDefaultRole) return false;
      if (tab !== "all" && item.status !== (tab.toUpperCase() as KycReviewStatus)) return false;
      if (!q) return true;
      return (
        item.userName.toLowerCase().includes(q) ||
        (item.email ?? "").toLowerCase().includes(q) ||
        (item.companyName ?? "").toLowerCase().includes(q) ||
        item.roleCode.toLowerCase().includes(q)
      );
    });
  }, [items, tab, search]);

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
          Role Switch
        </h1>
        <p className="mt-1 text-on-surface-variant">Review roles users have added to their account.</p>
      </div>

      {/* Tabs + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-container-high p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.value
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            adornment={<Icon name="search" size={18} />}
          />
        </div>
      </div>

      {/* List */}
      <Card surface="lowest" padding="none" className="overflow-hidden">
        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          isEmpty={filtered.length === 0}
          emptyIcon="swap_horiz"
          emptyText="No role switch requests in this tab."
        >
          <ul className="divide-y divide-outline/5">
            {filtered.map((item) => (
              <li key={item.companyUserRoleId}>
                {/* The whole row opens the review drawer — the decision belongs next
                    to the profile it's about, not on the list. */}
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-container-high/40"
                >
                  <Avatar photoKey={item.photoKey} alt={item.userName} className="size-9 shrink-0 rounded-full">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                      {initials(item.userName)}
                    </div>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">{item.userName}</p>
                    <p className="truncate text-xs text-on-surface-variant">{item.email}</p>
                  </div>

                  <div className="hidden min-w-0 flex-1 text-sm text-on-surface md:block">
                    <p className="truncate">{item.companyName ?? "—"}</p>
                  </div>

                  {/* The role being added, plus whether its extra profile fields are done */}
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold text-on-surface">{roleLabel(item.roleCode)}</p>
                    <p className={`text-xs ${item.isProfileCompleted ? "text-on-surface-variant" : "font-semibold text-error"}`}>
                      {item.isProfileCompleted ? "Profile completed" : "Profile incomplete"}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-xs text-on-surface-variant lg:block">
                    {item.switchedAt ? `Added ${formatDate(item.switchedAt)}` : ""}
                  </div>

                  <StatusPill {...KYC_REVIEW_STATUS_META[item.status]} />

                  <Icon name="chevron_right" size={20} className="shrink-0 text-on-surface-variant" />
                </button>
              </li>
            ))}
          </ul>
        </AsyncState>
      </Card>

      {/*
        Review panel — the shared right-side `Drawer` (same one User Management and
        KYC Review use). The decision lives here, next to the profile it's about:
        opening a row fetches what the user filled in for the role they're asking for.
      */}
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.userName ?? "Role Switch"}
        subtitle={selected?.companyName ?? undefined}
        widthClass="max-w-lg"
        footer={
          selected?.status === "PENDING" ? (
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => review("reject")}
                disabled={submitting !== null || !selected.isProfileCompleted}
                title={!selected.isProfileCompleted ? "Unavailable until the user completes this role's profile." : undefined}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-error/40 px-4 text-sm font-bold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting === "reject" ? <Loader size={16} /> : <Icon name="cancel" size={18} />}
                Reject
              </button>
              <button
                type="button"
                onClick={() => review("approve")}
                disabled={submitting !== null || !selected.isProfileCompleted}
                title={!selected.isProfileCompleted ? "Unavailable until the user completes this role's profile." : undefined}
                className="cta-gradient flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-on-primary transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting === "approve" ? <Loader size={16} /> : <Icon name="task_alt" size={18} />}
                Approve
              </button>
            </div>
          ) : null
        }
      >
        {selected && (
          <>
            {/* Who + what they're asking for */}
            <div className="flex items-center gap-4">
              <Avatar
                // The freshly-fetched photo wins; the list row's key covers the load window.
                photoKey={profilePhotoKey(fields) ?? selected.photoKey}
                alt={selected.userName}
                className="size-14 shrink-0 rounded-full"
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline text-lg font-bold text-on-primary-container">
                  {initials(selected.userName)}
                </div>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-0.5">
                {selected.email && (
                  <p className="flex items-center gap-1.5 truncate text-sm text-on-surface-variant">
                    <Icon name="mail" size={15} />
                    {selected.email}
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <Icon name="swap_horiz" size={15} />
                  Requesting <strong className="text-on-surface">{roleLabel(selected.roleCode)}</strong>
                </p>
              </div>
              <StatusPill {...KYC_REVIEW_STATUS_META[selected.status]} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-on-surface-variant">
              {selected.switchedAt && <span>Added {formatDate(selected.switchedAt)}</span>}
              <span className={selected.isProfileCompleted ? undefined : "font-semibold text-error"}>
                {selected.isProfileCompleted ? "Profile completed" : "Profile incomplete"}
              </span>
            </div>

            {selected.status === "PENDING" && !selected.isProfileCompleted && (
              <div className="mt-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-on-surface">
                Review actions unlock after this user completes their {roleLabel(selected.roleCode)} profile.
              </div>
            )}

            {/* Already-decided rows keep their reason visible. */}
            {selected.status === "REJECTED" && selected.rejectionReason && (
              <div className="mt-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-on-surface">
                <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-error">Rejection reason</p>
                {selected.rejectionReason}
              </div>
            )}

            {/* The profile behind the request */}
            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              {roleLabel(selected.roleCode)} Profile
            </h3>
            <AsyncState
              loading={detailLoading}
              error={detailError}
              onRetry={() => setRetry((n) => n + 1)}
              isEmpty={fields.length === 0}
              emptyIcon="person_off"
              emptyText="No profile details for this role yet."
            >
              <div className="rounded-xl border border-outline/10 px-4 py-1">
                {fields
                  .filter((f) => f.columnName !== PHOTO_COLUMN)
                  .map((field) => {
                    const label = fieldLabel(field.columnName, field.label);
                    const value = displayValue(field);

                    if (DOCUMENT_COLUMNS.has(field.columnName)) {
                      return (
                        <DetailRow key={field.columnName} label={label}>
                          {value ? (
                            <button
                              type="button"
                              onClick={() => setPreviewKey(value)}
                              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                            >
                              <Icon name="visibility" size={16} />
                              View document
                            </button>
                          ) : (
                            <span className="text-outline-variant">Not uploaded</span>
                          )}
                        </DetailRow>
                      );
                    }

                    return (
                      <DetailRow key={field.columnName} label={label}>
                        {value || <span className="text-outline-variant">—</span>}
                      </DetailRow>
                    );
                  })}
              </div>
            </AsyncState>

            {/* Required by the backend on reject; ignored on approve. Hidden while
                the profile is incomplete because neither action can be taken yet. */}
            {selected.status === "PENDING" && selected.isProfileCompleted && (
              <>
                <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Rejection reason
                </h3>
                <Textarea
                  id="role-switch-rejection-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain what needs to change before this role can be approved. Shown to the user."
                />
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Uploaded documents open in the same preview modal KYC Review uses. */}
      <DocumentPreviewModal s3Key={previewKey} onClose={() => setPreviewKey(null)} />
    </div>
  );
}
