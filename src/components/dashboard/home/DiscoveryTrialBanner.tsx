"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { HomeDashboardData } from "@/types/dashboard";

/** S10 Home screen banner shown while the user is on the free Discovery trial
 *  (i.e. hasn't opted into a paid membership yet) — mirrors the prototype's
 *  "You're on the Discovery trial, N days left..." messaging. */
export function DiscoveryTrialBanner({ membership }: { membership: HomeDashboardData["membership"] }) {
  // `false` is the only value that means "confirmed on the free trial" — `true` and
  // `null` (status unknown) must both suppress the banner, so a lookup failure never
  // tells a paying member they're on trial.
  if (membership.hasActiveSubscription !== false) {
    return null;
  }

  const daysLeft = membership.trialDaysRemaining ?? 0;
  const daysLabel = daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl bg-primary-container/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <Icon name="schedule" size={18} className="shrink-0 text-primary" />
        <p className="text-sm text-on-surface">
          You&apos;re on the Discovery trial, {daysLabel}. You can see what&apos;s waiting; introductions open when you
          become a member.
        </p>
      </div>
      <Link
        href="/dashboard/subscription"
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-center text-xs font-bold text-on-primary transition-colors hover:opacity-90 sm:text-sm"
      >
        Become a member
      </Link>
    </div>
  );
}
