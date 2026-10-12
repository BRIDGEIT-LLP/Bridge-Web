"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AsyncState } from "@/components/ui/AsyncState";
import { Modal } from "@/components/modal/Modal";
import { useAuth } from "@/components/auth/AuthProvider";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { TablePager } from "@/components/dashboard/TablePager";
import { RowAction } from "@/components/dashboard/RowAction";
import {
  ADMIN_MODULES,
  ADMIN_STATUS_META,
  AdminDetailDrawer,
  CreateAdminModal,
  roleProfileLabel,
} from "@/components/dashboard/admin-management/AdminDialogs";
import { deleteAdmin, fetchAdmins, setAdminStatus } from "@/services/admin.service";
import { formatDate, initials, timeAgo } from "@/lib/admin-format";
import { downloadCsv, type CsvColumn } from "@/lib/export-csv";
import { isSuperAdmin } from "@/lib/roles";
import type { AdminAccount } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
];

/**
 * Table headers. `className` carries the per-column alignment overrides so the header row
 * lines up with its cells — "Admin Name" is nudged in off the avatar's left edge, and
 * "Actions" is right-aligned over the right-aligned icon buttons.
 */
const COLUMNS: { label: string; className?: string }[] = [
  { label: "Admin Name", className: "pl-8" },
  { label: "Role" },
  { label: "Created Date" },
  { label: "Last Login" },
  { label: "Perms", className: "text-center" },
  { label: "Status" },
  { label: "Actions", className: "pr-8 text-right" },
];

/**
 * The exported spreadsheet's columns. Wider than the on-screen table on purpose — an
 * export is the place for the fields the table has no room for (phone, permission names,
 * created-by), so add new ones here rather than to `COLUMNS`.
 */
const EXPORT_COLUMNS: CsvColumn<AdminAccount>[] = [
  { header: "Name", value: (a) => a.name },
  { header: "Email", value: (a) => a.email },
  {
    header: "Mobile",
    value: (a) => (a.mobileNumber ? `${a.countryCode ? `${a.countryCode} ` : ""}${a.mobileNumber}` : ""),
  },
  { header: "Role", value: (a) => (a.role === "super_admin" ? "Super Admin" : "Admin") },
  { header: "Role Profile", value: (a) => roleProfileLabel(a.roleProfile) ?? "" },
  {
    header: "Permissions",
    // Super admins hold every module implicitly, so their `permissions` array is empty.
    value: (a) =>
      a.role === "super_admin"
        ? "All"
        : a.permissions.map((key) => ADMIN_MODULES.find((m) => m.key === key)?.label ?? key).join("; "),
  },
  { header: "Status", value: (a) => ADMIN_STATUS_META[a.status].label },
  { header: "Created Date", value: (a) => (a.createdAt ? formatDate(a.createdAt) : "") },
  { header: "Last Login", value: (a) => (a.lastLoginAt ? formatDate(a.lastLoginAt) : "Never") },
];

