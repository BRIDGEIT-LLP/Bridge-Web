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
