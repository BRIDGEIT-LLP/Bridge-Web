"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/modal/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/Select";
import { AsyncState } from "@/components/ui/AsyncState";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserDetailDrawer } from "@/components/dashboard/UserDetailDrawer";
import { TablePager } from "@/components/dashboard/TablePager";
import { MemberStatusPill } from "@/components/dashboard/members/MemberStatusPill";
import { fetchUsers, setUserSuspension } from "@/services/admin.service";
import { formatDate, initials } from "@/lib/admin-format";
import { isStaffRole, ROLE_META, USER_ROLES } from "@/lib/roles";
import type { AdminUserListItem } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const PAGE_SIZE = 10;

/** Table headers per Bridge_App_Design.pdf S50. `className` carries per-column alignment. */
const COLUMNS: { label: string; className?: string }[] = [
  { label: "Member", className: "pl-8" },
  { label: "Role" },
  { label: "City" },
  { label: "Status" },
  { label: "Profile" },
  { label: "Joined" },
  { label: "", className: "pr-8 text-right" },
];

/**
 * Startup / Investor / B2B Enterprise — derived from `USER_ROLES` + `ROLE_META` rather than
 * spelled out, so a role added or relabelled in `lib/roles.ts` shows up here automatically.
 */
const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  ...USER_ROLES.map((r) => ({ value: r, label: ROLE_META[r].label })),
];

/**
 * Admin-only Members directory (FRD §12.5, S50) — replaces the old User Management
 * screen (same precedent as Verification Queue replacing KYC Review). "Profile" is a
 * stubbed "—" for now: nothing in the product computes a profile-completion
 * percentage yet, so it's left as a placeholder until that's built. "Status" is a
 * best-effort map of the user's latest subscription row (see `toMemberStatus` in
 * admin.service.ts) since billing doesn't yet have real trial/payment-failure states.
 */
