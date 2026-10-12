/**
 * Option lists + taxonomy for the B2B Enterprise role-specific profile fields
 * (complete-profile step). Kept alongside the startup/investor options so the
 * choices can be edited later without touching the UI components. Shared lists
 * (sectors) and regexes are re-exported from `startup-profile-options`.
 */

import { INDUSTRY_SECTORS, type Option } from "@/lib/startup-profile-options";

export type { Option };

/** Primary Sector (multi-select) — reuses the shared industry sector list. */
export const PRIMARY_SECTORS: Option[] = INDUSTRY_SECTORS;

/**
 * Sector → Sub-Sector → Industry Vertical taxonomy (cascading single-selects).
 *
 * NOTE: This is PLACEHOLDER data so the cascade is functional end-to-end.
 * Replace `SECTOR_TAXONOMY` with the canonical taxonomy when available — the UI
 * and helpers below derive everything from this one structure.
 */
export interface TaxonomyNode {
  value: string;
  label: string;
  children?: TaxonomyNode[];
}

export const SECTOR_TAXONOMY: TaxonomyNode[] = [
  {
    value: "manufacturing",
    label: "Manufacturing",
    children: [
      {
        value: "industrial_machinery",
        label: "Industrial Machinery",
        children: [
          { value: "cnc_machines", label: "CNC Machines" },
          { value: "packaging_machinery", label: "Packaging Machinery" },
          { value: "material_handling", label: "Material Handling" },
        ],
      },
      {
        value: "auto_components",
        label: "Auto Components",
        children: [
          { value: "engine_parts", label: "Engine Parts" },
          { value: "electricals", label: "Electricals & Electronics" },
          { value: "body_chassis", label: "Body & Chassis" },
        ],
      },
    ],
  },
  {
    value: "textiles_apparel",
    label: "Textiles & Apparel",
    children: [
      {
        value: "fabrics",
        label: "Fabrics & Yarn",
        children: [
          { value: "cotton", label: "Cotton" },
          { value: "synthetic", label: "Synthetic" },
          { value: "technical_textiles", label: "Technical Textiles" },
        ],
      },
      {
        value: "garments",
        label: "Garments",
        children: [
          { value: "menswear", label: "Menswear" },
          { value: "womenswear", label: "Womenswear" },
          { value: "kidswear", label: "Kidswear" },
        ],
      },
    ],
  },
  {
    value: "agriculture_food",
    label: "Agriculture & Food",
    children: [
      {
        value: "processed_foods",
        label: "Processed Foods",
        children: [
          { value: "packaged_snacks", label: "Packaged Snacks" },
          { value: "beverages", label: "Beverages" },
          { value: "dairy", label: "Dairy Products" },
        ],
      },
      {
        value: "agri_commodities",
        label: "Agri Commodities",
        children: [
          { value: "grains_pulses", label: "Grains & Pulses" },
          { value: "spices", label: "Spices" },
          { value: "fresh_produce", label: "Fresh Produce" },
        ],
      },
    ],
  },
  {
    value: "technology",
    label: "Technology & IT",
    children: [
      {
        value: "software_services",
        label: "Software & Services",
        children: [
          { value: "saas", label: "SaaS" },
          { value: "it_consulting", label: "IT Consulting" },
          { value: "managed_services", label: "Managed Services" },
        ],
      },
      {
        value: "hardware_electronics",
        label: "Hardware & Electronics",
        children: [
          { value: "components", label: "Components" },
          { value: "iot_devices", label: "IoT Devices" },
          { value: "networking", label: "Networking Equipment" },
        ],
      },
    ],
  },
  {
    value: "healthcare_pharma",
    label: "Healthcare & Pharma",
    children: [
      {
        value: "pharmaceuticals",
        label: "Pharmaceuticals",
        children: [
          { value: "apis", label: "APIs & Bulk Drugs" },
          { value: "formulations", label: "Formulations" },
          { value: "nutraceuticals", label: "Nutraceuticals" },
        ],
      },
      {
        value: "medical_devices",
        label: "Medical Devices",
        children: [
          { value: "diagnostics", label: "Diagnostics" },
          { value: "surgical", label: "Surgical Instruments" },
          { value: "consumables", label: "Consumables" },
        ],
      },
    ],
  },
];

/** Map a list of taxonomy nodes to plain `{ value, label }` options. */
const toOptions = (nodes: TaxonomyNode[] = []): Option[] =>
  nodes.map(({ value, label }) => ({ value, label }));

/** Top-level Sector options. */
export const SECTOR_OPTIONS: Option[] = toOptions(SECTOR_TAXONOMY);

/** Sub-Sector options for a given sector value ([] if none/unknown). */
export function subSectorOptions(sector: string): Option[] {
  return toOptions(SECTOR_TAXONOMY.find((s) => s.value === sector)?.children);
}

/** Industry Vertical options for a given sector + sub-sector ([] if unknown). */
export function verticalOptions(sector: string, subSector: string): Option[] {
  const sub = SECTOR_TAXONOMY.find((s) => s.value === sector)?.children?.find(
    (ss) => ss.value === subSector,
  );
  return toOptions(sub?.children);
}

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
