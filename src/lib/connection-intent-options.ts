/**
 * Connection Purpose / Intent options, keyed by the SENDER's role.
 *
 * These reference the EXISTING profile-options arrays (single source of truth) —
 * we never redefine the option lists here, only map role → the right list. Used by
 * the Proposal Form Modal to show role-appropriate intents.
 */

import type { Role } from "./roles";
import type { Option } from "./startup-profile-options";
import { INTENT_OPTIONS } from "./startup-profile-options";
import { PRIMARY_INTENT_OPTIONS } from "./investor-profile-options";
import { BUSINESS_INTENTS } from "./b2b-profile-options";

export const CONNECTION_INTENT_OPTIONS: Partial<Record<Role, Option[]>> = {
  startup: INTENT_OPTIONS,
  investor: PRIMARY_INTENT_OPTIONS,
  b2b_enterprise: BUSINESS_INTENTS,
};

/** Intent options for a role (empty array for staff/unknown roles). */
export const getIntentOptions = (role: Role | null | undefined): Option[] =>
  role ? CONNECTION_INTENT_OPTIONS[role] ?? [] : [];

const INTENT_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(CONNECTION_INTENT_OPTIONS)
    .flat()
    .map((o) => [o.value, o.label]),
);

const humanize = (code: string) => {
  const t = code.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * Readable label for a stored intent code (e.g. `seed_investment` → "Seeking Seed
 * Investment"). Accepts the service's comma-joined multi-value string; unknown codes
 * fall back to a humanized version so a raw snake_case value never reaches the UI.
 */
export function intentLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => INTENT_LABELS[c] ?? humanize(c))
    .join(", ");
}
