// src/types/dashboard.ts

import type { ExploreMatch } from "./api.types";
import type { ConnectionRequest } from "./api.types";
import type { DealRoom } from "@/components/dashboard/deal-room/types";

export interface UserDashboardData {
  profile?: {
    firstName: string;
    lastName: string;
    organizationName: string;
    role: string;
    isActive: boolean;
    kycStatus: string;
  };
  stats?: {
    connectionsSent: number;
    connectionsReceived: number;
    connectionsAccepted: number;
    activeDealRooms: number;
    kycDocumentsCount: number;
    upcomingMeetingsCount: number;
    profileViews: number;
    watchlistCount: number;
  };
}

/** Dummy Vouch/Referral data — no backing model yet (FRD §3.7 not built). */
export interface VouchWidgetData {
  vouchCode: string;
  totalVouched: number;
  pendingInvites: number;
  freeMonthsEarned: number;
  recentVouches: { name: string; organizationName: string; status: string }[];
}

/** S10 Home screen widget set (GET /users/dashboard/home). */
export interface HomeDashboardData {
  /** Count of candidates the matching engine currently returns (capped at its own
   *  limit) — "Introductions waiting" stat card. */
  introductionsWaitingCount: number;
  topIntroductions: ExploreMatch[];
  requestsForYou: ConnectionRequest[];
  dealRooms: DealRoom[];
  monthlyRequests: {
    sent: number;
    limit: number;
    remaining: number;
  };
  /** Discovery-trial status — `trialDaysRemaining` is null once the user has an
   *  active (paid) subscription. */
  membership: {
    hasActiveSubscription: boolean;
    trialDaysRemaining: number | null;
  };
  vouch: VouchWidgetData;
}

export interface AdminDashboardData {
  adminProfile?: {
    name: string;
    role: string;
  };
  stats?: {
    totalUsers: number;
    suspendedUsers: number;
    newRegistrationsLast7Days: number;
    kycPending: number;
    kycApproved: number;
    kycRejected: number;
  };
}

export interface SuperAdminDashboardData {
  adminProfile?: {
    name: string;
    role: string;
  };
  stats?: {
    totalUsers: number;
    totalOrganizations: number;
    kycPending: number;
    activeToday: number;
    kycApproved: number;
    kycRejected: number;
    suspendedUsers: number;
    newRegistrationsLast7Days: number;
    totalAdmins: number;
    activeAdmins: number;
    suspendedAdmins: number;
  };
}
