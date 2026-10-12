import { Icon } from "@/components/ui/Icon";
import type { KycStatus, KycReviewStatus } from "@/types/api.types";

/**
 * Monochrome status metadata + the shared pill used across the admin screens. Our
 * theme avoids status colors, so a status is shown as a neutral pill = a Material
 * Symbols icon + a label. Mapping + render live here so the User Management table/
 * drawer and the KYC Review list/drawer never duplicate them.
 */

export interface StatusMeta {
  label: string;
  icon: string;
}

/** User KYC status (VERIFIED / PENDING / REJECTED). */
export const KYC_STATUS_META: Record<KycStatus, StatusMeta> = {
  VERIFIED: { label: "Verified", icon: "verified" },
  PENDING: { label: "Pending", icon: "schedule" },
  REJECTED: { label: "Rejected", icon: "cancel" },
};

/** KYC review/submission status (PENDING / APPROVED / REJECTED). */
export const KYC_REVIEW_STATUS_META: Record<KycReviewStatus, StatusMeta> = {
  PENDING: { label: "Pending", icon: "schedule" },
  APPROVED: { label: "Approved", icon: "task_alt" },
  REJECTED: { label: "Rejected", icon: "cancel" },
};

/** Simple verified/unverified flag (email / mobile confirmation). */
export const VERIFY_META = {
  VERIFIED: { label: "Verified", icon: "check_circle" },
  UNVERIFIED: { label: "Unverified", icon: "cancel" },
} as const;

/** Account state (Active / Suspended), driven by `is_user_suspended`. */
export const USER_STATUS_META: Record<"ACTIVE" | "SUSPENDED", StatusMeta> = {
  ACTIVE: { label: "Active", icon: "check_circle" },
  SUSPENDED: { label: "Suspended", icon: "block" },
};

/** Neutral icon + label pill (no status colors, per our theme). */
export function StatusPill({ icon, label }: StatusMeta) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
      <Icon name={icon} size={14} />
      {label}
    </span>
  );
}
