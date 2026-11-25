/** Formatting helpers shared by the Verification queue list and detail modal (FRD §12.5). */

import { formatAmountRange, formatInrCompact } from "@/lib/explore-format";
import { REVENUE_BANDS } from "@/lib/b2b-profile-options";
import { FUNDING_STAGES } from "@/lib/startup-profile-options";
import { internalRoleLabel, normalizeRole } from "@/lib/roles";
import type { VerificationQueueListItem } from "@/types/api.types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const revenueBandLabel = (value: string) => REVENUE_BANDS.find((o) => o.value === value)?.label ?? value;
const fundingStageLabel = (value: string) => FUNDING_STAGES.find((o) => o.value === value)?.label ?? value;

/** "Seed, Raising ₹8Cr" for a founder, a revenue band label (e.g. "₹10 Cr – ₹50 Cr",
 *  from REVENUE_BANDS — spaced differently than formatInrCompact's "₹8Cr") for a
 *  business owner, "₹2Cr – ₹10Cr" ticket size for an investor. */
export function formatApplicantSize(item: Pick<VerificationQueueListItem, "role" | "funding">): string {
  const { role, funding } = item;
  if (role === "INVESTOR") {
    const ticket = formatAmountRange(funding.ticketSizeMin ?? undefined, funding.ticketSizeMax ?? undefined);
    return ticket || "—";
  }
  if (role === "B2B") {
    return funding.revenueBand ? revenueBandLabel(funding.revenueBand) : "—";
  }
  // Registration only ever collects a single ask figure (funding_ask_amt_max) today,
  // so formatAmountRange's "Up to ₹X" reads oddly here — "Raising ₹X" (S49 mockup)
  // is the phrasing for a fundraise ask, range or not. Built directly from the
  // amounts (not derived from formatAmountRange's wording) so it can't silently
  // break if that wording changes.
  const { askAmountMin, askAmountMax } = funding;
  let ask: string | null = null;
  if (askAmountMin != null && askAmountMax != null) {
    ask = `Raising ${formatInrCompact(askAmountMin)} – ${formatInrCompact(askAmountMax)}`;
  } else if (askAmountMax != null) {
    ask = `Raising ${formatInrCompact(askAmountMax)}`;
  } else if (askAmountMin != null) {
    ask = `Raising ${formatInrCompact(askAmountMin)}+`;
  }
  const parts = [funding.stage ? fundingStageLabel(funding.stage) : null, ask].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

/** Minutes since submission — finer-grained base for formatWaiting/isOverdue. */
export function minutesWaiting(submittedAt?: string | null): number | null {
  if (!submittedAt) return null;
  const submitted = new Date(submittedAt).getTime();
  if (Number.isNaN(submitted)) return null;
  return Math.floor((Date.now() - submitted) / (60 * 1000));
}

/** Hours since submission — drives the "over 24 hours turns red" SLA flag (S48). */
export function hoursWaiting(submittedAt?: string | null): number | null {
  const minutes = minutesWaiting(submittedAt);
  return minutes == null ? null : Math.floor(minutes / 60);
}

export function isOverdue(submittedAt?: string | null): boolean {
  const hours = hoursWaiting(submittedAt);
  return hours != null && hours >= 24;
}

/** "just now" / "5m" / "3h" / "7h" / "yesterday" style label, matching the S48 mockup
 *  plus a minutes tier so sub-hour waits aren't all lumped into "just now". */
export function formatWaiting(submittedAt?: string | null): string {
  const minutes = minutesWaiting(submittedAt);
  if (minutes == null) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d`;
}

/**
 * Role label for the Verification queue's `company_role_master.role_code` values
 * (STARTUP / B2B / INVESTOR) — normalizes to our Role enum and defers to the shared
 * internalRoleLabel() overlay (see roles.ts) so Members and Verification queue stay
 * in sync. Falls back to the raw code if it's ever something unrecognized.
 */
export function queueRoleLabel(roleCode?: string | null): string {
  if (!roleCode) return "—";
  const role = normalizeRole(roleCode);
  return role ? internalRoleLabel(role) : roleCode;
}

/**
 * Role label for the applicant detail/review modal only — same as queueRoleLabel
 * except B2B spells out "Business owner" instead of the list's shorter "Owner".
 */
export function detailRoleLabel(roleCode?: string | null): string {
  if (!roleCode) return "—";
  if (normalizeRole(roleCode) === "b2b_enterprise") return "Business owner";
  return queueRoleLabel(roleCode);
}

export { ONE_DAY_MS };
