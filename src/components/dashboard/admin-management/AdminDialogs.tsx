"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/modal/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Field } from "@/components/dashboard/UserDetailDrawer";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { initials, formatDate, timeAgo } from "@/lib/admin-format";
import { EMAIL_REGEX, PASSWORD_REGEX, phoneErrorForDialCode, nationalDigits } from "@/lib/validation";
import { createAdmin, fetchAdminDetail, updateAdmin } from "@/services/admin.service";
import type {
  AdminAccount,
  AdminAccountStatus,
  AdminDetail,
  CreateAdminPayload,
} from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/**
 * The three dialogs of Admin Management — the create form, the read-only detail drawer and
 * the permissions editor. They're only used by that page and share the permission grid, so
 * they live together (same idea as `system-management/SettingsCards.tsx`).
 *
 * The module + role-profile lists below are the screen's single source of truth; the page
 * imports them from here (it can't own them — it imports this file).
 */

/**
 * Modules an admin can be granted. Keys are the backend's `ADMIN_PERMISSION_KEYS` enum
 * verbatim — the create/update payloads are validated against it, so they must match
 * exactly (`permission_key must be one of: …`).
 */
export const ADMIN_MODULES: { key: string; label: string }[] = [
  { key: "KYC_REVIEW", label: "KYC Review" },
  { key: "FAQ_MANAGEMENT", label: "FAQ Management" },
  { key: "USER_MANAGEMENT", label: "User Management" },
];

/** Named permission presets shown in the "Role Profile" dropdown. */
export const ROLE_PROFILE_OPTIONS = [
  { value: "compliance_analyst", label: "Compliance Analyst" },
  { value: "support_agent", label: "Support Agent" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "platform_admin", label: "Platform Admin" },
];

/**
 * Human label for a stored module key. Matched case-insensitively — the detail endpoint
 * returns `KYC_REVIEW` while `ADMIN_MODULES` keys are lowercase. Unknown keys degrade to
 * the key with its underscores opened out rather than raw SCREAMING_SNAKE.
 */
export function moduleLabel(key: string): string {
  const found = ADMIN_MODULES.find((m) => m.key.toLowerCase() === key.toLowerCase());
  return found?.label ?? key.replace(/_/g, " ");
}

/** Human label for a stored role-profile value. */
export function roleProfileLabel(value?: string): string | undefined {
  if (!value) return undefined;
  return ROLE_PROFILE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Status pill metadata — neutral icon + label, per the theme's no-status-color rule. */
export const ADMIN_STATUS_META: Record<AdminAccountStatus, { label: string; icon: string }> = {
  ACTIVE: { label: "Active", icon: "check_circle" },
  SUSPENDED: { label: "Suspended", icon: "block" },
};

/** Inline error message under a field. */
function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 px-1 text-xs font-medium text-error">{children}</p>;
}

