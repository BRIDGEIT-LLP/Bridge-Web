"use client";

import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/layout/navbar";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch, type FieldErrors } from "react-hook-form";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Loader } from "@/components/common/loader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/modal/Modal";
import { ProfilePreview } from "@/components/onboarding/ProfilePreview";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountSummary } from "@/components/onboarding/AccountSummary";
import { ONBOARDING_STEPS, stepNumber } from "@/lib/onboarding-steps";
import "../registration.css";
import { useOnboarding, type OnboardingData } from "@/components/onboarding/OnboardingProvider";
import { COUNTRIES, CONTINENTS, continentForCountry, DIAL_CODES } from "@/lib/countries";
import { phoneErrorForDialCode, nationalDigits } from "@/lib/validation";
import { PRIMARY_SECTORS } from "@/lib/b2b-profile-options";
import { URL_REGEX } from "@/lib/startup-profile-options";
import {
  StartupProfileFields,
  defaultStartupValues,
  parseFounders,
  type StartupValues,
  type Founder,
  type CompleteProfileForm,
} from "@/components/onboarding/StartupProfileFields";
import {
  InvestorProfileFields,
  defaultInvestorValues,
  type InvestorValues,
} from "@/components/onboarding/InvestorProfileFields";
import {
  B2BProfileFields,
  defaultB2BValues,
  type B2BValues,
} from "@/components/onboarding/B2BProfileFields";
import type { UserProfilePayload } from "@/types/api.types";
import { toast } from "sonner";
import { buildProfile, getUserProfile, type ProfileField } from "@/services/user.service";
import { scanImage } from "@/services/file.service";
import { VideoUploadField } from "@/components/onboarding/VideoUploadField";
import { DOC_TYPE } from "@/config/docTypes";
import type { ApiError } from "@/lib/axios";

/** Matches the backend's `picUpload` multer config (PNG/JPEG only, 5MB). */
const PHOTO_MIME_TYPES = ["image/png", "image/jpeg"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Hard character cap for the short bio. */
const BIO_MAX_CHARS = 300;

/** State picker for the new UI's State / City row (UI-only for now: no backend column). */
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
].map((v) => ({ value: v, label: v }));

/** Human-readable labels for the role values captured at registration. */
const ROLE_LABELS: Record<string, string> = {
  startup: "Startup",
  investor: "Investor",
  b2b_enterprise: "B2B Enterprise",
};

/** "" → undefined; otherwise the parsed number (or undefined if not finite). */
const toFloat = (v: string): number | undefined => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};
const toInt = (v: string): number | undefined => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Team-size range bucket → min/max ("11-50" → {11,50}; "200+" → {200, undefined}). */
const parseTeamSize = (v: string): { min?: number; max?: number } => {
  if (!v) return {};
  if (v.endsWith("+")) return { min: toInt(v), max: undefined };
  const [min, max] = v.split("-");
  return { min: toInt(min ?? ""), max: toInt(max ?? "") };
};

/** Repeatable Founders & LinkedIn rows → `{ name, url }[]` for the jsonb column. */
function normalizeFounders(rows: Founder[] | undefined): { name: string; url: string }[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const rec = row && typeof row === "object" ? (row as { name?: unknown; url?: unknown }) : {};
      return { name: String(rec.name ?? "").trim(), url: String(rec.url ?? "").trim() };
    })
    .filter((f) => f.name.length > 0 && f.url.length > 0);
}

/**
 * Drop only `undefined` / `null`, so the payload carries EVERY field the role's form
 * shows — an untouched optional field is sent as `""` / `[]` rather than vanishing.
 *
 * It used to strip blank strings and empty arrays too, which made a build-profile
 * payload an unreliable picture of the form: a field left empty looked identical to a
 * field that was never mapped, and clearing a value could not be saved. Numeric columns
 * are still safe — `toFloat` / `toInt` return `undefined` for blank input, so `""` never
 * reaches a FLOAT/INTEGER column.
 */
function prune(obj: UserProfilePayload): UserProfilePayload {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    out[k] = val;
  }
  return out as UserProfilePayload;
}

/**
 * First `{ message }` in react-hook-form's nested error tree, with its dotted path
 * (e.g. "investor.address"). Depth-first, so it matches the field nearest the top of
 * the form. Used to tell the user *why* a submit was blocked.
 */
function firstError(
  errors: unknown,
  path: string[] = [],
): { path: string; message: string } | null {
  if (!errors || typeof errors !== "object") return null;
  const rec = errors as Record<string, unknown>;
  if (typeof rec.message === "string" && rec.message) {
    return { path: path.join("."), message: rec.message };
  }
  for (const [key, value] of Object.entries(rec)) {
    const found = firstError(value, [...path, key]);
    if (found) return found;
  }
  return null;
}

/**
 * True for a value we'd treat as "not filled in yet": "", undefined, null, [],
 * or the empty founder placeholder `[{ name: "", url: "" }]`.
 *
 * That placeholder is the form default for Founders & LinkedIn. Without treating
 * it as blank, mergeKeepingFilled keeps it over GET /users/profile and the saved
 * name + URL never appear when the page is reopened.
 */
function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    return value.every((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      const rec = row as { name?: unknown; url?: unknown };
      return String(rec.name ?? "").trim() === "" && String(rec.url ?? "").trim() === "";
    });
  }
  return false;
}

/**
 * Field-by-field merge of the live form against an incoming (fetched/default) one:
 * anything the user has already filled in `live` wins, blank fields fall back to
 * `incoming`. Recurses one level into plain objects — which is exactly the shape of
 * the `startup` / `investor` / `b2b` sections — so it protects in-progress input in
 * whichever role section is active without hardcoding field names per role.
 */
