/**
 * Single source of truth for the dynamic dashboard sidebar.
 *
 * The sidebar renders `DASHBOARD_NAV[role]` for the current role — to add, remove,
 * rename or reorder a role's menu, edit ONLY this file (same philosophy as
 * onboarding-steps.ts). Routes are nested under `/dashboard/*`; add the matching
 * `src/app/dashboard/<segment>/page.tsx` as each section is built out.
 */

import type { Role } from "@/lib/roles";

export interface NavItem {
  key: string;
  label: string;
  /** Material Symbols Outlined icon name. */
  icon: string;
  /** Absolute route under /dashboard. */
  route: string;
}

// Items shared across the three user roles — declared once, reused below.
const DASHBOARD: NavItem = { key: "dashboard", label: "Dashboard", icon: "space_dashboard", route: "/dashboard" };
// Reels temporarily hidden from all roles — uncomment to restore.
// const REELS: NavItem = { key: "reels", label: "Reels", icon: "smart_display", route: "/dashboard/reels" };
const AI_INSIGHTS: NavItem = { key: "ai-insights", label: "AI Insights", icon: "auto_awesome", route: "/dashboard/ai-insights" };
const DISCOVER: NavItem = { key: "discover", label: "Discover", icon: "explore", route: "/dashboard/discover" };
const EXPLORE: NavItem = { key: "explore", label: "Explore", icon: "groups", route: "/dashboard/explore" };
const CONNECTIONS: NavItem = { key: "connections", label: "Connections", icon: "hub", route: "/dashboard/connections" };
const DEAL_ROOM: NavItem = { key: "deal-room", label: "Deal Room", icon: "handshake", route: "/dashboard/deal-room" };
const SUBSCRIPTION: NavItem = { key: "subscription", label: "Subscription", icon: "card_membership", route: "/dashboard/subscription" };
const PROFILE: NavItem = { key: "profile", label: "Profile", icon: "account_circle", route: "/dashboard/profile" };

// Shared staff (admin / super_admin) menu — declared once, reused for both roles.
const ADMIN_OPT: NavItem[] = [
  DASHBOARD,
  { key: "matching-engine", label: "Matching Engine", icon: "join_inner", route: "/dashboard/matching-engine" },
  { key: "suggestion-weights", label: "Suggestion Weights", icon: "tune", route: "/dashboard/suggestion-weights" },
  { key: "members", label: "Members", icon: "group", route: "/dashboard/members" },
  { key: "verification-queue", label: "Verification Queue", icon: "verified_user", route: "/dashboard/verification-queue" },
  { key: "role-switch", label: "Role Switch", icon: "swap_horiz", route: "/dashboard/role-switch" },
  { key: "faq-management", label: "FAQ Management", icon: "quiz", route: "/dashboard/faq-management" },
  PROFILE,
];

const SUPER_ADMIN_OPT: NavItem[] = [
  DASHBOARD,
  { key: "matching-engine", label: "Matching Engine", icon: "join_inner", route: "/dashboard/matching-engine" },
  { key: "suggestion-weights", label: "Suggestion Weights", icon: "tune", route: "/dashboard/suggestion-weights" },
  { key: "members", label: "Members", icon: "group", route: "/dashboard/members" },
  { key: "verification-queue", label: "Verification Queue", icon: "verified_user", route: "/dashboard/verification-queue" },
  { key: "role-switch", label: "Role Switch", icon: "swap_horiz", route: "/dashboard/role-switch" },
  { key: "faq-management", label: "FAQ Management", icon: "quiz", route: "/dashboard/faq-management" },
  { key: "admin-management", label: "Admin Management", icon: "admin_panel_settings", route: "/dashboard/admin-management" },
  { key: "system-management", label: "System Management", icon: "settings", route: "/dashboard/system-management" },
  PROFILE,
];

/**
 * Support entry pinned at the bottom of the sidebar for ALL roles.
 * Points to the FAQ page — clicking "Support" shows the FAQ list.
 */
export const SUPPORT_NAV: NavItem = { key: "support", label: "Support", icon: "support_agent", route: "/dashboard/faq" };

export const DASHBOARD_NAV: Record<Role, NavItem[]> = {
  super_admin: SUPER_ADMIN_OPT,
  admin: ADMIN_OPT,
  startup: [
    DASHBOARD,
    // { key: "find-investors", label: "Find Investors", icon: "savings", route: "/dashboard/find-investors" },
    // REELS,
    AI_INSIGHTS,
    // DISCOVER,
    EXPLORE,
    CONNECTIONS,
    DEAL_ROOM,
    SUBSCRIPTION,
    PROFILE,
  ],
  investor: [
    DASHBOARD,
    // { key: "browse-startups", label: "Browse Startups", icon: "rocket_launch", route: "/dashboard/browse-startups" },
    // REELS,
    AI_INSIGHTS,
    // DISCOVER,
    EXPLORE,
    CONNECTIONS,
    DEAL_ROOM,
    SUBSCRIPTION,
    PROFILE,
  ],
  b2b_enterprise: [
    DASHBOARD,
    // { key: "match", label: "Match", icon: "join_inner", route: "/dashboard/match" },
    // REELS,
    // { key: "global", label: "Global", icon: "public", route: "/dashboard/global" },
    AI_INSIGHTS,
    { key: "expand", label: "Expand", icon: "open_in_full", route: "/dashboard/expand" },
    // DISCOVER,
    EXPLORE,
    CONNECTIONS,
    DEAL_ROOM,
    SUBSCRIPTION,
    PROFILE,
  ],
};

/** Primary mobile bottom-tab entry. */
export interface BottomTab {
  key: string;
  label: string;
  icon: string;
  route: string;
}

/**
 * Bottom tab bar (mobile) for the three user roles. A trailing "More" tab, added by
 * the layout, opens the full sidebar drawer. Staff roles have 8+ admin sections so
 * they keep the drawer only — no entry here means no bottom bar.
 */
const USER_BOTTOM_TABS: BottomTab[] = [
  { key: "home", label: "Home", icon: "home", route: "/dashboard" },
  { key: "introductions", label: "Introductions", icon: "group_add", route: "/dashboard/explore" },
  { key: "requests", label: "Requests", icon: "inbox", route: "/dashboard/connections" },
  { key: "rooms", label: "Rooms", icon: "handshake", route: "/dashboard/deal-room" },
];

export function getBottomTabsForRole(role: Role): BottomTab[] {
  return role === "startup" || role === "investor" || role === "b2b_enterprise" ? USER_BOTTOM_TABS : [];
}

/** Nav items for a role (empty array if the role is unknown). */
export function getNavForRole(role: Role): NavItem[] {
  return DASHBOARD_NAV[role] ?? [];
}