/**
 * Option lists for the investor role-specific profile fields (complete-profile
 * step). Kept alongside the startup options so the choices can be edited later
 * without touching the UI components. Shared lists (sectors, currencies) and
 * regexes are re-exported from `startup-profile-options` to avoid duplication.
 */

import { FUNDING_STAGES, type Option } from "@/lib/startup-profile-options";

export type { Option };

/**
 * Preferred Investment Stages (multi-select). Same buckets as the startup
 * funding stages — re-exported under an investor-facing name.
 */
export const INVESTMENT_STAGES: Option[] = FUNDING_STAGES;

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
