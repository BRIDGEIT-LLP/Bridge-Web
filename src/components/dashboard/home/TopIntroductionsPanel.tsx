"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { companyInitials, formatLocation } from "@/lib/explore-format";
import { avatarColorClass } from "./avatar-color";
import type { ExploreMatch } from "@/types/api.types";

/** S10 "Top introductions for you" panel — the user's top 3 AI matches, as a
 *  vertical list of rows (name, role/company/location, lead-with-the-reason
 *  rationale, "NN% fit" on the right), matching the design's Home layout. */
export function TopIntroductionsPanel({ matches }: { matches: ExploreMatch[] }) {
  return (
    <Card surface="lowest" padding="md">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-base font-bold text-on-surface sm:text-lg">
            Top introductions for you
          </h2>
          <p className="text-xs text-on-surface-variant sm:text-sm">
            Here&apos;s who we think you should meet.
          </p>
        </div>
        <Link
          href="/dashboard/explore"
          className="shrink-0 text-xs font-semibold text-primary hover:underline sm:text-sm"
        >
          See all
        </Link>
      </div>

      {matches.length === 0 ? (
        <p className="mt-4 text-sm text-on-surface-variant">
          No matches yet — check back soon as more profiles join.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-outline-variant/30">
          {matches.map((match) => {
            const fullName = [match.first_name, match.last_name].filter(Boolean).join(" ").trim();
            const location = formatLocation(match.country, match.continent);
            const displayName = fullName || match.organization_name;
            return (
              <li key={match.profileId}>
                <Link
                  href="/dashboard/explore"
                  className="flex items-start gap-3 py-3 transition-colors hover:bg-surface-container/60"
                >
                  <Avatar photoKey={match.profile_photo} alt={displayName} className="size-9 shrink-0 rounded-full">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColorClass(displayName)}`}
                    >
                      {companyInitials(displayName)}
                    </div>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">{displayName}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {match.organization_name}
                      {location ? ` · ${location}` : ""}
                    </p>
                    {match.rationale && (
                      <p className="mt-0.5 truncate text-xs text-on-surface-variant">{match.rationale}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-headline text-sm font-extrabold text-primary">
                      {match.compatibility}%
                    </p>
                    <p className="text-[10px] text-on-surface-variant">fit</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
