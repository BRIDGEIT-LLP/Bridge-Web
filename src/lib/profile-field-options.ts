/**
 * Maps each backend profile column (snake_case, as returned by
 * GET /api/v1/users/profile) to the SAME option list used in the registration
 * "complete-profile" flow, plus whether the field is single- or multi-select.
 *
 * The profile page uses this so its dropdowns offer the full set of registration
 * choices (e.g. every Primary Sector, every Country, every dial code) with the
 * API's stored value pre-selected — instead of relying on whatever (possibly
 * empty) `options` the API echoes back. To change a field's choices, edit the
 * underlying `*-profile-options` / `countries` list; this registry just wires the
 * column name to it.
 *
 * Column names mirror `toUserProfilePayload` in
 * `app/registration/complete-profile/page.tsx` (including backend spellings such
 * as `prefrerred_investment_stage` and `export_rediness`).
 */
import type { Option } from "@/lib/startup-profile-options";
import {
  INDUSTRY_SECTORS,
  FUNDING_STAGES,
  CURRENCIES,
  INTENT_OPTIONS,
} from "@/lib/startup-profile-options";
import {
  INVESTMENT_STAGES,
  INVESTOR_TYPES,
  PRIMARY_INTENT_OPTIONS,
} from "@/lib/investor-profile-options";
import {
  PRIMARY_SECTORS,
  SECTOR_OPTIONS,
  SECTOR_TAXONOMY,
  BUSINESS_TYPES,
  REVENUE_BANDS,
  EXPORT_READINESS,
  BUSINESS_INTENTS,
} from "@/lib/b2b-profile-options";
import { COUNTRIES, CONTINENTS, DIAL_CODES } from "@/lib/countries";

export interface FieldOptionConfig {
  options: Option[];
  /** true → multi-select (value is string[]); false → single-select. */
  multiple: boolean;
  /** Force the in-panel search box (defaults to Select's length-based rule). */
  searchable?: boolean;
}

/** Drop duplicate option values while preserving order. */
const dedupe = (opts: Option[]): Option[] => {
  const seen = new Set<string>();
  return opts.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
};

/**
 * The B2B sub-sector / vertical pickers are cascading in registration. On the
 * profile page each field stands alone, so we offer the flattened union of every
 * sub-sector / vertical across all sectors (enough to resolve the stored value to
 * a label and let the user re-pick).
 */
const ALL_SUB_SECTORS = dedupe(
  SECTOR_TAXONOMY.flatMap((s) => (s.children ?? []).map(({ value, label }) => ({ value, label }))),
);
const ALL_VERTICALS = dedupe(
  SECTOR_TAXONOMY.flatMap((s) =>
    (s.children ?? []).flatMap((ss) =>
      (ss.children ?? []).map(({ value, label }) => ({ value, label })),
    ),
  ),
);

const REGISTRY: Record<string, FieldOptionConfig> = {
  // ── common (every role) ──
  country: { options: COUNTRIES, multiple: false, searchable: true },
  continent: { options: CONTINENTS, multiple: false },
  primary_sector: { options: PRIMARY_SECTORS, multiple: true },
  // Phone dial code — column name varies by backend; map the likely spellings.
  country_code: { options: DIAL_CODES, multiple: false, searchable: true },
  mobile_country_code: { options: DIAL_CODES, multiple: false, searchable: true },
  phone_country_code: { options: DIAL_CODES, multiple: false, searchable: true },
  dial_code: { options: DIAL_CODES, multiple: false, searchable: true },

  // ── startup ──
  startup_industry_sector: { options: INDUSTRY_SECTORS, multiple: true },
  funding_stage: { options: FUNDING_STAGES, multiple: false },
  funding_currency: { options: CURRENCIES, multiple: false },
  startup_intent: { options: INTENT_OPTIONS, multiple: false },

  // ── investor ──
  prefrerred_investment_stage: { options: INVESTMENT_STAGES, multiple: true },
  investor_sector_preference: { options: INDUSTRY_SECTORS, multiple: true },
  geographic_investment_preference: { options: COUNTRIES, multiple: true, searchable: true },
  geographic_investment_preference_continent: { options: CONTINENTS, multiple: true },
  ticket_currency: { options: CURRENCIES, multiple: false },
  investor_type: { options: INVESTOR_TYPES, multiple: false },
  investor_intent: { options: PRIMARY_INTENT_OPTIONS, multiple: false },

  // ── b2b enterprise ──
  b2b_sector: { options: SECTOR_OPTIONS, multiple: false },
  b2b_sub_sector: { options: ALL_SUB_SECTORS, multiple: false },
  industry_vertical: { options: ALL_VERTICALS, multiple: false },
  business_type: { options: BUSINESS_TYPES, multiple: false },
  revenue_band: { options: REVENUE_BANDS, multiple: false },
  export_rediness: { options: EXPORT_READINESS, multiple: false },
  b2b_intent: { options: BUSINESS_INTENTS, multiple: false },
  b2b_geography_country: { options: COUNTRIES, multiple: true, searchable: true },
  b2b_geography_continent: { options: CONTINENTS, multiple: true },
};

/**
 * Option config for a profile column, or `null` if the column isn't a known
 * choice field (then the page falls back to its API-driven rendering).
 */
export function getFieldOptionConfig(columnName: string): FieldOptionConfig | null {
  if (!columnName) return null;
  return REGISTRY[columnName] ?? REGISTRY[columnName.toLowerCase()] ?? null;
}

/**
 * Columns rendered as a multi-line textarea — matching the registration flow,
 * where these are `<Textarea>` (not a single-line input). Used to override the
 * API's `type` when it reports a plain string.
 */
