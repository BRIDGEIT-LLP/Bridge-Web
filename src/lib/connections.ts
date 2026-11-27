/**
 * Shared, permanent metadata + helpers for the Connections feature (status labels,
 * available actions, decline reasons). Kept free of dummy/API code so both the live
 * screen and the demo screen reuse it, and deleting the demo never touches this.
 */

import { ROLE_META, type Role } from "@/lib/roles";
import type { Option } from "@/lib/startup-profile-options";
import type {
  ConnectionActionType,
  ConnectionDirection,
  ConnectionStatus,
} from "@/types/api.types";

/** Screen tabs: open requests received / sent, and everything already resolved. */
export type ConnectionTab = "received" | "sent" | "history";

/**
 * The "Viewed" read-receipt is fully wired (the API call + status), but hidden for now:
 * while this is false a VIEWED request is displayed as Pending. Flip to `true` to show it.
 */
export const SHOW_VIEWED_STATUS = false;

/** Status to *display* for a request (folds Viewed into Pending while it's hidden). */
export function displayStatus(status: ConnectionStatus): ConnectionStatus {
  return !SHOW_VIEWED_STATUS && status === "VIEWED" ? "PENDING" : status;
}

/** Statuses that still await a final answer — these live in the Received / Sent tabs. */
export const OPEN_STATUSES: ConnectionStatus[] = ["PENDING", "VIEWED", "DEFERRED"];

/** Which tab a request belongs to. Resolved requests (accepted, declined, withdrawn,
 *  expired) all go to History regardless of direction. */
export function tabFor(r: { direction: ConnectionDirection; status: ConnectionStatus }): ConnectionTab {
  if (!OPEN_STATUSES.includes(r.status)) return "history";
  return r.direction;
}

/** Monochrome status meta (icon + label), matching the admin StatusPill style. */
export const CONNECTION_STATUS_META: Record<ConnectionStatus, { label: string; icon: string; hint: string }> = {
  PENDING: { label: "Pending", icon: "schedule", hint: "Awaiting recipient response." },
  VIEWED: { label: "Viewed", icon: "visibility", hint: "Recipient has opened the request." },
  ACCEPTED: { label: "Accepted", icon: "handshake", hint: "Connection established — Deal Room created." },
  DECLINED: { label: "Declined", icon: "cancel", hint: "Recipient declined with a reason." },
  DEFERRED: { label: "Deferred", icon: "snooze", hint: "Flagged for later review." },
  WITHDRAWN: { label: "Withdrawn", icon: "undo", hint: "Sender retracted before acceptance." },
  EXPIRED: { label: "Expired", icon: "hourglass_disabled", hint: "No response within 14 days." },
};

/** Statuses that occupy the role-pair — a new Connect request is not allowed. */
export const CONNECTION_BLOCKING_STATUSES: ConnectionStatus[] = [
  "PENDING",
  "VIEWED",
  "ACCEPTED",
  "DEFERRED",
];

/** Map the backend's Title-Case status (`Pending`) onto the UI's uppercase key. */
export function parseConnectionStatus(raw?: string | null): ConnectionStatus | null {
  if (!raw) return null;
  const key = raw.toUpperCase() as ConnectionStatus;
  return key in CONNECTION_STATUS_META ? key : null;
}

/** True when the viewer can still send a Connect request to this role pair. */
export function canSendConnectionRequest(status: ConnectionStatus | null): boolean {
  return status == null || !CONNECTION_BLOCKING_STATUSES.includes(status);
}

/** Footer Connect button label on another user's profile. */
export function connectButtonLabel(status: ConnectionStatus | null): string {
  if (status === "ACCEPTED") return "Connected";
  if (status && CONNECTION_BLOCKING_STATUSES.includes(status)) return "Request sent";
  return "Connect";
}

/** Footer Connect button icon on another user's profile. */
export function connectButtonIcon(status: ConnectionStatus | null): string {
  if (status === "ACCEPTED") return "handshake";
  if (status && CONNECTION_BLOCKING_STATUSES.includes(status)) return "schedule";
  return "person_add";
}

/** Search/profile presence label: Connected, a live request status, or Not connected. */
export function connectionPresenceMeta(status: ConnectionStatus | null): { icon: string; label: string } {
  if (status === "ACCEPTED") return { icon: "handshake", label: "Connected" };
  if (status && status in CONNECTION_STATUS_META) {
    const meta = CONNECTION_STATUS_META[status];
    return { icon: meta.icon, label: meta.label };
  }
  return { icon: "link_off", label: "Not connected" };
}

/** Label + icon per action, for the action dropdown. */
export const CONNECTION_ACTION_META: Record<ConnectionActionType, { label: string; icon: string }> = {
  ACCEPT: { label: "Accept", icon: "check_circle" },
  DECLINE: { label: "Decline", icon: "cancel" },
  DEFER: { label: "Defer", icon: "snooze" },
  WITHDRAW: { label: "Withdraw", icon: "undo" },
};

