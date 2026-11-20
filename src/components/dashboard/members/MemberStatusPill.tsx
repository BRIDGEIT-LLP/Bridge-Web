/**
 * Colored status pill for the Members screen (FRD §12.5, Bridge_App_Design.pdf S50),
 * using the design system's real success/error/warning colors — a scoped exception
 * to the shared monochrome `StatusPill` (see VerificationStatusPill for the same
 * precedent on the Verification queue screen).
 */

import type { AdminUserListItem } from "@/types/api.types";

const META: Record<AdminUserListItem["memberStatus"], { label: string; bg: string; fg: string }> = {
  MEMBER: { label: "Member", bg: "#EAF5EF", fg: "#1F7A4D" },
  PAYMENT_FAILED: { label: "Payment failed", bg: "#FBEEED", fg: "#9F403D" },
  TRIAL: { label: "Trial", bg: "#FDF3E2", fg: "#B26A00" },
};

export function MemberStatusPill({ status }: { status: AdminUserListItem["memberStatus"] }) {
  const { label, bg, fg } = META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}