function mergeKeepingFilled<T extends object>(live: T, incoming: T): T {
  const liveRec = live as Record<string, unknown>;
  const incomingRec = incoming as Record<string, unknown>;
  const out: Record<string, unknown> = { ...liveRec };
  for (const key of Object.keys(incomingRec)) {
    const liveVal = liveRec[key];
    const incomingVal = incomingRec[key];
    if (
      liveVal && typeof liveVal === "object" && !Array.isArray(liveVal) &&
      incomingVal && typeof incomingVal === "object" && !Array.isArray(incomingVal)
    ) {
      out[key] = mergeKeepingFilled(liveVal as object, incomingVal as object);
    } else if (isBlank(liveVal)) {
      out[key] = incomingVal;
    }
  }
  return out as T;
}

const DEFAULT_COUNTRY = "IN";

/** ₹ Cr (the new UI's unit) to rupees, or undefined when blank/invalid. 1 Cr = 10,000,000. */
const crToRupees = (v?: string): number | undefined => {
  const n = toFloat(v ?? "");
  return n === undefined ? undefined : Math.round(n * 1e7);
};
/** Rupees back to ₹ Cr for prefilling the new UI's field from a saved profile. */
const rupeesToCr = (v: string): string => {
  const n = toFloat(v);
  return n === undefined ? "" : String(Number((n / 1e7).toFixed(4)));
};

/** Map the camelCase form values to the backend `user` table columns (snake_case). */
function toUserProfilePayload(values: CompleteProfileForm, role: string): UserProfilePayload {
  const common: UserProfilePayload = {
    first_name: values.firstName,
    last_name: values.lastName,
    profile_photo: values.photo,
    // Optional — omitted entirely when no video was added.
    intro_video: values.introVideo || undefined,
    short_bio: values.bio,
    // Country/continent live in the optional "more about you" block. The new UI is India-only (state + city),
    // so a blank country defaults to India instead of blocking the user.
    country: values.country || DEFAULT_COUNTRY,
    continent: values.continent || continentForCountry(values.country || DEFAULT_COUNTRY),
    state: values.state,
    city: values.city,
    mobile_number: nationalDigits(values.contact),
    country_code: values.countryCode,
    company_email: values.email,
    primary_sector: values.primarySectors,
  };

  if (role === "startup") {
    const s = values.startup;
    const team = parseTeamSize(s.teamSize);
    return prune({
      ...common,
      organization_name: values.legalName,
      linkedin_profile_url: s.linkedinUrl,
      company_website_url: s.websiteUrl,
      startup_industry_sector: s.industrySectors,
      funding_stage: s.fundingStage,
      funding_currency: s.fundingCurrency,
      // The optional legacy min/max win; otherwise the new UI's single "Raising (₹ Cr)" becomes the ask.
      funding_ask_amt_min: toFloat(s.fundingMin),
      funding_ask_amt_max: toFloat(s.fundingMax) ?? crToRupees(s.raisingCr),
      use_of_funds: s.useOfFunds,
      team_size_min: team.min,
      team_size_max: team.max,
      incorporation_certificate: s.incorporationCert,
      pitch_deck_certificate: s.pitchDeck,
      business_description: s.businessDescription,
      startup_intent: s.intent,
      // Always send the key so User.update writes the jsonb column (even as []).
      founders: normalizeFounders(s.founders),
    });
  }

  if (role === "investor") {
    const i = values.investor;
    return prune({
      ...common,
      organization_name: values.legalName,
      linkedin_profile_url: i.linkedinUrl,
      company_website_url: i.websiteUrl,
      // The optional legacy currency + min/max win; otherwise the new UI's ₹ Cr cheque range is stored in INR.
      ticket_size_amt_min: toFloat(i.ticketMin) ?? crToRupees(i.ticketMinCr),
      ticket_size_amt_max: toFloat(i.ticketMax) ?? crToRupees(i.ticketMaxCr),
      ticket_currency: toFloat(i.ticketMin) !== undefined || toFloat(i.ticketMax) !== undefined ? i.ticketCurrency : "INR",
      prefrerred_investment_stage: i.investmentStages,
      investor_sector_preference: i.sectorPreferences,
      geographic_investment_preference: i.geoCountries,
      geographic_investment_preference_continent: i.geoContinents,
      investor_type: i.investorType,
      investor_portfolio_overview: i.portfolioOverview,
      investment_thesis: i.investmentThesis,
      number_of_investments_to_date: toInt(i.numberOfInvestments),
      investor_intent: i.primaryIntent,
      address: i.address,
    });
  }

  if (role === "b2b_enterprise") {
    const b = values.b2b;
    return prune({
      ...common,
      organization_name: b.businessName,
      linkedin_profile_url: b.linkedinUrl,
      company_website_url: b.websiteUrl,
      b2b_sector: b.sector,
      b2b_sub_sector: b.subSector,
      business_type: b.businessType,
      industry_vertical: b.industryVertical,
      revenue_band: b.revenueBand,
      min_order_quantity: toInt(b.moq),
      export_rediness: b.exportReadiness,
      years_in_operation: toFloat(b.yearsInOperation),
      b2b_geography_country: b.geoCountries,
      b2b_geography_continent: b.geoContinents,
      products_ervice_Offered: b.productsServices,
      business_requirements: b.businessRequirements,
      b2b_intent: b.businessIntent,
      operational_capacity_description: b.operationalCapacity || undefined,
      address: b.address,
    });
  }

  return prune(common);
}

/** Reverse of `parseTeamSize`: two numbers back to their bucket ("11-50", "200+"). */
function teamSizeToBucket(min?: number, max?: number): string {
  if (min === undefined) return "";
  const bucket = TEAM_SIZE_RANGES_BY_MIN[min];
  if (!bucket) return "";
  return bucket.max === max ? bucket.value : "";
}
const TEAM_SIZE_RANGES_BY_MIN: Record<number, { value: string; max: number | undefined }> = {
  1: { value: "1-10", max: 10 },
  11: { value: "11-50", max: 50 },
  51: { value: "51-200", max: 200 },
  200: { value: "200+", max: undefined },
};

/** Keep only string entries — `founders` is `[{ name, url }, …]`, not option codes. */
function stringEntries(value: unknown[]): string[] {
  return value.filter((v): v is string => typeof v === "string");
}

