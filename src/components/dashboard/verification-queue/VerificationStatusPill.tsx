import type { VerificationCheckStatus } from "@/types/api.types";

/**
 * Colored status pill for the Verification queue screen only (FRD §12.5). The rest of
 * the admin console deliberately avoids status colors (see kyc-status.tsx), but the new
 * design system for this screen (Bridge_App_Design.pdf, "Design system" page) specifies
 * real success/error/warning colors, so this is a separate, scoped component rather
 * than a change to the shared monochrome StatusPill.
 */

const STYLES: Record<VerificationCheckStatus, { label: string; bg: string; fg: string }> = {
  PASSED: { label: "Passed", bg: "#EAF5EF", fg: "#1F7A4D" },
  FAILED: { label: "Failed", bg: "#FBEEED", fg: "#9F403D" },
  CHECK: { label: "Check", bg: "#FDF3E2", fg: "#B26A00" },
  WAITING: { label: "Waiting", bg: "#F6F8FA", fg: "#5B6472" },
  NOT_NEEDED: { label: "Not needed", bg: "#F6F8FA", fg: "#5B6472" },
};

export function VerificationStatusPill({ status }: { status: VerificationCheckStatus }) {
  const style = STYLES[status] ?? STYLES.WAITING;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}
