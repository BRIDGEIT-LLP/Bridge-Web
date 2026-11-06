/**
 * Option lists for the investor role-specific profile fields (complete-profile
 * step). Kept alongside the startup options so the choices can be edited later
 * without touching the UI components. Shared lists (sectors, currencies) and
 * regexes are re-exported from `startup-profile-options` to avoid duplication.
 */

import type { Option } from "@/lib/startup-profile-options";

export type { Option };

/**
 * Preferred Investment Stages (multi-select chips, "Stages you invest in").
 * Same values as the startup funding stages; labels are the investor-facing ones.
 */
export const INVESTMENT_STAGES: Option[] = [
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "growth", label: "Growth" },
];

/** Investor Type (single select). */
export const INVESTOR_TYPES: Option[] = [
  { value: "angel", label: "Angel Investor" },
  { value: "vc", label: "Venture Capital" },
  { value: "family_office", label: "Family Office" },
  { value: "corporate", label: "Corporate Investor" },
  { value: "other", label: "Other" },
];

/** Primary Intent (single select — exactly one required). */
export const PRIMARY_INTENT_OPTIONS: Option[] = [
  { value: "actively_deploying", label: "Actively Deploying Capital" },
  { value: "selectively_investing", label: "Selectively Investing" },
  { value: "open_to_co_investment", label: "Open to Co-Investment" },
];

/** Max words allowed in the portfolio overview. */
export const PORTFOLIO_MAX_WORDS = 300;

/** "Where you invest" regions. Saved in geographic_investment_preference (the continent column is left empty). */
export const INVESTOR_GEOGRAPHY_REGIONS: Option[] = [
  { value: "north_india", label: "North India" },
  { value: "south_india", label: "South India" },
  { value: "west_india", label: "West India" },
  { value: "east_india", label: "East India" },
  { value: "middle_east", label: "Middle East" },
  { value: "south_east_asia", label: "South-east Asia" },
];