/** GET /users/profile's array type comes back as a real array, or a JSON/CSV string. */
function fieldToArray(value: ProfileField["value"] | undefined): string[] {
  if (Array.isArray(value)) return stringEntries(value);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return stringEntries(parsed);
    } catch { /* not JSON — fall through to CSV split */ }
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
/**
 * Scalar field value → plain string; "" for anything missing/array-shaped. The
 * `String()` matters: numeric columns arrive from the API as real JSON numbers.
 */
function fieldToString(value: ProfileField["value"] | undefined): string {
  if (value === undefined || value === null || Array.isArray(value)) return "";
  return String(value);
}

/** Same shape as the form, but every field — including nested role sections — is optional. */
interface ProfilePrefillPatch extends Partial<Omit<CompleteProfileForm, "startup" | "investor" | "b2b">> {
  startup?: Partial<StartupValues>;
  investor?: Partial<InvestorValues>;
  b2b?: Partial<B2BValues>;
}

/**
 * Reverse of `toUserProfilePayload`: turns GET /users/profile's flat, role-configured
 * field list back into the form's (nested, camelCase) shape, so a returning user whose
 * onboarding localStorage never had this data (different browser/device/session — the
 * profile GET is the only reliable source once that's the case) still sees it prefilled.
 * Only fields the backend actually returned are included, so nothing here clobbers a
 * value already present from the registration-wizard's local state.
 */
function buildProfilePrefillPatch(fields: ProfileField[], role: string): ProfilePrefillPatch {
  const byColumn = new Map(fields.map((f) => [f.columnName, f.value]));
  const str = (col: string) => fieldToString(byColumn.get(col));
  const arr = (col: string) => fieldToArray(byColumn.get(col));
  const has = (col: string) => byColumn.has(col) && fieldToString(byColumn.get(col)) !== "";
  const hasArr = (col: string) => byColumn.has(col) && fieldToArray(byColumn.get(col)).length > 0;

  const patch: ProfilePrefillPatch = {};
  if (has("first_name")) patch.firstName = str("first_name");
  if (has("last_name")) patch.lastName = str("last_name");
  if (has("short_bio")) patch.bio = str("short_bio");
  if (has("country")) patch.country = str("country");
  if (has("continent")) patch.continent = str("continent");
  if (has("state")) patch.state = str("state");
  if (has("city")) patch.city = str("city");
  if (hasArr("primary_sector")) patch.primarySectors = arr("primary_sector");
  // The stored picture's storage key. `buildFormDefaults` always starts this at "" —
  // the onboarding wizard's localStorage only ever held it for the current session —
  // so without this a returning user's saved photo never reaches the preview circle.
  if (has("profile_photo")) patch.photo = str("profile_photo");
  if (has("intro_video")) patch.introVideo = str("intro_video");
  // Locked "Account Details" fields — GET /users/profile is authoritative here too,
  // so a returning user on a fresh session (no registration-wizard state) still sees
  // the real values instead of a blank locked field.
  if (has("company_email")) patch.email = str("company_email");
  if (has("mobile_number")) patch.contact = str("mobile_number");
  if (has("country_code")) patch.countryCode = str("country_code");
  if (has("gst_number")) patch.gstNumber = str("gst_number");
  if (has("cin_number")) patch.cinNumber = str("cin_number");

  const linkedinUrl = str("linkedin_profile_url");
  const websiteUrl = str("company_website_url");

  if (role === "startup") {
    const startup: Partial<StartupValues> = {};
    if (hasArr("startup_industry_sector")) startup.industrySectors = arr("startup_industry_sector");
    if (has("funding_stage")) startup.fundingStage = str("funding_stage");
    if (has("funding_currency")) startup.fundingCurrency = str("funding_currency");
    if (has("funding_ask_amt_min")) startup.fundingMin = str("funding_ask_amt_min");
    if (has("funding_ask_amt_max")) startup.fundingMax = str("funding_ask_amt_max");
    if (has("use_of_funds")) startup.useOfFunds = str("use_of_funds");
    if (has("team_size_min")) {
      const bucket = teamSizeToBucket(toFloat(str("team_size_min")), toFloat(str("team_size_max")));
      if (bucket) startup.teamSize = bucket;
    }
    if (has("incorporation_certificate")) startup.incorporationCert = str("incorporation_certificate");
    if (has("pitch_deck_certificate")) startup.pitchDeck = str("pitch_deck_certificate");
    if (has("business_description")) startup.businessDescription = str("business_description");
    if (has("startup_intent")) startup.intent = str("startup_intent");
    // jsonb column — array of {name, url}, sometimes a JSON string.
    const founders = parseFounders(byColumn.get("founders"));
    if (founders.length > 0) startup.founders = founders;
    if (linkedinUrl) startup.linkedinUrl = linkedinUrl;
    if (websiteUrl) startup.websiteUrl = websiteUrl;
    if (Object.keys(startup).length > 0) patch.startup = startup;
  }

  if (role === "investor") {
    const investor: Partial<InvestorValues> = {};
    if (has("ticket_size_amt_min")) investor.ticketMin = str("ticket_size_amt_min");
    if (has("ticket_size_amt_max")) investor.ticketMax = str("ticket_size_amt_max");
    if (has("ticket_currency")) investor.ticketCurrency = str("ticket_currency");
    // Saved INR amounts also fill the new UI's ₹ Cr fields.
    if (has("ticket_size_amt_min") && (!has("ticket_currency") || str("ticket_currency") === "INR")) investor.ticketMinCr = rupeesToCr(str("ticket_size_amt_min"));
    if (has("ticket_size_amt_max") && (!has("ticket_currency") || str("ticket_currency") === "INR")) investor.ticketMaxCr = rupeesToCr(str("ticket_size_amt_max"));
    if (hasArr("prefrerred_investment_stage")) investor.investmentStages = arr("prefrerred_investment_stage");
    if (hasArr("investor_sector_preference")) investor.sectorPreferences = arr("investor_sector_preference");
    if (hasArr("geographic_investment_preference")) investor.geoCountries = arr("geographic_investment_preference");
    if (hasArr("geographic_investment_preference_continent")) {
      investor.geoContinents = arr("geographic_investment_preference_continent");
    }
    if (has("investor_type")) investor.investorType = str("investor_type");
    if (has("investor_portfolio_overview")) investor.portfolioOverview = str("investor_portfolio_overview");
    if (has("investment_thesis")) investor.investmentThesis = str("investment_thesis");
    if (has("number_of_investments_to_date")) investor.numberOfInvestments = str("number_of_investments_to_date");
    if (has("investor_intent")) investor.primaryIntent = str("investor_intent");
    if (has("address")) investor.address = str("address");
    if (linkedinUrl) investor.linkedinUrl = linkedinUrl;
    if (websiteUrl) investor.websiteUrl = websiteUrl;
    if (Object.keys(investor).length > 0) patch.investor = investor;
  }

  if (role === "b2b_enterprise") {
    const b2b: Partial<B2BValues> = {};
    if (has("organization_name")) b2b.businessName = str("organization_name");
    if (has("b2b_sector")) b2b.sector = str("b2b_sector");
    if (has("b2b_sub_sector")) b2b.subSector = str("b2b_sub_sector");
    if (has("business_type")) b2b.businessType = str("business_type");
    if (has("industry_vertical")) b2b.industryVertical = str("industry_vertical");
    if (has("revenue_band")) b2b.revenueBand = str("revenue_band");
    if (has("min_order_quantity")) b2b.moq = str("min_order_quantity");
    if (has("export_rediness")) b2b.exportReadiness = str("export_rediness");
    if (has("years_in_operation")) b2b.yearsInOperation = str("years_in_operation");
    if (hasArr("b2b_geography_country")) b2b.geoCountries = arr("b2b_geography_country");
    if (hasArr("b2b_geography_continent")) b2b.geoContinents = arr("b2b_geography_continent");
    if (has("products_ervice_Offered")) b2b.productsServices = str("products_ervice_Offered");
    if (has("business_requirements")) b2b.businessRequirements = str("business_requirements");
    if (has("b2b_intent")) b2b.businessIntent = str("b2b_intent");
    if (has("operational_capacity_description")) b2b.operationalCapacity = str("operational_capacity_description");
    if (has("address")) b2b.address = str("address");
    if (linkedinUrl) b2b.linkedinUrl = linkedinUrl;
    if (websiteUrl) b2b.websiteUrl = websiteUrl;
    if (Object.keys(b2b).length > 0) patch.b2b = b2b;
  }

  return patch;
}