export const TEXTAREA_COLUMNS = new Set([
  "short_bio",
  "use_of_funds",
  "business_description",
  "investor_portfolio_overview",
  "products_ervice_Offered",
  "business_requirements",
  "operational_capacity_description",
  "investment_thesis",
  "address",
]);

/**
 * Columns rendered as a numeric input — matching the registration flow, where
 * these are `<Input type="number">`.
 */
export const NUMBER_COLUMNS = new Set([
  "funding_ask_amt_min",
  "funding_ask_amt_max",
  "team_size_min",
  "team_size_max",
  "ticket_size_amt_min",
  "ticket_size_amt_max",
  "number_of_investments_to_date",
  "min_order_quantity",
  "years_in_operation",
]);

/**
 * Startup "Funding Ask Amount" group — currency + min + max rendered as one row
 * (mirrors the registration widget). The page folds these three columns into a
 * single control when `funding_ask_amt_min` is present.
 */
export const FUNDING_CURRENCY_COL = "funding_currency";
export const FUNDING_MIN_COL = "funding_ask_amt_min";
export const FUNDING_MAX_COL = "funding_ask_amt_max";

/**
 * Investor "Ticket Size" group — same currency + min + max widget as registration.
 */
export const TICKET_CURRENCY_COL = "ticket_currency";
export const TICKET_MIN_COL = "ticket_size_amt_min";
export const TICKET_MAX_COL = "ticket_size_amt_max";

/**
 * Backend column → the EXACT label the registration flow shows for it, copied
 * verbatim from `onboarding/StartupProfileFields.tsx`,
 * `InvestorProfileFields.tsx`, `B2BProfileFields.tsx` and
 * `registration/complete-profile/page.tsx`.
 *
 * The switch-role page renders fields the user has never filled in before, so it
 * must name them exactly as registration did — otherwise the same question reads
 * two different ways in the same product. Consumed through `fieldLabel()`, which
 * falls back to whatever the API sent, so an unmapped column still renders.
 *
 * Not read by the My Profile pages: those keep showing the API's own label.
 */
const FIELD_LABELS: Record<string, string> = {
  // ── account details ──
  organization_name: "Company Name",
  role: "Role",
  company_email: "Email",
  mobile_number: "Phone",
  country_code: "Country Code",
  gst_number: "GST Number",
  cin_number: "CIN Number",

  // ── personal info (every role) ──
  first_name: "First Name",
  last_name: "Last Name",
  country: "Country",
  continent: "Continent",
  primary_sector: "Primary Sector",
  short_bio: "Short Bio",
  profile_photo: "Profile Photo",

  // ── startup ──
  startup_industry_sector: "Industry Sector",
  funding_stage: "Funding Stage",
  // Registration renders one "Team Size" select; the backend splits it in two.
  team_size_min: "Team Size",
  team_size_max: "Team Size",
  // Likewise one "Funding Ask Amount" widget over three columns.
  funding_currency: "Currency",
  funding_ask_amt_min: "Funding Ask Amount",
  funding_ask_amt_max: "Funding Ask Amount",
  use_of_funds: "Use of Funds",
  business_description: "Business Description",
  startup_intent: "Intent",
  founders: "Founders & LinkedIn",
  incorporation_certificate: "Incorporation Certificate",
  pitch_deck_certificate: "Pitch Deck (PDF, max 20 MB)",

  // ── investor ──
  investor_sector_preference: "Sector Preferences",
  prefrerred_investment_stage: "Preferred Investment Stages",
  ticket_size_amt_min: "Ticket Size",
  ticket_size_amt_max: "Ticket Size",
  geographic_investment_preference: "Geographic Investment Preference",
  investor_type: "Investor Type",
  investor_intent: "Primary Intent",
  investor_portfolio_overview: "Portfolio Overview",
  number_of_investments_to_date: "Number of Investments to Date",
  ticket_currency: "Currency",
  investment_thesis: "Investment Thesis",
  geographic_investment_preference_continent: "Geographic Investment Preference",
  // Configured in `user_profile_field_master` but not collected by registration —
  // named here so the profile / switch-role forms label it consistently.
  stage_focus: "Stage Focus",

  // ── b2b enterprise ──
  b2b_sector: "Sector",
  b2b_sub_sector: "Sub-Sector",
  industry_vertical: "Industry Vertical",
  business_type: "Business Type",
  min_order_quantity: "Min Order Quantity (MOQ)",
  revenue_band: "Revenue Band",
  years_in_operation: "Years in Operation",
  export_rediness: "Export Readiness",
  b2b_intent: "Business Intent",
  products_ervice_Offered: "Products / Services Offered",
  business_requirements: "Business Requirements",
  operational_capacity_description: "Operational Capacity Description",
  b2b_geography_country: "Geographies",
  b2b_geography_continent: "Geographies",
  // Registration says "Registered Office / Residential Address (as per government ID)"
  // for investors and drops the parenthetical for b2b. One column, so the shorter
  // role-neutral wording wins (same rule as the LinkedIn / Website labels below).
  address: "Registered Office / Residential Address",

  // ── links ──
  // Registration says "Company LinkedIn" for startups and "LinkedIn Profile" for
  // investor / b2b. One column, so the role-neutral wording wins.
  company_website_url: "Company Website",
  linkedin_profile_url: "LinkedIn Profile",
};

/** Registration's label for a column, falling back to the API's own label. */
export function fieldLabel(columnName: string, fallback?: string): string {
  return FIELD_LABELS[columnName] ?? fallback ?? columnName;
}
