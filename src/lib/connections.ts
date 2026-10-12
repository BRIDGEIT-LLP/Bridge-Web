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

export type StatusFilter = "ALL" | ConnectionStatus;

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

/** Statuses offered in the filter dropdown (Accepted intentionally excluded). */
export const CONNECTION_STATUS_ORDER: ConnectionStatus[] = [
  "PENDING",
  "VIEWED",
  "DEFERRED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
];

/** Options for the status filter dropdown. */
export const STATUS_FILTER_OPTIONS: Option[] = [
  { value: "ALL", label: "All" },
  ...CONNECTION_STATUS_ORDER.map((s) => ({ value: s, label: CONNECTION_STATUS_META[s].label })),
];

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

/** Which actions are valid for a request, given who's viewing + its status. */
export function availableActions(direction: ConnectionDirection, status: ConnectionStatus): ConnectionActionType[] {
  if (direction === "received") {
    if (status === "PENDING" || status === "VIEWED") return ["ACCEPT", "DEFER", "DECLINE"];
    if (status === "DEFERRED") return ["ACCEPT", "DECLINE"];
    return [];
  }
  // sent (I'm the sender)
  if (status === "PENDING" || status === "VIEWED") return ["WITHDRAW"];
  return [];
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