/**
 * Builds the form's default values from onboarding state. Pulled out so it can be
 * reused both by `useForm`'s initial `defaultValues` (captured once at mount — stale
 * on a genuine fresh page load, since `OnboardingProvider`'s localStorage-load effect
 * hasn't populated `data` yet at that point: child effects fire before parent effects
 * within a commit) and by the prefill effect below, which re-derives it once `data`
 * has actually loaded so locked fields sourced only from `data` (legalName, role —
 * GET /users/profile doesn't return either) don't stay stuck blank forever.
 */
function buildFormDefaults(data: OnboardingData): CompleteProfileForm {
  return {
    firstName: (data.firstName as string) ?? "",
    lastName: (data.lastName as string) ?? "",
    bio: (data.bio as string) ?? "",
    country: (data.country as string) ?? "",
    continent: (data.continent as string) ?? "",
    state: (data.state as string) ?? "",
    city: (data.city as string) ?? "",
    primarySectors: (data.primarySectors as string[]) ?? [],
    legalName: (data.legalName as string) ?? "",
    email: (data.email as string) ?? "",
    countryCode: (data.countryCode as string) || "+91",
    contact: (data.contact as string) ?? "",
    role: (data.role as string) ?? "",
    gstNumber: (data.gstNumber as string) ?? "",
    cinNumber: (data.cinNumber as string) ?? "",
    photo: "",
    introVideo: (data.introVideo as string) ?? "",
    startup: { ...defaultStartupValues, ...((data.startup as Partial<StartupValues>) ?? {}) },
    investor: { ...defaultInvestorValues, ...((data.investor as Partial<InvestorValues>) ?? {}) },
    b2b: {
      ...defaultB2BValues,
      // Business Name comes from GST verification later; pre-fill from the
      // company name captured at registration for now.
      businessName: (data.legalName as string) ?? "",
      ...((data.b2b as Partial<B2BValues>) ?? {}),
    },
  };
}

/** True when a watched form value counts as "filled in" for the completeness ring. */
function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return !isBlank(v);
  return true;
}

/**
 * Completeness ring value for the new UI. Approximation: share of filled leaf values across
 * the shared fields plus the active role section. (The prototype weights required/recommended/
 * optional 70/20/10; the real form's required rules are enforced by validation instead.)
 */
function profileCompleteness(values: CompleteProfileForm, role: string): number {
  const section =
    role === "startup" ? values.startup : role === "investor" ? values.investor : role === "b2b_enterprise" ? values.b2b : {};
  const leaves: unknown[] = [
    values.firstName,
    values.lastName,
    values.country,
    values.primarySectors,
    values.bio,
    values.photo,
    ...Object.entries(section ?? {})
      .filter(([k]) => !/intent/i.test(k))
      .map(([, v]) => v),
  ];
  const filled = leaves.filter(hasValue).length;
  return Math.round((filled / leaves.length) * 100);
}

