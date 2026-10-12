/**
 * Presentation helpers for Explore match cards — turning the raw Matching Engine
 * fields (role enums, profile ids) into display-ready labels and assets.
 */

import type { ExploreMatch, ExploreMatchRole } from "@/types/api.types";

/** Friendly label for a match's account role. */
export const ROLE_LABEL: Record<ExploreMatchRole, string> = {
  INVESTOR: "Investor",
  B2B: "B2B Enterprise",
  STARTUP: "Startup",
};

/** Material Symbols icon per role. */
export const ROLE_ICON: Record<ExploreMatchRole, string> = {
  INVESTOR: "payments",
  B2B: "domain",
  STARTUP: "rocket_launch",
};

/** Token-based gradient per role — the avatar/background shown when there's no profile pic. */
export const ROLE_GRADIENT: Record<ExploreMatchRole, string> = {
  INVESTOR: "from-primary to-secondary",
  B2B: "from-tertiary to-primary",
  STARTUP: "from-secondary to-primary-container",
};

/** Prettify a backend tag/enum for display (e.g. "ai_ml" → "Ai Ml"). */
export function prettyTag(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Prettify + join a list of backend tags (e.g. ["ai_ml","saas"] → "Ai Ml, Saas"). */
export function prettyList(values?: string[] | null): string {
  if (!values || values.length === 0) return "";
  return values.map(prettyTag).join(", ");
}

/** "IN · Asia" from country + continent (skips blanks). */
export function formatLocation(country?: string | null, continent?: string | null): string {
  return [country, continent ? prettyTag(continent) : null].filter(Boolean).join(" · ");
}

/** Compact INR amount range, e.g. (10000000, 15000000) → "₹1Cr – ₹1.5Cr". */
export function formatAmountRange(min?: number, max?: number): string {
  const fmt = (n: number) =>
    `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  if (max != null) return `Up to ${fmt(max)}`;
  return "";
}

/** Up to two uppercase initials from a name (e.g. "Tech_8" → "TE"). */
export function companyInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** A contact entry shown on the card (only present ones returned). */
export interface ContactLink {
  icon: string;
  /** Navigable target (used by the grid card's links). */
  href: string;
  /** Human-readable value shown as text (e.g. the email, phone, or URL). */
  value: string;
  /** Short label / tooltip (e.g. "LinkedIn"). */
  label: string;
}

export function contactLinks(match: ExploreMatch): ContactLink[] {
  const linkedin = match.linkedin_profile_url || match.linkedin_url;
  const links: (ContactLink | null)[] = [
    match.mobile_number
      ? { icon: "call", href: `tel:${match.mobile_number}`, value: match.mobile_number, label: "Phone" }
      : null,
    match.company_email
      ? { icon: "mail", href: `mailto:${match.company_email}`, value: match.company_email, label: "Email" }
      : null,
    linkedin ? { icon: "link", href: linkedin, value: linkedin, label: "LinkedIn" } : null,
    match.company_website_url
      ? { icon: "language", href: match.company_website_url, value: match.company_website_url, label: "Website" }
      : null,
  ];
  return links.filter((l): l is ContactLink => l !== null);
}

/** Role-specific label/value facts (investor vs b2b), skipping empty fields. */
export function roleFacts(match: ExploreMatch): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") facts.push({ label, value: String(value) });
  };

  if (match.role === "INVESTOR") {
    add("Ticket Size", formatAmountRange(match.ticket_size_amt_min, match.ticket_size_amt_max));
    add("Investor Type", match.investor_type ? prettyTag(match.investor_type) : "");
    add("Stage", prettyList(match.prefrerred_investment_stage));
    add("Sector Pref.", prettyList(match.investor_sector_preference));
    add("Geo Focus", match.geographic_investment_preference?.join(", "));
    add("Investments", match.number_of_investments_to_date);
    add("Intent", match.investor_intent ? prettyTag(match.investor_intent) : "");
  } else if (match.role === "B2B") {
    add("Sector", match.b2b_sector ? prettyTag(match.b2b_sector) : "");
    add("Sub-sector", match.b2b_sub_sector ? prettyTag(match.b2b_sub_sector) : "");
    add("Vertical", match.industry_vertical ? prettyTag(match.industry_vertical) : "");
    add("Revenue", match.revenue_band ? prettyTag(match.revenue_band) : "");
    add("MOQ", match.min_order_quantity);
    add("Export Ready", match.export_rediness ? prettyTag(match.export_rediness) : "");
    add("Experience", match.years_in_operation != null ? `${match.years_in_operation} yrs` : "");
    add("Offering", match.products_ervice_Offered);
    add("Intent", match.b2b_intent ? prettyTag(match.b2b_intent) : "");
  }
  return facts;
}