/** The resulting status when an action is taken (internal UI status key). */
export const ACTION_TO_STATUS: Record<ConnectionActionType, ConnectionStatus> = {
  ACCEPT: "ACCEPTED",
  DECLINE: "DECLINED",
  DEFER: "DEFERRED",
  WITHDRAW: "WITHDRAWN",
};

/** Wire value the backend expects for a status (change-status API), keyed by our
 *  internal uppercase status. The UI keeps the uppercase keys; we translate here. */
export const CONNECTION_STATUS_API_VALUE: Record<ConnectionStatus, string> = {
  PENDING: "Pending",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  DEFERRED: "Deferred",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
};

/** Which actions are valid for a request, given who's viewing + its status.
 *  Defer is intentionally not offered for now (kept in the API/types for later). */
export function availableActions(direction: ConnectionDirection, status: ConnectionStatus): ConnectionActionType[] {
  if (!OPEN_STATUSES.includes(status)) return [];
  return direction === "received" ? ["ACCEPT", "DECLINE"] : ["WITHDRAW"];
}

/** Action options (value + label) for the dropdown, in the given context. */
export const actionOptions = (direction: ConnectionDirection, status: ConnectionStatus): Option[] =>
  availableActions(direction, status).map((a) => ({ value: a, label: CONNECTION_ACTION_META[a].label }));

/** Friendly role label. */
export const roleLabelFor = (role: Role): string => ROLE_META[role]?.label ?? role;

/** Role-tinted avatar gradient (matches the Explore card feel). */
export const ROLE_AVATAR_GRADIENT: Record<Role, string> = {
  startup: "from-secondary to-primary",
  investor: "from-primary to-secondary",
  b2b_enterprise: "from-tertiary to-primary",
  admin: "from-primary to-primary-dim",
  super_admin: "from-primary to-primary-dim",
};

/** Prototype badge palette (bg / text / border) — see `.badge.ok|warn|err|grey`. */
const BADGE = {
  ok: "bg-[#EAF5EF] text-[#1F7A4D]",
  warn: "bg-[#FFF4E0] text-[#8A5300]",
  err: "bg-[#FBEEED] text-[#9F403D]",
  grey: "border border-[#E3E8EE] bg-[#F6F8FA] text-[#5B6472]",
} as const;

/**
 * Status badge on a request card. Mirrors the prototype: accepted / declined /
 * withdrawn are always labelled, a pending request you SENT reads "Waiting for reply",
 * and a pending request you RECEIVED has no badge (the Accept / Decline buttons are the
 * signal). Viewed folds into Pending while `SHOW_VIEWED_STATUS` is off.
 */
export function requestBadge(r: { direction: ConnectionDirection; status: ConnectionStatus }): { label: string; className: string } | null {
  switch (displayStatus(r.status)) {
    case "ACCEPTED":
      return { label: "Accepted", className: BADGE.ok };
    case "DECLINED":
      return { label: "Declined", className: BADGE.err };
    case "WITHDRAWN":
      return { label: "Withdrawn", className: BADGE.grey };
    case "EXPIRED":
      return { label: "Expired", className: BADGE.grey };
    case "DEFERRED":
      return { label: "Deferred", className: BADGE.grey };
    case "VIEWED":
      return { label: "Viewed", className: BADGE.grey };
    default: // PENDING
      return r.direction === "sent" ? { label: "Waiting for reply", className: BADGE.warn } : null;
  }
}

/** Prototype's relative time: "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", else "5 Nov 2026". */
export function agoLabel(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) {
    const d = Math.floor(s / 86400);
    return d === 1 ? "yesterday" : `${d} days ago`;
  }
  const d = new Date(t);
  return `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
}

/** Prototype avatar palette — a name always hashes to the same colour. */
const AVATAR_COLORS = ["#0C56D0", "#1F7A4D", "#6B46C1", "#B26A00", "#9F403D", "#0E7C86", "#3D4F7A", "#A8456B"];
export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Reasons offered when declining a request (prototype's DECLINE_REASONS). */
export const DECLINE_REASONS = [
  "Profile incomplete",
  "Not relevant to my business",
  "Counterpart not verified",
  "Not the right time",
  "Other",
] as const;
/** Pre-selected reason (the prototype checks the second one). */
export const DEFAULT_DECLINE_REASON: string = DECLINE_REASONS[1];

/** Split the stored match rationale ("Strong X sector alignment. Both operate within Y.")
 *  into individual reasons for the checklist. */
export function rationaleReasons(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/(?<=\.)\s+/)
    .map((r) => r.trim())
    .filter(Boolean);
}
