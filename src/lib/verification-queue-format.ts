/** Formatting helpers shared by the Verification queue list and detail modal (FRD §12.5). */

import { formatAmountRange } from "@/lib/explore-format";
import type { VerificationQueueListItem } from "@/types/api.types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** "Seed, ₹8Cr raised" for a founder/owner, "₹2Cr – ₹10Cr" ticket size for an investor. */
export function formatApplicantSize(item: Pick<VerificationQueueListItem, "role" | "funding">): string {
  const { role, funding } = item;
  if (role === "INVESTOR") {
    const ticket = formatAmountRange(funding.ticketSizeMin ?? undefined, funding.ticketSizeMax ?? undefined);
    return ticket || "—";
  }
  const ask = formatAmountRange(funding.askAmountMin ?? undefined, funding.askAmountMax ?? undefined);
  const parts = [funding.stage, ask ? `${ask} raised` : null].filter(Boolean);
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
 * Role label for the Verification queue only — distinct from the platform-wide
 * roleLabel()/ROLE_META (used on Switch Role etc., where "Startup"/"B2B Enterprise"
 * is correct). Here the column names the person's standing within their company:
 * a startup's registrant is its Founder, a B2B company's its Owner.
 */
const QUEUE_ROLE_LABELS: Record<string, string> = {
  STARTUP: "Founder",
  B2B: "Owner",
  INVESTOR: "Investor",
};

export function queueRoleLabel(roleCode?: string | null): string {
  if (!roleCode) return "—";
  return QUEUE_ROLE_LABELS[roleCode] ?? roleCode;
}

export { ONE_DAY_MS };
