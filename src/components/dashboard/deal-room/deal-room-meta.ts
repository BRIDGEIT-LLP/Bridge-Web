/**
 * DEMO-ONLY presentation helpers for the Deal Room feature (status tabs, stage
 * pipeline, formatting). Local to the deal-room folder so the demo deletes cleanly.
 */

import type { StatusMeta } from "@/components/dashboard/kyc-status";
import type { DealRoom, DealRoomStatus, DealRoomTab, FundingOfferStatus } from "./types";

/** The list toggle buckets — ACTIVE also includes PAUSED rooms. */
export const DEAL_TABS: { key: DealRoomTab; label: string; shortLabel: string }[] = [
  { key: "ACTIVE", label: "Active Deals", shortLabel: "Active" },
  { key: "CLOSED", label: "Closed Deals", shortLabel: "Closed" },
  { key: "ARCHIVED", label: "Archived Deals", shortLabel: "Archived" },
];

/** Does a room belong to a given tab? (Paused rooms live under Active Deals.) Archived
 *  rooms (per-user, `room.isArchived`) show ONLY under the Archived tab and are hidden
 *  from Active/Closed — the list page fetches the archived set separately for that tab. */
export function roomInTab(room: DealRoom, tab: DealRoomTab): boolean {
  if (tab === "ARCHIVED") return room.isArchived;
  if (room.isArchived) return false;
  if (tab === "CLOSED") return room.status === "CLOSED";
  return room.status !== "CLOSED";
}

/** Status badge pill meta (label + colour classes) for the list cards. */
export const DEAL_STATUS_BADGE: Record<DealRoomStatus, { label: string; className: string }> = {
  // Arbitrary hex (not bg-green-700): this Tailwind v4 theme only generates a few green
  // utilities, so token classes like bg-green-700 render as no-fill. Hex always generates.
  ACTIVE: { label: "Active", className: "bg-[#15803d] text-white" },
  PAUSED: { label: "Paused", className: "bg-secondary text-on-secondary" },
  CLOSED: { label: "Closed", className: "bg-surface-container-highest text-on-surface-variant" },
};

/** Monochrome status pill meta for a funding offer, reusing the platform-wide
 *  StatusPill convention from kyc-status.tsx (no status colors, per theme). */
export const FUNDING_OFFER_STATUS_META: Record<FundingOfferStatus, StatusMeta> = {
  Draft: { label: "Draft", icon: "edit_note" },
  Pending: { label: "Pending", icon: "schedule" },
  Accepted: { label: "Accepted", icon: "task_alt" },
  Rejected: { label: "Rejected", icon: "cancel" },
  Countered: { label: "Countered", icon: "swap_horiz" },
};

/** The fixed 4-step deal pipeline rendered by the chat page's stage stepper. */
export const DEAL_STAGES = ["Initial Connection", "Negotiation", "Due Diligence", "Closing"] as const;
export const DEAL_STAGE_VALUES = ["Initial Connection", "Negotiation", "Due Diligence", "Closed"] as const;

/** Map a backend stage string to its stepper index. Tries the room-stage enum
 *  (`DEAL_STAGE_VALUES`) first, then falls back to the display label (`DEAL_STAGES`) —
 *  the shared-files API returns the label form (e.g. "Initial Connection") on each file
 *  row instead of the room's enum value. Unknown/missing → 0 (first stage). */
export function stageIndexFromValue(value: string | null | undefined): number {
  if (!value) return 0;
  const enumIdx = DEAL_STAGE_VALUES.indexOf(value as (typeof DEAL_STAGE_VALUES)[number]);
  if (enumIdx !== -1) return enumIdx;
  const labelIdx = DEAL_STAGES.indexOf(value as (typeof DEAL_STAGES)[number]);
  return labelIdx === -1 ? 0 : labelIdx;
}

/** The backend stage value for the step after `currentIndex`, or undefined if already
 *  on the last stage (nothing further to request). */
export function nextStageValue(currentIndex: number): string | undefined {
  return DEAL_STAGE_VALUES[currentIndex + 1];
}

/** Fixed reason options for the "Close Deal" confirmation dropdown. */
export const CLOSE_DEAL_REASONS = [
  { value: "Not relevant", label: "Not relevant" },
  { value: "Profile incomplete", label: "Profile incomplete" },
  { value: "No longer interested", label: "No longer interested" },
  { value: "Terms not agreed", label: "Terms not agreed" },
  { value: "Deal completed", label: "Deal completed" },
  { value: "Deal Completed elsewhere", label: "Deal Completed elsewhere" },
  { value: "Deal Cancelled", label: "Deal Cancelled" },
  { value: "No response from counterparty", label: "No response from counterparty" },
  { value: "Budget or timeline constraints", label: "Budget or timeline constraints" },
  { value: "Other", label: "Other" }
];

/** Tooltip copy shown on hover for each `DEAL_STAGES` entry (same order/index).
 *  TODO(content): placeholder text — swap in the real per-stage descriptions. */
export const DEAL_STAGE_INFO: string[] = [
  "Initial Connection: Secure messaging is activated after the connection is accepted. Introduce yourselves, exchange contact details, and schedule an initial meeting if needed.",
  "Negotiation: Discuss commercial terms such as pricing, equity, valuation, or supply agreements. Track offers, counter-offers, and term sheet updates.",
  "Due Diligence: Securely share confidential documents with role-based access. Downloaded files are watermarked to protect sensitive information.",
  "Closing: Finalize legal documents, confirm the transaction, and close the deal. Download a complete summary of the Deal Room activity."
];

/** Material Symbols icon name for each `DEAL_STAGES` entry (same order/index). */
export const DEAL_STAGE_ICONS: string[] = ["handshake", "gavel", "fact_check", "flag_circle"];

/** "2h ago" / "3d ago" style relative time for list rows + message meta. */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return ""; // no/invalid date → no "NaNd ago"
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/** Clock time (e.g. "10:24 AM") for a message bubble. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Today" / "Yesterday" / "12 Jun 2026" — for the date dividers in the thread. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/** "Maharashtra, India" from state + country (skips blanks; a lone value renders alone). */
export function formatLocation(state?: string | null, country?: string | null): string {
  return [state?.trim(), country?.trim()].filter(Boolean).join(", ");
}

/** Two-letter initials from a display name (avatar fallback). */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
