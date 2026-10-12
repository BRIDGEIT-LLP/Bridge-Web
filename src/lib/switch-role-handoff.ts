/**
 * Hand-off between the "Switch Account Type" modal and `/dashboard/switch-role`.
 *
 * `GET /auth/switch-role-details` is the source of the field list. The modal
 * stores unfilled fields in sessionStorage so a refresh of the form page keeps
 * working without a second round-trip; the form can also refetch if the
 * hand-off is missing. It is scoped to the tab + wiped once the switch request
 * is submitted. Anything older than TTL_MS is treated as absent — a stale
 * hand-off from an abandoned attempt must never silently reappear.
 */
import type { Role } from "@/lib/roles";
import type { SwitchRoleFieldMeta } from "@/types/api.types";
import type { SwitchRoleField } from "@/services/user.service";

const STORAGE_KEY = "bridge-platform.switch-role";
const TTL_MS = 15 * 60_000;

export interface SwitchRoleHandoff {
  /** The role the user is trying to move into. */
  role: Role;
  /**
   * Unfilled registration columns for that role (required and optional) — the
   * same set complete-profile would show, minus values already on the user row.
   */
  fields: SwitchRoleFieldMeta[];
  /** Backend message worth echoing on the form. */
  message?: string;
  at: number;
}

/**
 * Company identifiers the switch-role save will accept once, while the company
 * row is still empty. Field master keeps them `is_editable: false` so My Profile
 * stays locked after they exist; the switch form unlocks them only because they
 * arrived as unfilled fields (no value yet).
 */
export const FIRST_FILL_COMPANY_COLUMNS = new Set(["gst_number", "cin_number"]);

/**
 * User columns that field master also locks after the first save (no repeatable
 * editor on My Profile). Same first-fill window as GST/CIN: the switch form
 * unlocks them because they arrived as unfilled fields.
 */
export const FIRST_FILL_USER_COLUMNS = new Set(["founders"]);

/**
 * Backend field metadata → the `ProfileField` shape `ProfileFieldRow` renders
 * (`fieldName` is the API's name for what the profile endpoints call
 * `columnName`). Unfilled fields start blank; a value from the details API is
 * kept when present.
 */
export function toProfileFields(fields: SwitchRoleFieldMeta[]): SwitchRoleField[] {
  return fields.map((f) => {
    const firstFill =
      FIRST_FILL_COMPANY_COLUMNS.has(f.fieldName) || FIRST_FILL_USER_COLUMNS.has(f.fieldName);
    const raw = f.value;
    const value =
      raw === null || raw === undefined
        ? ""
        : Array.isArray(raw) || typeof raw === "string" || typeof raw === "number"
          ? raw
          : "";
    return {
      columnName: f.fieldName,
      label: f.label ?? f.fieldName,
      type: f.type ?? "string",
      // Company-owned columns can't be written except the first-fill GST/CIN
      // window above. Founders is a locked user column that the switch form
      // still has to collect. Everything else stays locked.
      isEditable: firstFill || (f.isEditable !== false && f.sourceTable !== "company"),
      isRequired: f.isRequired === true,
      value,
    };
  });
}

export function unfilledSwitchRoleFields(fields: SwitchRoleFieldMeta[] | undefined): SwitchRoleFieldMeta[] {
  return (fields ?? []).filter((field) => field.isFilled !== true);
}

export function setSwitchRoleHandoff(handoff: Omit<SwitchRoleHandoff, "at">): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...handoff, at: Date.now() }));
  } catch {
    /* storage unavailable — the form falls back to refetching switch-role-details */
  }
}

export function getSwitchRoleHandoff(): SwitchRoleHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SwitchRoleHandoff;
    if (!parsed?.role || !Array.isArray(parsed.fields)) return null;
    if (Date.now() - (parsed.at ?? 0) > TTL_MS) {
      clearSwitchRoleHandoff();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSwitchRoleHandoff(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
