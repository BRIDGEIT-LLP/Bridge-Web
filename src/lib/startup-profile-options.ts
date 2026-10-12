/**
 * Option lists + shared regex for the startup role-specific profile fields
 * (complete-profile step). Kept in one place so the choices can be edited later
 * without touching the UI components.
 */

export interface Option {
  value: string;
  label: string;
}

/** Industry Sector (multi-select). */
export const INDUSTRY_SECTORS: Option[] = [
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "ai_ml", label: "AI / ML" },
  { value: "deeptech", label: "Deep Tech" },
  { value: "cleantech", label: "Cleantech" },
  { value: "agritech", label: "Agritech" },
  { value: "logistics", label: "Logistics & Mobility" },
  { value: "consumer", label: "Consumer & Retail" },
  { value: "gaming", label: "Gaming & Entertainment" },
  { value: "other", label: "Other" },
];

/** Funding Stage (single select). */
export const FUNDING_STAGES: Option[] = [
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "growth", label: "Growth Stage" },
];

/** Team Size (single select range buckets). */
export const TEAM_SIZE_RANGES: Option[] = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "200+", label: "200+" },
];

/** Currency for the funding-ask amount range. */
export const CURRENCIES: Option[] = [
  { value: "INR", label: "INR (₹)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
];

/** Investment intent (single select). */
export const INTENT_OPTIONS: Option[] = [
  { value: "seed_investment", label: "Seeking Seed Investment" },
  { value: "angel_investor", label: "Seeking Angel Investor" },
  { value: "strategic_partner", label: "Seeking Strategic Partner" },
  { value: "open_to_acquisition", label: "Open to Acquisition" },
];

/** Max words allowed in the business description. */
export const BUSINESS_DESCRIPTION_MAX_WORDS = 500;

/** Accepted MIME type for the PDF document uploads (size limits: `DOC_MAX_MB`). */
export const PITCH_DECK_ACCEPT = "application/pdf";

/** General URL validation (http/https). */
export const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/** HTML `pattern` attribute string for a LinkedIn URL (native validation). */
export const LINKEDIN_URL_PATTERN = "https?://([\\w-]+\\.)?linkedin\\.com/.*";