export default function MembersPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUserListItem | null>(null);

  // Suspend / reactivate confirmation — same shape as Admin Management's dialog.
  const [confirming, setConfirming] = useState<AdminUserListItem | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  // Staff-only — covers direct URL access (sidebar already hides for others).
  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchUsers()
      .then((res) => setUsers(res.data))
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading; runs once on mount
    load();
  }, [load]);

  // The backend returns the whole list (no pagination), so filter + page here.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.companyName ?? "").toLowerCase().includes(q) ||
        (u.mobileNumber ?? "").includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);

  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const onRole = (v: string) => {
    setRoleFilter(v);
    setPage(1);
  };

  const openConfirm = (user: AdminUserListItem) => {
    setConfirming(user);
    setReason("");
    setReasonError("");
  };

  const closeConfirm = () => {
    setConfirming(null);
    setReason("");
    setReasonError("");
  };

  /** Suspend / reactivate, confirmed through the dialog below. Also usable from the detail drawer. */
  const handleToggleSuspension = async () => {
    if (!confirming?.userId) return;
    const suspending = !confirming.suspended;

    // The backend only *requires* a reason when suspending, but it records one on the
    // suspension history row either way — so ask for it on both paths.
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(
        suspending
          ? "Give a reason for suspending this user."
          : "Give a reason for reactivating this user."
      );
      return;
    }

    setStatusSaving(true);
    try {
      await setUserSuspension({
        userId: confirming.userId,
        companyId: confirming.companyId,
        isSuspended: suspending,
        suspensionReason: trimmed,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === confirming.id ? { ...u, suspended: suspending } : u))
      );
      toast.success(
        suspending ? `${confirming.name} was suspended.` : `${confirming.name} was reactivated.`
      );
      closeConfirm();
      setSelected(null);
    } catch (err) {
      toast.error((err as ApiError).message || "Couldn't update the user. Please try again.");
    } finally {
      setStatusSaving(false);
    }
  };

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header — no subtitle here per the design (S50). */}
      <div className="mb-6">
        <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
          Members
        </h1>
      </div>

      {/* Filters + table — one card, so the filter row reads as this table's toolbar
          rather than as a separate panel floating above it. No `overflow-hidden` here:
          it would clip the dropdown's popover. */}
      <Card surface="lowest" padding="none">
        <div className="border-b border-outline/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Search members"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                adornment={<Icon name="search" size={18} />}
              />
            </div>
            <div className="shrink-0 sm:w-44">
              <Select aria-label="Member role" options={ROLE_OPTIONS} value={roleFilter} onChange={onRole} placeholder="All roles" />
            </div>
          </div>
        </div>

        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          isEmpty={total === 0}
          emptyIcon="group_off"
          emptyText="No members match these filters."
        >
          {/* No fixed height here — at most PAGE_SIZE rows are ever rendered (paginated
              below), so the table should size to its content, not scroll internally. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      className={`border-b border-outline/10 bg-surface-container-lowest px-5 py-3 text-sm font-bold text-on-surface-variant ${col.className ?? ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => (
                  <tr
                    key={u.id}
                    className="group transition-colors last:[&>td]:border-0 hover:bg-surface-container-low [&>td]:border-b [&>td]:border-outline/5"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar photoKey={u.photoKey} alt={u.name} className="size-9 shrink-0 rounded-full">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                            {initials(u.name)}
                          </div>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">{u.name}</p>
                          <p className="truncate text-xs text-on-surface-variant">{u.companyName ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">
                      {u.role ? ROLE_META[u.role].label : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{u.city ?? "—"}</td>
                    <td className="px-5 py-4">
                      <MemberStatusPill status={u.memberStatus} />
                    </td>
                    {/* Stubbed until profile-completion % is actually computed. */}
                    <td className="px-5 py-4 text-sm text-on-surface-variant">—</td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">{formatDate(u.joinedAt ?? undefined)}</td>
                    <td className="py-4 pl-5 pr-8 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(u)}
                        className="rounded-lg px-3 py-1.5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePager
            page={safePage}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={total}
            noun="members"
            onPage={setPage}
          />
        </AsyncState>
      </Card>

      <UserDetailDrawer
        user={selected}
        onClose={() => setSelected(null)}
        onToggleSuspension={selected?.userId ? () => openConfirm(selected) : undefined}
      />

      {/* Suspend / reactivate confirmation — same dialog shape as Admin Management. */}
      <Modal
        open={confirming !== null}
        onClose={closeConfirm}
        title={confirming?.suspended ? "Reactivate user?" : "Suspend user?"}
        maxWidthClass="max-w-md"
        bodyClassName="p-6"
        footer={
          <>
            <button
              type="button"
              onClick={closeConfirm}
              disabled={statusSaving}
              className="flex h-11 items-center rounded-xl px-5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleToggleSuspension}
              disabled={statusSaving}
              className={`flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold transition-colors disabled:opacity-50 ${
                confirming?.suspended
                  ? "bg-primary text-on-primary hover:bg-primary-dim"
                  : "bg-error text-on-error hover:bg-error/90"
              }`}
            >
              {statusSaving ? "Saving…" : confirming?.suspended ? "Reactivate" : "Suspend"}
            </button>
          </>
        }
      >
        {confirming && (
          <div className="space-y-5">
            {/* Name the user explicitly — the action is triggered from a small row icon. */}
            <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                {initials(confirming.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">{confirming.name}</p>
                <p className="truncate text-xs text-on-surface-variant">{confirming.email}</p>
              </div>
              {confirming.role && (
                <span className="ml-auto shrink-0 rounded bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                  {ROLE_META[confirming.role].label}
                </span>
              )}
            </div>

            <p className="text-sm text-on-surface-variant">
              {confirming.suspended
                ? "They will regain access to the platform immediately."
                : "They will lose access to the platform immediately. You can reactivate them later."}
            </p>

            {/* Asked for on both paths — it lands on the suspension history either way. */}
            <Textarea
              id="member-suspension-reason"
              label={confirming.suspended ? "Reason for reactivation" : "Reason for suspension"}
              required
              rows={3}
              placeholder={
                confirming.suspended
                  ? "e.g. Appeal upheld — account restored after review."
                  : "e.g. Repeated policy violations reported by two counterparties."
              }
              value={reason}
              error={reasonError}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError("");
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