/** The module checkbox grid — shared by the create form and the permissions editor. */
function PermissionGrid({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ADMIN_MODULES.map((mod) => {
        const checked = value.includes(mod.key);
        return (
          <button
            key={mod.key}
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => toggle(mod.key)}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-all ${
              checked
                ? "border-primary bg-primary-container/40 ring-2 ring-primary/15"
                : "border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/60"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                checked ? "border-primary bg-primary text-on-primary" : "border-outline-variant"
              }`}
            >
              {checked && <Icon name="check" size={14} />}
            </span>
            <span className="font-medium text-on-surface">{mod.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Create New Admin                                                           */
/* -------------------------------------------------------------------------- */

type CreateErrors = Partial<Record<keyof CreateAdminPayload, string>>;

/** Default dialling code — the national number is validated against this (and any later edit). */
const DEFAULT_COUNTRY_CODE = "+91";

const EMPTY_FORM: CreateAdminPayload = {
  name: "",
  email: "",
  mobileNumber: "",
  countryCode: DEFAULT_COUNTRY_CODE,
  password: "",
  // The full matrix, all denied — ticking a module flips its `isAllowed`.
  permissions: ADMIN_MODULES.map((m) => ({ permissionKey: m.key, isAllowed: false })),
  sendWelcomeEmail: true,
};

interface CreateAdminModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create so the page can refresh its list. */
  onCreated: () => void;
}

/** "Create New Admin" form — assigns a new member to the administrative dashboard. */
export function CreateAdminModal({ open, onClose, onCreated }: CreateAdminModalProps) {
  const [form, setForm] = useState<CreateAdminPayload>(EMPTY_FORM);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset to a clean form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the form on open
    setForm(EMPTY_FORM);
    setErrors({});
    setShowPassword(false);
  }, [open]);

  const set = <K extends keyof CreateAdminPayload>(key: K, value: CreateAdminPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = (): CreateErrors => {
    const found: CreateErrors = {};
    if (!form.name.trim()) found.name = "Full name is required.";
    if (!EMAIL_REGEX.test(form.email.trim())) found.email = "Enter a valid email address.";
    const phoneErr = phoneErrorForDialCode(form.countryCode, form.mobileNumber);
    if (phoneErr) found.mobileNumber = phoneErr;
    if (!PASSWORD_REGEX.test(form.password))
      found.password = "Min 8 characters with upper, lower, number and symbol.";
    if (!form.permissions.some((p) => p.isAllowed)) found.permissions = "Grant at least one module.";
    return found;
  };

  const handleSubmit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await createAdmin({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        mobileNumber: nationalDigits(form.mobileNumber),
      });
      toast.success(`${form.name.trim()} was added as an admin.`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error((err as ApiError).message || "Couldn't create the admin. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Admin"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-11 items-center rounded-xl px-5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="cta-gradient flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
          >
            <Icon name="admin_panel_settings" size={18} />
            {saving ? "Creating…" : "Create Admin"}
          </button>
        </>
      }
    >
      <p className="mb-6 text-sm text-on-surface-variant">
        Assign a new member to the administrative dashboard.
      </p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Input
            id="admin-name"
            variant="underline"
            label="Full Name"
            placeholder="e.g. Robert Fox"
            value={form.name}
            error={errors.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <ErrorText>{errors.name}</ErrorText>
        </div>
        <div>
          <Input
            id="admin-email"
            variant="underline"
            type="email"
            label="Email Address"
            placeholder="robert@bridgeconnect.com"
            value={form.email}
            error={errors.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <ErrorText>{errors.email}</ErrorText>
        </div>
        <div>
          <Input
            id="admin-mobile"
            variant="underline"
            type="tel"
            label="Mobile Number"
            placeholder="9876543210"
            value={form.mobileNumber}
            error={errors.mobileNumber}
            onChange={(e) => set("mobileNumber", e.target.value)}
          />
          <ErrorText>{errors.mobileNumber}</ErrorText>
        </div>
        <div>
          <Input
            id="admin-password"
            variant="underline"
            type={showPassword ? "text" : "password"}
            label="Password"
            placeholder="••••••••••"
            value={form.password}
            error={errors.password}
            onChange={(e) => set("password", e.target.value)}
            adornment={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
              </button>
            }
          />
          <ErrorText>{errors.password}</ErrorText>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 font-label text-[11px] font-bold uppercase tracking-wider text-on-secondary-container">
          Module Permissions
        </p>
        {/* The grid speaks in granted keys; the payload needs the full allow/deny matrix. */}
        <PermissionGrid
          value={form.permissions.filter((p) => p.isAllowed).map((p) => p.permissionKey)}
          onChange={(next) =>
            set(
              "permissions",
              ADMIN_MODULES.map((m) => ({ permissionKey: m.key, isAllowed: next.includes(m.key) }))
            )
          }
        />
        <ErrorText>{errors.permissions}</ErrorText>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon name="mail" size={20} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-on-surface">Send Welcome Email</p>
            <p className="text-xs text-on-surface-variant">User will receive login credentials via email</p>
          </div>
        </div>
        <ToggleSwitch
          checked={form.sendWelcomeEmail}
          onChange={(v) => set("sendWelcomeEmail", v)}
          label="Send Welcome Email"
          hideLabel
        />
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Detail drawer                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bare underline input used inside a detail row — no chrome of its own, so an editable row
 * keeps the exact icon/label rhythm of the read-only `Field` next to it.
 */
const INLINE_INPUT =
  "border-0 border-b border-outline-variant bg-transparent pb-0.5 text-sm font-semibold text-on-surface transition-colors focus:border-primary focus:outline-none";

/** A `Field` whose value is an input — same layout, editable in place. */
function EditableRow({
  id,
  icon,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  icon: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-on-surface-variant" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          {label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${INLINE_INPUT}`}
        />
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}

/** Editable subset of the drawer, mirroring what PUT /admins/:id accepts. */
interface EditForm {
  name: string;
  countryCode: string;
  mobileNumber: string;
  permissions: { permissionKey: string; isAllowed: boolean }[];
}

interface AdminDetailDrawerProps {
  admin: AdminAccount | null;
  onClose: () => void;
  /** Called after a successful save so the page can patch the row in place. */
  onSaved?: (id: string, changes: Partial<AdminAccount>) => void;
}

/** Profile for one admin (the row's "View Details" action), editable via its own toggle. */
export function AdminDetailDrawer({ admin, onClose, onSaved }: AdminDetailDrawerProps) {
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EditForm, string>>>({});

  const id = admin?.id;

  // The list response carries no permissions or activity logs, so fetch the full record
  // whenever a different admin is opened. `cancelled` drops a response that arrives after
  // the drawer moved on to another row.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- fetch-on-open, guarded by `cancelled` */
    setLoading(true);
    setError(null);
    setDetail(null);
    // Opening a different admin always lands read-only, never mid-edit on the last one.
    setEditing(false);
    setForm(null);
    setFormErrors({});
    fetchAdminDetail(id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err: ApiError) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!admin) return null;

  // Prefer the fetched record; fall back to the row so the header renders immediately.
  const a = detail?.admin ?? admin;
  const phone = a.mobileNumber ? `${a.countryCode ? `${a.countryCode} ` : ""}${a.mobileNumber}` : undefined;

  /**
   * `created_by` comes back as a bare UUID — the detail query doesn't join the creator.
   * The activity log does expand its performer, so resolve the name from there: first by
   * matching the id, then by falling back to whoever performed the CREATED action.
   * Shows the raw id only if neither is available.
   */
  const createdBy =
    detail?.activityLogs.find((l) => l.performedBy?.id && l.performedBy.id === a.createdBy)?.performedBy
      ?.name ??
    detail?.activityLogs.find((l) => l.action.toUpperCase().includes("CREATE"))?.performedBy?.name ??
    a.createdBy;

  /** Enter edit mode with the form seeded from the fetched record. */
  const startEdit = () => {
    setForm({
      name: a.name,
      countryCode: a.countryCode ?? DEFAULT_COUNTRY_CODE,
      mobileNumber: a.mobileNumber ?? "",
      // Seed from the full matrix so unticked modules are sent as `is_allowed: false`.
      permissions: ADMIN_MODULES.map((m) => ({
        permissionKey: m.key,
        isAllowed: detail?.permissions.find((p) => p.permissionKey === m.key)?.isAllowed ?? false,
      })),
    });
    setFormErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
    setFormErrors({});
  };

  const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFormErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSave = async () => {
    if (!form) return;

    const found: Partial<Record<keyof EditForm, string>> = {};
    if (form.name.trim().length < 2) found.name = "Name must be at least 2 characters.";
    if (form.mobileNumber) {
      const phoneErr = phoneErrorForDialCode(form.countryCode, form.mobileNumber, false);
      if (phoneErr) found.mobileNumber = phoneErr;
    }
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const saved = await updateAdmin(a.id, {
        name: form.name.trim(),
        countryCode: form.countryCode.trim(),
        mobileNumber: nationalDigits(form.mobileNumber),
        permissions: form.permissions,
      });
      // The PUT returns the account but not the permission matrix, so keep ours.
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              admin: { ...saved, permissions: form.permissions.filter((p) => p.isAllowed).map((p) => p.permissionKey) },
              permissions: form.permissions.map((p) => ({ id: p.permissionKey, ...p })),
            }
          : prev
      );
      onSaved?.(a.id, {
        name: saved.name,
        countryCode: saved.countryCode,
        mobileNumber: saved.mobileNumber,
        permissions: form.permissions.filter((p) => p.isAllowed).map((p) => p.permissionKey),
      });
      toast.success("Admin updated.");
      cancelEdit();
    } catch (err) {
      toast.error((err as ApiError).message || "Couldn't update the admin. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open onClose={onClose} title={a.name} subtitle={a.email}>
      <div className="mb-5 flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-container text-lg font-bold text-on-primary-container">
          {initials(a.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-headline text-lg font-bold text-on-surface">{a.name}</p>
          <p className="truncate text-sm text-on-surface-variant">{a.email}</p>
        </div>
        <div className="ml-auto shrink-0">
          <StatusPill {...ADMIN_STATUS_META[a.status]} />
        </div>
      </div>

      {/* Edit toggle — only once the record has loaded, since the form seeds from it. */}
      {detail && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-surface-container-low px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-on-surface">Edit Details</p>
            <p className="text-xs text-on-surface-variant">
              Name, mobile and module permissions
            </p>
          </div>
          <ToggleSwitch
            checked={editing}
            onChange={(v) => (v ? startEdit() : cancelEdit())}
            label={editing ? "Editing" : "Edit"}
            disabled={saving}
          />
        </div>
      )}

      {/* Name / country code / mobile are the only editable profile fields — the update
          schema rejects everything else, so the rest stays read-only in both modes.
          They're edited in place, as rows in this same list. */}
      <div className="divide-y divide-outline/5">
        {editing && form && (
          <EditableRow
            id="edit-admin-name"
            icon="person"
            label="Full Name"
            value={form.name}
            error={formErrors.name}
            onChange={(v) => setField("name", v)}
          />
        )}
        <Field icon="badge" label="Role" value={a.role === "super_admin" ? "Super Admin" : "Admin"} />
        <Field icon="workspace_premium" label="Role Profile" value={roleProfileLabel(a.roleProfile)} />
        <Field icon="mail" label="Email" value={a.email} />
        {editing && form ? (
          <div className="flex items-start gap-3 py-2.5">
            <Icon name="call" size={20} className="mt-0.5 shrink-0 text-on-surface-variant" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Mobile</p>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Country code"
                  value={form.countryCode}
                  maxLength={5}
                  onChange={(e) => setField("countryCode", e.target.value)}
                  className={`w-14 shrink-0 ${INLINE_INPUT}`}
                />
                <input
                  aria-label="Mobile number"
                  type="tel"
                  value={form.mobileNumber}
                  onChange={(e) => setField("mobileNumber", e.target.value)}
                  className={`min-w-0 flex-1 ${INLINE_INPUT}`}
                />
              </div>
              <ErrorText>{formErrors.mobileNumber}</ErrorText>
            </div>
          </div>
        ) : (
          <Field icon="call" label="Mobile" value={phone} />
        )}
        <Field icon="event" label="Created" value={a.createdAt ? formatDate(a.createdAt) : undefined} />
        <Field icon="schedule" label="Last Login" value={a.lastLoginAt ? timeAgo(a.lastLoginAt) : undefined} />
        <Field icon="person_add" label="Created By" value={createdBy} />
        <Field icon="toggle_on" label="Account State" value={a.isDeleted ? "Deleted" : "Not deleted"} />
      </div>

      {loading && <p className="mt-5 text-sm text-on-surface-variant">Loading details…</p>}
      {error && <p className="mt-5 text-sm text-error">{error}</p>}

      {detail && (
        <>
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-on-surface-variant">
              Module Permissions
            </p>
            {editing && form ? (
              <PermissionGrid
                value={form.permissions.filter((p) => p.isAllowed).map((p) => p.permissionKey)}
                onChange={(next) =>
                  setField(
                    "permissions",
                    ADMIN_MODULES.map((m) => ({
                      permissionKey: m.key,
                      isAllowed: next.includes(m.key),
                    }))
                  )
                }
              />
            ) : a.role === "super_admin" ? (
              <p className="text-sm font-semibold text-on-surface">All modules</p>
            ) : detail.permissions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No modules granted.</p>
            ) : (
              /* Every returned key is listed with its allowed/denied state and its raw
                 backend key, so the drawer shows the permission matrix as the API sent it. */
              <ul className="divide-y divide-outline/5">
                {detail.permissions.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <Icon
                      name={p.isAllowed ? "check_circle" : "cancel"}
                      size={18}
                      className={p.isAllowed ? "text-primary" : "text-outline"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {moduleLabel(p.permissionKey)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-on-surface-variant">
                        {p.permissionKey}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 text-xs font-medium text-on-surface-variant">
                      {p.isAllowed ? "Allowed" : "Denied"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editing && (
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="flex h-10 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-on-surface-variant">
              Activity Log
            </p>
            {detail.activityLogs.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No activity recorded.</p>
            ) : (
              <ol className="space-y-3">
                {detail.activityLogs.map((log) => (
                  <li key={log.id} className="flex gap-3">
                    <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                      <Icon name={activityIcon(log.action)} size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface">
                        {actionLabel(log.action)}
                        {log.performedBy && (
                          <span className="font-normal text-on-surface-variant">
                            {" "}
                            by {log.performedBy.name}
                          </span>
                        )}
                      </p>
                      {log.performedBy && (log.performedBy.email || log.performedBy.role) && (
                        <p className="truncate text-xs text-on-surface-variant">
                          {[log.performedBy.email, log.performedBy.role && actionLabel(log.performedBy.role)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {log.reason && (
                        <p className="text-xs text-on-surface-variant">Reason: {log.reason}</p>
                      )}
                      {log.createdAt && (
                        <p className="text-xs text-outline">
                          {formatDate(log.createdAt)} · {timeAgo(log.createdAt)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

/** Material icon for an audit action; falls back to a neutral dot. */
function activityIcon(action: string): string {
  const key = action.toUpperCase();
  if (key.includes("CREATE")) return "person_add";
  if (key.includes("SUSPEND")) return "block";
  if (key.includes("ACTIVATE")) return "restart_alt";
  if (key.includes("DELETE")) return "delete";
  if (key.includes("UPDATE") || key.includes("PERMISSION")) return "edit";
  return "history";
}

/** "CREATED" → "Created", "PERMISSIONS_UPDATED" → "Permissions updated". */
function actionLabel(action: string): string {
  if (!action) return "—";
  const words = action.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