export default function CompleteProfilePage() {
  const { data, setData, goNext, isDataLoaded } = useOnboarding();
  // Local object URL for the preview circle; the form value holds the uploaded s3Key.
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Snapshot of the form taken when Preview is clicked. Captured at click time
  // (not in render) so it reflects the latest values from the uncontrolled inputs.
  const [previewData, setPreviewData] = useState<CompleteProfileForm | null>(null);

  const router = useRouter();
  const [aboutLegacyOpen, setAboutLegacyOpen] = useState(false);
  const role = String(data.role ?? "");
  // New UI splits the profile into "About you" and a role-specific tab. Both stay mounted
  // (hidden) so react-hook-form keeps every field registered and validates the whole form.
  const [tab, setTab] = useState<"about" | "role">("about");

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileForm>({
    // Captured once at mount — see buildFormDefaults' doc comment for why the prefill
    // effect below re-derives this instead of trusting it stays in sync with `data`.
    defaultValues: buildFormDefaults(data),
  });

  const roleKey = role === "startup" ? "startup" : role === "investor" ? "investor" : role === "b2b_enterprise" ? "b2b" : null;
  const stepNo = stepNumber("profile");

  // Save as draft: whatever is filled in is written to the database (build-profile in draft mode, which does not
  // complete the profile and records the step) and kept in the onboarding blob (localStorage) as well.
  const [savedAt, setSavedAt] = useState<number | null>(data.draftSavedAt ? Number(data.draftSavedAt) : null);
  const saveDraft = async () => {
    const v = getValues();
    try {
      await buildProfile(toUserProfilePayload(v, role), { step: "profile" });
    } catch (err) {
      const e = err as ApiError;
      const fieldErrs = (e.data as { data?: { field: string; message: string }[] } | undefined)?.data;
      toast.error(fieldErrs?.[0]?.message ?? e.message ?? "Could not save your draft. Please try again.");
      return;
    }
    const now = Date.now();
    setData({
      firstName: v.firstName,
      lastName: v.lastName,
      bio: v.bio,
      country: v.country,
      continent: v.continent,
      state: v.state,
      city: v.city,
      primarySectors: v.primarySectors,
      introVideo: v.introVideo,
      ...(role === "startup" ? { startup: v.startup } : {}),
      ...(role === "investor" ? { investor: v.investor } : {}),
      ...(role === "b2b_enterprise" ? { b2b: v.b2b } : {}),
      draftSavedAt: now,
    });
    setSavedAt(now);
    toast.success("Draft saved. You can close this tab and pick up later.");
  };
  const draftLabel = savedAt ? `at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";

  const allValues = useWatch({ control }) as CompleteProfileForm;
  const completeness = profileCompleteness(allValues, role);
  const roleTabLabel = role === "startup" ? "Your raise" : role === "investor" ? "How you invest" : "Your business";
  const bio = useWatch({ control, name: "bio" });
  const bioChars = (bio ?? "").length;
  // The saved picture's storage key (from GET /users/profile). `photo` above is only
  // set for a file picked in THIS session, so this is what shows an already-stored
  // photo when the page is reopened.
  const photoKey = useWatch({ control, name: "photo" });

  // The form above defaults from the registration-wizard's local (localStorage) state,
  // which is empty whenever this page is reached any other way (a returning user on a
  // fresh session/device/browser — see the login-MFA redirect fix). GET /users/profile
  // is the authoritative source once that's the case, so fetch it once `data` has
  // actually loaded and fill in anything the wizard state didn't already have.
  //
  // Gated on `isDataLoaded` rather than running unconditionally on mount: on a genuine
  // fresh page load, OnboardingProvider and this page mount in the same commit, and
  // React fires child effects before parent effects — so an unconditional effect here
  // would fire (and close over `role`/`data`) before OnboardingProvider's own mount
  // effect has read localStorage and populated `data`. `role` would be captured as ""
  // forever for that mount, silently skipping the startup/investor/b2b patch below.
  // Waiting for isDataLoaded means the effect (re-)runs on the render where `data` and
  // `role` are guaranteed current, and rebuilding the base from `data` again (rather
  // than trusting `getValues()`, which still holds the stale mount-time defaultValues
  // at that point) is what actually fixes the locked fields GET /users/profile doesn't
  // cover (legalName, role) — merely re-running the fetch wouldn't have helped those.
  useEffect(() => {
    if (!isDataLoaded) return;
    let cancelled = false;
    getUserProfile()
      .then((res) => {
        // The fetch can take long enough for the user to have already started typing.
        // Merge onto the live snapshot (mergeKeepingFilled) rather than reset()-ing
        // straight to the fetched patch, so any field they've already filled in any
        // role section — startup, investor, or b2b — survives regardless of exactly
        // when this resolves relative to their typing.
        if (cancelled) return;
        const patch = buildProfilePrefillPatch(res.data ?? [], role);
        const base = buildFormDefaults(data);
        const fetched: CompleteProfileForm = {
          ...base,
          ...patch,
          startup: { ...base.startup, ...(patch.startup ?? {}) },
          investor: { ...base.investor, ...(patch.investor ?? {}) },
          b2b: { ...base.b2b, ...(patch.b2b ?? {}) },
        };
        // `keepDirtyValues` is the belt to mergeKeepingFilled's braces: RHF itself
        // refuses to overwrite any field the user has already edited, so a slow
        // profile GET can never wipe input typed while it was in flight.
        const merged = mergeKeepingFilled(getValues(), fetched);
        reset(merged, { keepDirtyValues: true });
        // useFieldArray + keepDirtyValues can leave the empty placeholder row in
        // place even after reset. Force the saved rows onto the field array.
        const founders = parseFounders(merged.startup?.founders);
        if (founders.length > 0) {
          setValue("startup.founders", founders, { shouldDirty: false });
        }
      })
      .catch(() => {
        // No saved profile yet, or a transient failure — re-derive from `data` alone so
        // the now-current onboarding state (legalName/role included) still lands even
        // though the API had nothing to add. Same keep-what's-filled merge.
        if (cancelled) return;
        const merged = mergeKeepingFilled(getValues(), buildFormDefaults(data));
        reset(merged, { keepDirtyValues: true });
        const founders = parseFounders(merged.startup?.founders);
        if (founders.length > 0) {
          setValue("startup.founders", founders, { shouldDirty: false });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded]);

  /**
   * Validation blocked the submit. Without this, `handleSubmit(onSubmit)` fails
   * silently — the button does nothing and the offending field can be far off-screen
   * (the role sections are long), so it reads as "the form ate my input".
   * Surfaces the first message and scrolls/focuses its field.
   */
  const onInvalid = (formErrors: FieldErrors<CompleteProfileForm>) => {
    const first = firstError(formErrors);
    if (!first) return;
    // Reveal the tab that holds the offending field before focusing it.
    setTab(/^(startup|investor|b2b)\./.test(first.path) ? "role" : "about");
    toast.error(first.message);
    // The previous-UI fields live in a collapsible block; let React open it before focusing.
    setTimeout(() => {
      const el = document.getElementById(first.path.split(".").pop() ?? "");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus?.();
    }, 50);
  };

  /**
   * The new UI collects intent on the next screen, which completes the profile. Here the profile is stored in
   * the database as a draft (resuming lands on the Intent step); the payload is also held in onboarding state.
   */
  const onSubmit = async (values: CompleteProfileForm) => {
    const profilePayload = toUserProfilePayload(values, role);
    try {
      await buildProfile(profilePayload, { step: "intent" });
    } catch (err) {
      const e = err as ApiError;
      const fieldErrs = (e.data as { data?: { field: string; message: string }[] } | undefined)?.data;
      toast.error(fieldErrs?.[0]?.message ?? e.message ?? "Couldn't save your profile. Please try again.");
      return;
    }
    setData({
      firstName: values.firstName,
      lastName: values.lastName,
      bio: values.bio,
      country: values.country,
      continent: values.continent,
      state: values.state,
      city: values.city,
      primarySectors: values.primarySectors,
      photo: values.photo,
      introVideo: values.introVideo,
      countryCode: values.countryCode,
      contact: nationalDigits(values.contact),
      ...(role === "startup" ? { startup: values.startup } : {}),
      ...(role === "investor" ? { investor: values.investor } : {}),
      ...(role === "b2b_enterprise" ? { b2b: values.b2b } : {}),
      profilePayload,
    });
    goNext("profile");
  };

  const summary = {
    firstName: allValues.firstName,
    lastName: allValues.lastName,
    legalName: allValues.legalName,
    email: allValues.email,
    countryCode: allValues.countryCode,
    contact: allValues.contact,
  };

  return (
    <div className="bp bp-profile">
      <div className="ob">
        <div className="ob-top">
          <Link className="brand" href="/" aria-label="Bridge Platform home">
            <BrandLockup />
          </Link>
          <div className="hstack">
            {savedAt && (
              <p className="draft-note">
                <span>Draft saved {draftLabel}</span>
              </p>
            )}
            <button className="btn secondary sm" type="button" onClick={() => void saveDraft()}>
              Save as draft
            </button>
          </div>
        </div>

        <ol
          className="ob-progress"
          style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, 1fr)` }}
          aria-label="Application progress"
        >
          {ONBOARDING_STEPS.map((s, i) => (
            <li
              key={s.key}
              className={stepNo > i + 1 ? "done" : stepNo === i + 1 ? "current" : ""}
              aria-current={stepNo === i + 1 ? "step" : undefined}
            >
              {i + 1} {s.label}
            </li>
          ))}
        </ol>

        <main className="ob-main">
      <div className="ob-card wide">
        <Link className="back" href="/registration/business-check">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <h2>Your profile</h2>
            <p className="lede">
              This is what other members see before an introduction. Your email and mobile are already saved.
            </p>
          </div>
          <div
            className="ring"
            style={{ ["--p" as string]: completeness }}
            data-label={`${completeness}%`}
            title="Profile completeness"
            aria-label={`Profile ${completeness}% complete`}
          />
        </div>

        <div className="hstack" style={{ ["--g" as string]: "8px" }} role="tablist">
          {([
            ["about", "1 About you"],
            ["role", `2 ${roleTabLabel}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="chipsel"
              style={tab === key ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="stack">
          <div className={tab === "about" ? "flex flex-col gap-6" : "hidden"}>
          {/* New UI: one-line account summary (the full locked panel is kept in the collapsible block below). */}
          <AccountSummary {...summary} />

          {/* State and city are saved on the user (user.state / user.city) via build-profile. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="state"
              rules={{ required: "Add state" }}
              render={({ field }) => (
                <Select
                  variant="ux"
                  id="state"
                  label="State"
                  required
                  placeholder="Select a state"
                  options={INDIAN_STATES}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.state?.message}
                />
              )}
            />
            <Input
              variant="ux"
              id="city"
              label="City"
              required
              placeholder="Mumbai"
              error={errors.city?.message}
              {...register("city", { required: "Add city" })}
            />
          </div>

          {/* Sectors: same primarySectors field as before, shown as chips */}
          <Controller
            control={control}
            name="primarySectors"
            rules={{ validate: (v) => v.length > 0 || "Select at least one primary sector." }}
            render={({ field }) => (
              <div className="flex flex-col gap-2" id="primarySectors" tabIndex={-1}>
                <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">Sectors</span>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_SECTORS.map((o) => {
                    const on = field.value.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => field.onChange(on ? field.value.filter((v) => v !== o.value) : [...field.value, o.value])}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          on
                            ? "border-primary bg-primary-container font-semibold text-primary"
                            : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary/60"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {errors.primarySectors?.message && (
                  <span className="px-1 text-xs font-medium text-error">{errors.primarySectors.message}</span>
                )}
              </div>
            )}
          />

          {/* Short Bio */}
          <div className="flex flex-col gap-1">
            <Textarea
              id="bio"
              label="Short bio"
              required
              placeholder="What you do and who you serve"
              rows={3}
              error={errors.bio?.message}
              maxLength={BIO_MAX_CHARS}
              {...register("bio", {
                required: "Add short bio",
                maxLength: { value: BIO_MAX_CHARS, message: `Keep your bio under ${BIO_MAX_CHARS} characters.` },
              })}
            />
            <span className={`px-1 text-xs font-medium ${bioChars > BIO_MAX_CHARS ? "text-error" : "text-on-surface-variant"}`}>
              {bioChars} of {BIO_MAX_CHARS} characters
            </span>
          </div>

          {/* LinkedIn + website sit here in the new UI for every role (same <role>.linkedinUrl / websiteUrl fields). */}
          {roleKey && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                variant="ux"
                id="profileLinkedin"
                type="url"
                label="LinkedIn profile (recommended)"
                placeholder="https://linkedin.com/in/…"
                error={errors[roleKey]?.linkedinUrl?.message}
                {...register(`${roleKey}.linkedinUrl`, {
                  validate: (v) => !v || /linkedin\.com\//i.test(v) || "Enter a valid LinkedIn URL.",
                })}
              />
              <Input
                variant="ux"
                id="profileWebsite"
                type="url"
                label="Company website (recommended)"
                placeholder="https://"
                error={errors[roleKey]?.websiteUrl?.message}
                {...register(`${roleKey}.websiteUrl`, {
                  validate: (v) => !v || URL_REGEX.test(v) || "Enter a valid URL.",
                })}
              />
            </div>
          )}

          {/* NOT IN NEW UI: everything below is from the previous UI and is kept (photo, intro video, locked account
              panel, first/last name, country, continent). The block opens itself when one of them has an error. */}
          <details
            open={
              aboutLegacyOpen ||
              !!(errors.firstName || errors.lastName || errors.country || errors.contact || errors.countryCode)
            }
            onToggle={(ev) => setAboutLegacyOpen((ev.currentTarget as HTMLDetailsElement).open)}
            className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
          >
            <summary className="cursor-pointer text-sm font-semibold text-on-surface">
              More about you (from the previous form, not in the new design)
            </summary>
            <div className="mt-4 flex flex-col gap-6">

          {/* NOT IN NEW UI: profile photo (present in the previous UI, kept) */}
          {/* Profile picture */}
          <div className="flex flex-col gap-3">
            <span className="px-1 text-xs font-bold tracking-wide text-on-surface-variant">
              Profile Photo
            </span>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-outline-variant/30 bg-surface-container-low">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Profile preview" className="size-full object-cover" />
                ) : (
                  /* No file picked this session — show the already-saved photo, which
                     `Avatar` fetches from its storage key via /file/file-preview. */
                  <Avatar photoKey={photoKey} alt="Profile photo" className="size-full">
                    <Icon name="person" size={36} className="text-outline-variant" />
                  </Avatar>
                )}
              </div>
              <Controller
                control={control}
                name="photo"
                render={({ field }) => (
                  <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start sm:gap-3">
                      <label className="cursor-pointer whitespace-nowrap rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-outline-variant/60 hover:bg-surface-container sm:px-4">
                        {photoUploading ? "Uploading…" : "Upload photo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          disabled={photoUploading}
                          onChange={async (e) => {
                            const f = e.target.files?.[0] ?? null;
                            // Let the same file be re-picked after a failure.
                            e.target.value = "";
                            if (!f) return;
                            if (!PHOTO_MIME_TYPES.includes(f.type)) {
                              toast.error("Profile photo must be a PNG or JPEG image.");
                              return;
                            }
                            if (f.size > PHOTO_MAX_BYTES) {
                              toast.error("Profile photo must be 5MB or smaller.");
                              return;
                            }
                            setPhotoUploading(true);
                            try {
                              // Same scan+upload pipeline the KYC documents use; the backend
                              // files any non-KYC docType under `company/<id>/<user>/profile/`.
                              const { s3Key } = await scanImage(f, { docType: DOC_TYPE.PROFILE_PHOTO });
                              setPhoto(URL.createObjectURL(f));
                              field.onChange(s3Key);
                            } catch (err) {
                              toast.error((err as ApiError)?.message ?? "Couldn't upload your photo. Please try again.");
                            } finally {
                              setPhotoUploading(false);
                            }
                          }}
                        />
                      </label>
                      {(photo || field.value) && (
                        <button
                          type="button"
                          onClick={() => { setPhoto(null); field.onChange(""); }}
                          className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-error sm:px-4"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="px-1 text-center text-xs text-on-surface-variant sm:text-left">
                      JPG, GIF or PNG. Max size of 5MB
                    </p>
                  </div>
                )}
              />
            </div>
          </div>

          {/* NOT IN NEW UI: short intro video (present in the previous UI, kept) */}
          {/* Short intro video — optional */}
          <Controller
            control={control}
            name="introVideo"
            render={({ field }) => (
              <VideoUploadField
                label="Short Intro Video"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          {/* NOT IN NEW UI: the large locked "Account Details" panel (new UI shows a one-line summary). Kept from the previous UI. */}
          {/* Account details — captured at registration, shown locked */}
          <div className="flex flex-col gap-3">
            <span className="px-1 text-xs font-bold tracking-wide text-on-surface-variant">
              Account Details
            </span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                variant="ux"
                label="Company Name"
                required
                readOnly
                adornment={<Icon name="lock" size={18} />}
                adornmentClassName="text-outline-variant"
                className="cursor-not-allowed !bg-surface-container border-dashed text-on-surface-variant"
                {...register("legalName")}
              />
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Input
                    variant="ux"
                    label="Role"
                    required
                    readOnly
                    value={ROLE_LABELS[field.value] ?? field.value ?? ""}
                    adornment={<Icon name="lock" size={18} />}
                    adornmentClassName="text-outline-variant"
                    className="cursor-not-allowed !bg-surface-container border-dashed text-on-surface-variant"
                  />
                )}
              />
              <Input
                variant="ux"
                label="Email"
                required
                type="email"
                readOnly
                adornment={<Icon name="lock" size={18} />}
                adornmentClassName="text-outline-variant"
                className="cursor-not-allowed !bg-surface-container border-dashed text-on-surface-variant"
                {...register("email")}
              />
              <div className="flex flex-col gap-2">
                <span className="px-1 font-label text-xs font-bold tracking-wide text-on-surface-variant">
                  Phone<span className="align-middle text-base leading-none text-error"> *</span>
                </span>
                <div
                  className={`relative flex h-10 w-full min-w-0 items-center rounded-lg border bg-surface-container-low transition-all duration-200 focus-within:border-primary focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/10 ${
                    errors.contact?.message || errors.countryCode?.message
                      ? "border-error/80 ring-2 ring-error/10"
                      : "border-outline-variant/30"
                  }`}
                >
                  <div className="w-[4.4rem] shrink-0 sm:w-[4.8rem]">
                    <Controller
                      control={control}
                      name="countryCode"
                      rules={{ required: "Country code is required." }}
                      render={({ field: cc }) => (
                        <Select
                          aria-label="Country code"
                          searchable
                          placeholder="Code"
                          options={DIAL_CODES}
                          value={cc.value}
                          onChange={(v) => {
                            cc.onChange(v);
                            void trigger("contact");
                          }}
                          className="flex h-10 w-full cursor-pointer items-center justify-between gap-1 bg-transparent px-2.5 text-left text-sm text-on-surface outline-none hover:opacity-85 sm:px-3"
                          panelClassName="w-64 max-w-[calc(100vw-2.5rem)] sm:w-80"
                          displayValueOnly
                        />
                      )}
                    />
                  </div>
                  <div className="h-5 w-px shrink-0 bg-outline-variant/30" />
                  <input
                    id="contact"
                    type="tel"
                    placeholder="9632585698"
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-on-surface outline-none placeholder:text-outline-variant sm:px-3"
                    {...register("contact", {
                      required: "Contact number is required.",
                      validate: (v, values) =>
                        !v?.trim() ? true : (phoneErrorForDialCode(values.countryCode, v, false) ?? true),
                    })}
                  />
                  <div className="flex shrink-0 items-center pr-2.5 text-on-surface-variant sm:pr-3">
                    <Icon name="smartphone" size={18} />
                  </div>
                </div>
                {(errors.countryCode?.message || errors.contact?.message) && (
                  <span className="px-1 text-xs font-medium text-error">
                    {errors.contact?.message ?? errors.countryCode?.message}
                  </span>
                )}
              </div>
              {role === "b2b_enterprise" && (
                <>
                  <Input
                    variant="ux"
                    label="GST Number"
                    required
                    readOnly
                    adornment={<Icon name="lock" size={18} />}
                    adornmentClassName="text-outline-variant"
                    className="cursor-not-allowed !bg-surface-container border-dashed text-on-surface-variant"
                    {...register("gstNumber")}
                  />
                  <Input
                    variant="ux"
                    label="CIN Number"
                    required
                    readOnly
                    adornment={<Icon name="lock" size={18} />}
                    adornmentClassName="text-outline-variant"
                    className="cursor-not-allowed !bg-surface-container border-dashed text-on-surface-variant"
                    {...register("cinNumber")}
                  />
                </>
              )}
            </div>
          </div>

          {/* NOT IN NEW UI: first/last name are asked on the Apply screen (kept here prefilled), and country/continent
              replace the new UI's state/city. Both are from the previous UI. */}
          {/* Personal info */}
          <div className="flex flex-col gap-3">
            <span className="px-1 text-xs font-bold tracking-wide text-on-surface-variant">
              Personal Info
            </span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                variant="ux"
                id="firstName"
                label="First Name"
                required
                placeholder="e.g. Michael"
                error={errors.firstName?.message}
                adornment={<Icon name="person" size={20} />}
                adornmentClassName="text-primary opacity-0 transition-opacity group-focus-within:opacity-100"
                {...register("firstName")}
              />
              <Input
                variant="ux"
                id="lastName"
                label="Last Name"
                required
                placeholder="e.g. Scott"
                error={errors.lastName?.message}
                adornment={<Icon name="person" size={20} />}
                adornmentClassName="text-primary opacity-0 transition-opacity group-focus-within:opacity-100"
                {...register("lastName")}
              />
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <Select
                    id="country"
                    label="Country"
                    optional
                    placeholder="Select country (defaults to India)"
                    options={COUNTRIES}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      setValue("continent", continentForCountry(v));
                    }}
                    error={errors.country?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="continent"
                render={({ field }) => (
                  <Select
                    id="continent"
                    label="Continent"
                    optional
                    placeholder="Select continent"
                    options={CONTINENTS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

            </div>
          </details>
          </div>

          <div className={tab === "role" ? "flex flex-col gap-6" : "hidden"}>
          <AccountSummary {...summary} />
          {/* Role-specific fields */}
          {role === "startup" && (
            <StartupProfileFields control={control} register={register} errors={errors} hideIntent newUi />
          )}
          {role === "investor" && (
            <InvestorProfileFields control={control} register={register} setValue={setValue} errors={errors} hideIntent newUi />
          )}
          {role === "b2b_enterprise" && (
            <B2BProfileFields control={control} register={register} setValue={setValue} errors={errors} hideIntent newUi />
          )}
          </div>

          <div className="foot">
            <button
              className="btn secondary"
              type="button"
              onClick={() => (tab === "about" ? router.push("/registration/business-check") : setTab("about"))}
            >
              Back
            </button>
            <span className="spacer" />
            {/* NOT IN NEW UI: Preview modal (the new UI previews on the Review screen). Kept from the previous UI. */}
            <button className="btn secondary" type="button" onClick={() => setPreviewData(getValues())}>
              Preview
            </button>
            <button
              className="btn primary"
              type={tab === "about" ? "button" : "submit"}
              onClick={tab === "about" ? () => setTab("role") : undefined}
              disabled={isSubmitting}
            >
              {isSubmitting ? <span className="spin" /> : "Continue"}
            </button>
          </div>
        </form>

        <Modal open={!!previewData} onClose={() => setPreviewData(null)} title="Profile Preview">
          {previewData && <ProfilePreview values={previewData} photoUrl={photo} role={role} />}
        </Modal>
      </div>
        </main>
      </div>
    </div>
  );
}
