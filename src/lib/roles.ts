/**
 * Single source of truth for the platform's user roles.
 *
 * The backend returns the role in the login response (we never decode the JWT).
 * Staff roles (super_admin / admin) and user roles (startup / investor /
 * b2b_enterprise) drive which dashboard view + sidebar nav is rendered. Only the
 * three user roles are switchable via the "Switch User" modal.
 */

export type Role =
  | "super_admin"
  | "admin"
  | "startup"
  | "investor"
  | "b2b_enterprise";

/** The roles a user can switch between (the "Switch User" modal options). */
export const USER_ROLES: Role[] = ["startup", "investor", "b2b_enterprise"];

export const ALL_ROLES: Role[] = ["super_admin", "admin", ...USER_ROLES];

interface RoleMeta {
  /** Human-friendly label shown in the sidebar / switch modal. */
  label: string;
  /** Material Symbols Outlined icon name. */
  icon: string;
  /** Short line shown under the label in the switch-user modal. */
  description: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  super_admin: {
    label: "Super Admin",
    icon: "admin_panel_settings",
    description: "Full platform control and configuration.",
  },
  admin: {
    label: "Admin",
    icon: "shield_person",
    description: "Review verifications and support users.",
  },
  startup: {
    label: "Startup",
    icon: "rocket_launch",
    description: "Raise funding and connect with investors.",
  },
  investor: {
    label: "Investor",
    icon: "payments",
    description: "Discover startups and manage your portfolio.",
  },
  b2b_enterprise: {
    label: "B2B Enterprise",
    icon: "domain",
    description: "Find partners across the supply chain.",
  },
};

/** Type guard / runtime check for a known role. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as string[]).includes(value);
}

/**
 * Normalize a backend-supplied role to our frontend `Role`. The backend uses
 * uppercase enums (STARTUP / INVESTOR / B2B — see ROLE_MAP in registration) which
 * don't match our lowercase union, so map them here. Already-correct values pass
 * through. Returns null for anything unrecognized.
 */
export function normalizeRole(raw: unknown): Role | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  const ALIASES: Record<string, Role> = {
    startup: "startup",
    investor: "investor",
    b2b: "b2b_enterprise",
    b2b_enterprise: "b2b_enterprise",
    admin: "admin",
    // Backend staff role enums → our staff views.
    sys_admin: "admin",
    sys_super_admin: "super_admin",
    superadmin: "super_admin",
  };
  return ALIASES[key] ?? (isRole(key) ? key : null);
}

/**
 * Our lowercase `Role` → the backend's uppercase `roleCode` enum. The switch-role
 * endpoint validates against exactly INVESTOR / B2B / STARTUP (see authValidation.js),
 * so `b2b_enterprise` has to shorten to `B2B` — the inverse of normalizeRole's aliases.
 */
const ROLE_CODES: Record<string, string> = {
  startup: "STARTUP",
  investor: "INVESTOR",
  b2b_enterprise: "B2B",
};

export function toRoleCode(role: Role): string {
  return ROLE_CODES[role] ?? role.toUpperCase();
}

/** Whether the given role is one of the switchable user roles. */
export function isUserRole(role: Role | null | undefined): boolean {
  return !!role && USER_ROLES.includes(role);
}

/** Whether the given role is a staff role (super_admin / admin). */
export function isStaffRole(role: Role | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

/** Whether the given role is the super admin (guards super-admin-only sections). */
export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === "super_admin";
}