export default function AdminManagementPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One piece of state per dialog — only one is ever open at a time.
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<AdminAccount | null>(null);
  const [confirming, setConfirming] = useState<AdminAccount | null>(null);
  /** Which destructive action the confirm dialog is for. */
  const [confirmAction, setConfirmAction] = useState<"status" | "delete">("status");
  const [statusSaving, setStatusSaving] = useState(false);
  /** Reason for the status change — required by BOTH the suspend and activate endpoints. */
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  // Super-admin only — covers direct URL access (the sidebar already hides it for others).
  useEffect(() => {
    if (isLoaded && !isSuperAdmin(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAdmins()
      .then(setAdmins)
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
    return admins.filter((a) => {
      if (roleFilter && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (roleProfileLabel(a.roleProfile) ?? "").toLowerCase().includes(q)
      );
    });
  }, [admins, search, roleFilter]);

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

  /** Patch one row in place after a dialog saves, so the table doesn't need a refetch. */
  const patchAdmin = useCallback((id: string, changes: Partial<AdminAccount>) => {
    setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }, []);

  /**
   * Export the roster. Exports the **whole** list, not the current page — but honours the
   * search / role filters, so what you filtered to is what you get.
   */
  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("There's nothing to export.");
      return;
    }
    downloadCsv("admins", EXPORT_COLUMNS, filtered);
    toast.success(`Exported ${filtered.length} administrator${filtered.length === 1 ? "" : "s"}.`);
  };

  /** Open the confirm dialog for one action, on a fresh reason field. */
  const openConfirm = (admin: AdminAccount, action: "status" | "delete") => {
    setConfirming(admin);
    setConfirmAction(action);
    setReason("");
    setReasonError("");
  };

  const closeConfirm = () => {
    setConfirming(null);
    setReason("");
    setReasonError("");
  };

  /**
   * Suspend / reactivate / delete — all three take the same confirm dialog because all
   * three endpoints require a 5–500 character reason and record it on the audit trail.
   */
  const handleConfirm = async () => {
    if (!confirming) return;

    // Validate to the server's rule so a short note fails here with a clear message
    // instead of coming back as a 400.
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setReasonError("Give a reason of at least 5 characters.");
      return;
    }
    if (trimmed.length > 500) {
      setReasonError("Keep the reason under 500 characters.");
      return;
    }

    const deleting = confirmAction === "delete";
    const next = confirming.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    setStatusSaving(true);
    try {
      if (deleting) {
        await deleteAdmin(confirming.id, trimmed);
        // Soft-deleted server-side; the list filters `is_deleted`, so drop the row.
        setAdmins((prev) => prev.filter((a) => a.id !== confirming.id));
        toast.success(`${confirming.name} was deleted.`);
      } else {
        await setAdminStatus(confirming.id, next, trimmed);
        patchAdmin(confirming.id, { status: next });
        toast.success(
          next === "SUSPENDED" ? `${confirming.name} was suspended.` : `${confirming.name} was reactivated.`
        );
      }
      closeConfirm();
    } catch (err) {
      toast.error((err as ApiError).message || "Couldn't update the admin. Please try again.");
    } finally {
      setStatusSaving(false);
    }
  };

  if (!isLoaded || !isSuperAdmin(role)) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
            Admin Management
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Manage the team that runs the platform and what each member can reach.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            leadingIcon="download"
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
          >
            Export
          </Button>
          <Button variant="primary" leadingIcon="add" onClick={() => setCreating(true)}>
            Create New Admin
          </Button>
        </div>
      </div>

      {/* Filters + table — one card, so the filter row reads as this table's toolbar
          rather than as a separate panel floating above it. No `overflow-hidden` here:
          it would clip the role dropdown's popover. */}
      <Card surface="lowest" padding="none">
        <div className="border-b border-outline/10 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="Search by name, email, role profile…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              adornment={<Icon name="search" size={18} />}
            />
            <div className="sm:w-52">
              <Select aria-label="Role" options={ROLE_OPTIONS} value={roleFilter} onChange={onRole} placeholder="All Roles" />
            </div>
          </div>
        </div>

        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          isEmpty={total === 0}
          emptyIcon="admin_panel_settings"
          emptyText="No administrators match these filters."
        >
          {/* Same fixed viewport as User Management: exactly PAGE_SIZE rows (header 41px +
              10 × 69px), so the card keeps its height on a short last page and the rows —
              not the header — scroll. `border-separate` (not `collapse`) is required for the
              sticky header to keep its bottom rule; row rules therefore live on the `td`s. */}
          <div className="h-[500px] overflow-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      className={`sticky top-0 z-10 border-b border-outline/10 bg-surface-container-lowest px-5 py-3 text-xs font-bold uppercase tracking-wide text-on-surface-variant ${col.className ?? ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => (
                  <tr
                    key={a.id}
                    className="group transition-colors last:[&>td]:border-0 hover:bg-surface-container-low [&>td]:border-b [&>td]:border-outline/5"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                          {initials(a.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">{a.name}</p>
                          <p className="truncate text-xs text-on-surface-variant">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                        {a.role === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">
                      {a.createdAt ? formatDate(a.createdAt) : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface-variant">
                      {a.lastLoginAt ? timeAgo(a.lastLoginAt) : "—"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-secondary-container">
                        {a.role === "super_admin" ? "All" : a.permissions.length}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill {...ADMIN_STATUS_META[a.status]} />
                    </td>
                    <td className="py-4 pl-5 pr-8">
                      <div className="flex items-center justify-end gap-1">
                        <RowAction icon="visibility" label={`View ${a.name}`} title="View Details" onClick={() => setViewing(a)} />
                        <RowAction
                          icon={a.status === "ACTIVE" ? "block" : "restart_alt"}
                          label={`${a.status === "ACTIVE" ? "Suspend" : "Reactivate"} ${a.name}`}
                          title={a.status === "ACTIVE" ? "Suspend Admin" : "Reactivate Admin"}
                          danger={a.status === "ACTIVE"}
                          onClick={() => openConfirm(a, "status")}
                        />
                        {/* Permissions moved into the detail drawer's edit mode; this slot
                            is the delete action now. */}
                        <RowAction
                          icon="delete"
                          label={`Delete ${a.name}`}
                          title="Delete Admin"
                          danger
                          onClick={() => openConfirm(a, "delete")}
                        />
                      </div>
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
            noun="administrators"
            onPage={setPage}
          />
        </AsyncState>
      </Card>

      {/* Dialogs */}
      <CreateAdminModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
      <AdminDetailDrawer
        admin={viewing}
        onClose={() => setViewing(null)}
        onSaved={patchAdmin}
      />
      <Modal
        open={confirming !== null}
        onClose={closeConfirm}
        title={
          confirmAction === "delete"
            ? "Delete admin?"
            : confirming?.status === "ACTIVE"
              ? "Suspend admin?"
              : "Reactivate admin?"
        }
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
              onClick={handleConfirm}
              disabled={statusSaving}
              className={`flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold transition-colors disabled:opacity-50 ${
                confirmAction === "delete"
                  ? "bg-error text-on-error hover:bg-error/90"
                  : "bg-primary text-on-primary hover:bg-primary-dim"
              }`}
            >
              {statusSaving
                ? "Saving…"
                : confirmAction === "delete"
                  ? "Delete"
                  : confirming?.status === "ACTIVE"
                    ? "Suspend"
                    : "Reactivate"}
            </button>
          </>
        }
      >
        {confirming && (
          <div className="space-y-5">
            {/* Who this is about — named explicitly so the wrong row can't be actioned
                by mistake from a small row icon. */}
            <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                {initials(confirming.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">{confirming.name}</p>
                <p className="truncate text-xs text-on-surface-variant">{confirming.email}</p>
              </div>
              <span className="ml-auto shrink-0 rounded bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                {confirming.role === "super_admin" ? "Super Admin" : "Admin"}
              </span>
            </div>

            <p className="text-sm text-on-surface-variant">
              {confirmAction === "delete"
                ? "They will be removed from the admin console and lose access immediately. This can't be undone from here."
                : confirming.status === "ACTIVE"
                  ? "They will lose access to the admin dashboard immediately. You can reactivate them later."
                  : "They will regain access to the admin dashboard with their previous permissions."}
            </p>

            {/* Required on both paths — the activate endpoint validates a reason too, and
                it lands in the admin's audit trail either way. */}
            <Textarea
              id="status-reason"
              label={
                confirmAction === "delete"
                  ? "Reason for deletion"
                  : confirming.status === "ACTIVE"
                    ? "Reason for suspension"
                    : "Reason for reactivation"
              }
              required
              rows={3}
              maxLength={500}
              placeholder={
                confirmAction === "delete"
                  ? "e.g. Admin violated security policy, escalated by compliance team."
                  : confirming.status === "ACTIVE"
                    ? "e.g. Offboarding — left the company on 12 Aug."
                    : "e.g. Issue resolved, credentials changed, security audit passed."
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
