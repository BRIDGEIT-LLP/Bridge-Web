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

/** Hours since submission — drives the "over 24 hours turns red" SLA flag (S48). */
export function hoursWaiting(submittedAt?: string | null): number | null {
  if (!submittedAt) return null;
  const submitted = new Date(submittedAt).getTime();
  if (Number.isNaN(submitted)) return null;
  return Math.floor((Date.now() - submitted) / (60 * 60 * 1000));
}

export function isOverdue(submittedAt?: string | null): boolean {
  const hours = hoursWaiting(submittedAt);
  return hours != null && hours >= 24;
}

/** "yesterday" / "3h" / "7h" style label, matching the S48 mockup. */
export function formatWaiting(submittedAt?: string | null): string {
  const hours = hoursWaiting(submittedAt);
  if (hours == null) return "—";
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d`;
}

export { ONE_DAY_MS };
