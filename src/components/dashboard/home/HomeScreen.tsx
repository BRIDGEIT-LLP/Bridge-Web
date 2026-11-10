"use client";

import { HomeGreetingHeader } from "./HomeGreetingHeader";
import { DiscoveryTrialBanner } from "./DiscoveryTrialBanner";
import { HomeStatRow, type HomeStat } from "./HomeStatRow";
import { TopIntroductionsPanel } from "./TopIntroductionsPanel";
import { RequestsForYouPanel } from "./RequestsForYouPanel";
import { DealRoomsPanel } from "./DealRoomsPanel";
import { VouchWidget } from "./VouchWidget";
import { relativeTime } from "@/components/dashboard/deal-room/deal-room-meta";
import type { HomeDashboardData } from "@/types/dashboard";

const DUE_DILIGENCE_STAGE_INDEX = 2;

function buildStats(home: HomeDashboardData): HomeStat[] {
  const oldestRequest = home.requestsForYou
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  const inDueDiligence = home.dealRooms.filter((room) => room.stage === DUE_DILIGENCE_STAGE_INDEX).length;

  return [
    {
      label: "Introductions waiting",
      value: String(home.introductionsWaitingCount),
      caption: "Ranked by compatibility",
    },
    {
      label: "Requests to answer",
      value: String(home.requestsForYou.length),
      caption: oldestRequest ? `Oldest ${relativeTime(oldestRequest.createdAt)}` : "All caught up",
    },
    {
      label: "Active deal rooms",
      value: String(home.dealRooms.length),
      caption: inDueDiligence > 0 ? `${inDueDiligence} in due diligence` : "On track",
    },
    {
      label: "Requests this month",
      value: `${home.monthlyRequests.sent}/${home.monthlyRequests.limit || "—"}`,
      caption: "Resets monthly",
    },
  ];
}

/**
 * S10 Home screen — shared across Startup/Investor/B2B (the design treats Home
 * as role-agnostic; the Matching Engine already returns role-appropriate
 * candidates). Layout: greeting header, 4 flat stat cards, then a 2-column
 * split — Top Introductions on the left (wider), Requests/Deal rooms/Vouch
 * stacked on the right — collapsing to a single column below `lg`.
 * Responsive down to 375px (FRD §13.7).
 */
export function HomeScreen({ firstName, home }: { firstName: string; home: HomeDashboardData }) {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      <HomeGreetingHeader firstName={firstName} />
      <DiscoveryTrialBanner membership={home.membership} />
      <HomeStatRow stats={buildStats(home)} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopIntroductionsPanel matches={home.topIntroductions} />
        </div>
        <div className="flex flex-col gap-6">
          <RequestsForYouPanel requests={home.requestsForYou} />
          <DealRoomsPanel dealRooms={home.dealRooms} />
          <VouchWidget vouch={home.vouch} />
        </div>
      </div>
    </div>
  );
}
