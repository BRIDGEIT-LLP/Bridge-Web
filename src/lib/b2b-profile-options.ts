/**
 * Option lists + taxonomy for the B2B Enterprise role-specific profile fields
 * (complete-profile step). Kept alongside the startup/investor options so the
 * choices can be edited later without touching the UI components.
 */

import type { Option } from "@/lib/startup-profile-options";

export type { Option };

/**
 * Sectors (multi-select). One shared list for every role (startup, investor, B2B), saved in the
 * `primary_sector` column and used by the matching engine. Sub-sector (B2B) is free text.
 */
export const PRIMARY_SECTORS: Option[] = [
  { value: "fmcg", label: "FMCG" },
  { value: "food_processing", label: "Food processing" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "packaging", label: "Packaging" },
  { value: "export_import", label: "Export and import" },
  { value: "logistics", label: "Logistics" },
  { value: "fintech", label: "Fintech" },
  { value: "agritech", label: "Agritech" },
  { value: "retail_tech", label: "Retail tech" },
  { value: "supply_chain", label: "Supply chain" },
  { value: "steel_metals", label: "Steel and metals" },
  { value: "textiles", label: "Textiles" },
  { value: "healthcare", label: "Healthcare" },
];

/** Business Type — gates whether MOQ is required. */
export const BUSINESS_TYPES: Option[] = [
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
  { value: "both", label: "Both" },
];

/** Business types for which MOQ is mandatory. */
export const MOQ_REQUIRED_TYPES = ["product", "both"];

/** Annual Revenue Band (single select, INR). */
export const REVENUE_BANDS: Option[] = [
  { value: "lt_1cr", label: "Less than ₹1 Cr" },
  { value: "1_10cr", label: "₹1 Cr – ₹10 Cr" },
  { value: "10_50cr", label: "₹10 Cr – ₹50 Cr" },
  { value: "50_250cr", label: "₹50 Cr – ₹250 Cr" },
  { value: "gt_250cr", label: "More than ₹250 Cr" },
];

/** Export Readiness (single select). */
export const EXPORT_READINESS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "in_progress", label: "In Progress" },
];

/** Business Intent (single select — used by the AI matching engine). */
export const BUSINESS_INTENTS: Option[] = [
  { value: "seeking_distributor", label: "Seeking Distributor" },
  { value: "seeking_supplier", label: "Seeking Supplier" },
  { value: "seeking_export_buyer", label: "Seeking Export Buyer" },
  { value: "seeking_manufacturing_partner", label: "Seeking Manufacturing Partner" },
  { value: "open_to_alliance", label: "Open to Alliance" },
];

/** Max characters for the structured free-text fields. */
export const PRODUCTS_MAX_CHARS = 1000;
export const REQUIREMENTS_MAX_CHARS = 1000;

/** "Where you sell" regions. Saved in the b2b_geography_country column (b2b_geography_continent is left empty). */
export const B2B_GEOGRAPHY_REGIONS: Option[] = [
  { value: "north_india", label: "North India" },
  { value: "south_india", label: "South India" },
  { value: "west_india", label: "West India" },
  { value: "east_india", label: "East India" },
  { value: "middle_east", label: "Middle East" },
  { value: "africa", label: "Africa" },
  { value: "europe", label: "Europe" },
  { value: "south_east_asia", label: "South-east Asia" },
];
