"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { COUNTRIES, CONTINENTS } from "@/lib/countries";
import {
  INDUSTRY_SECTORS,
  FUNDING_STAGES,
  TEAM_SIZE_RANGES,
  CURRENCIES,
  INTENT_OPTIONS,
  type Option,
} from "@/lib/startup-profile-options";
import {
  INVESTMENT_STAGES,
  INVESTOR_TYPES,
  PRIMARY_INTENT_OPTIONS,
} from "@/lib/investor-profile-options";
import {
  PRIMARY_SECTORS,
  SECTOR_OPTIONS,
  subSectorOptions,
  verticalOptions,
  BUSINESS_TYPES,
  REVENUE_BANDS,
  EXPORT_READINESS,
  BUSINESS_INTENTS,
} from "@/lib/b2b-profile-options";
import type { CompleteProfileForm, Founder } from "@/components/onboarding/StartupProfileFields";

/** Human-readable labels for the role values captured at registration. */
const ROLE_LABELS: Record<string, string> = {
  startup: "Startup",
  investor: "Investor",
  b2b_enterprise: "B2B Enterprise",
};

const optLabel = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
const optLabels = (opts: Option[], vs: string[] = []) =>
  vs.map((v) => optLabel(opts, v)).join(", ");

/** A funding/ticket "currency min – max" string, or "" if no amounts entered. */
const moneyRange = (currency: string, min: string, max: string) => {
  if (!min && !max) return "";
  const cur = currency ? optLabel(CURRENCIES, currency) : "";
  return `${cur} ${min || "?"} – ${max || "?"}`.trim();
};

interface Row {
  label: string;
  value: React.ReactNode;
  /** Span both columns (long text / lists). */
  full?: boolean;
}

interface Section {
  title: string;
  rows: Row[];
}

/** True when a row value is worth showing (non-empty string/array/node). */
function hasValue(v: React.ReactNode): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function Field({ label, value, full }: Row) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="font-label text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <span className="whitespace-pre-wrap break-words text-sm font-medium text-on-surface sm:text-base">
        {value}
      </span>
    </div>
  );
}

/** Opens the stored document without exposing its storage key. */
function ViewDocButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${label}`}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-container/40"
    >
      <Icon name="visibility" size={16} />
      View
    </button>
  );
}

/** Builds the role-specific section for the active role. */
function roleSection(
  values: CompleteProfileForm,
  role: string,
  onViewDoc: (s3Key: string, title: string) => void,
): Section | null {
  if (role === "startup") {
    const s = values.startup;
    const founders = (s.founders ?? []).filter((f: Founder) => f.name || f.url);
    return {
      title: "Startup Details",
      rows: [
        { label: "Industry Sectors", value: optLabels(INDUSTRY_SECTORS, s.industrySectors), full: true },
        { label: "Funding Stage", value: optLabel(FUNDING_STAGES, s.fundingStage) },
        { label: "Funding Ask", value: moneyRange(s.fundingCurrency, s.fundingMin, s.fundingMax) },
        { label: "Team Size", value: optLabel(TEAM_SIZE_RANGES, s.teamSize) },
        { label: "Intent", value: optLabel(INTENT_OPTIONS, s.intent) },
        {
          label: "Founders",
          full: true,
          value: founders.length
            ? founders.map((f, i) => (
                <span key={i} className="block">
                  {f.name}
                  {f.url ? ` — ${f.url}` : ""}
                </span>
              ))
            : "",
        },
        { label: "Use of Funds", value: s.useOfFunds, full: true },
        { label: "Business Description", value: s.businessDescription, full: true },
        { label: "Website", value: s.websiteUrl },
        { label: "LinkedIn", value: s.linkedinUrl },
        {
          label: "Incorporation Certificate",
          value: s.incorporationCert
            ? <ViewDocButton label="Incorporation Certificate" onClick={() => onViewDoc(s.incorporationCert, "Incorporation Certificate")} />
            : "",
        },
        {
          label: "Pitch Deck",
          value: s.pitchDeck
            ? <ViewDocButton label="Pitch Deck" onClick={() => onViewDoc(s.pitchDeck, "Pitch Deck")} />
            : "",
        },
      ],
    };
  }

  if (role === "investor") {
    const inv = values.investor;
    return {
      title: "Investor Details",
      rows: [
        { label: "Sector Preferences", value: optLabels(INDUSTRY_SECTORS, inv.sectorPreferences), full: true },
        { label: "Investment Stages", value: optLabels(INVESTMENT_STAGES, inv.investmentStages), full: true },
        { label: "Ticket Size", value: moneyRange(inv.ticketCurrency, inv.ticketMin, inv.ticketMax) },
        { label: "Investor Type", value: optLabel(INVESTOR_TYPES, inv.investorType) },
        { label: "Primary Intent", value: optLabel(PRIMARY_INTENT_OPTIONS, inv.primaryIntent) },
        { label: "Number of Investments", value: inv.numberOfInvestments },
        { label: "Countries", value: optLabels(COUNTRIES, inv.geoCountries), full: true },
        { label: "Continents", value: optLabels(CONTINENTS, inv.geoContinents), full: true },
        { label: "Investment Thesis", value: inv.investmentThesis, full: true },
        { label: "Portfolio Overview", value: inv.portfolioOverview, full: true },
        { label: "Address", value: inv.address, full: true },
        { label: "Website", value: inv.websiteUrl },
        { label: "LinkedIn", value: inv.linkedinUrl },
      ],
    };
  }

  if (role === "b2b_enterprise") {
    const b = values.b2b;
    return {
      title: "Business Details",
      rows: [
        { label: "Business Name", value: b.businessName },
        { label: "Sector", value: optLabel(SECTOR_OPTIONS, b.sector) },
        { label: "Sub-Sector", value: optLabel(subSectorOptions(b.sector), b.subSector) },
        { label: "Industry Vertical", value: optLabel(verticalOptions(b.sector, b.subSector), b.industryVertical) },
        { label: "Business Type", value: optLabel(BUSINESS_TYPES, b.businessType) },
        { label: "Min Order Quantity", value: b.moq },
        { label: "Revenue Band", value: optLabel(REVENUE_BANDS, b.revenueBand) },
        { label: "Years in Operation", value: b.yearsInOperation },
        { label: "Export Readiness", value: optLabel(EXPORT_READINESS, b.exportReadiness) },
        { label: "Business Intent", value: optLabel(BUSINESS_INTENTS, b.businessIntent) },
        { label: "Countries", value: optLabels(COUNTRIES, b.geoCountries), full: true },
        { label: "Continents", value: optLabels(CONTINENTS, b.geoContinents), full: true },
        { label: "Products / Services", value: b.productsServices, full: true },
        { label: "Business Requirements", value: b.businessRequirements, full: true },
        { label: "Address", value: b.address, full: true },
        { label: "Website", value: b.websiteUrl },
        { label: "LinkedIn", value: b.linkedinUrl },
      ],
    };
  }

  return null;
}

interface ProfilePreviewProps {
  values: CompleteProfileForm;
  photoUrl: string | null;
  role: string;
}

/** Read-only summary of the complete-profile form, shown inside the preview Modal. */
export function ProfilePreview({ values, photoUrl, role }: ProfilePreviewProps) {
  const [docPreview, setDocPreview] = useState<{ s3Key: string; title: string } | null>(null);

  const accountRows: Row[] = [
    { label: "Company Name", value: values.legalName },
    { label: "Role", value: ROLE_LABELS[values.role] ?? values.role },
    { label: "Email", value: values.email },
    { label: "Phone", value: [values.countryCode, values.contact].filter(Boolean).join(" ") },
  ];
  if (role === "b2b_enterprise") {
    accountRows.push(
      { label: "GST Number", value: values.gstNumber },
      { label: "CIN Number", value: values.cinNumber },
    );
  }

  const sections: (Section | null)[] = [
    { title: "Account Details", rows: accountRows },
    {
      title: "Personal",
      rows: [
        { label: "First Name", value: values.firstName },
        { label: "Last Name", value: values.lastName },
        { label: "Country", value: values.country ? optLabel(COUNTRIES, values.country) : "" },
        { label: "Continent", value: values.continent ? optLabel(CONTINENTS, values.continent) : "" },
        { label: "Primary Sectors", value: optLabels(PRIMARY_SECTORS, values.primarySectors), full: true },
      ],
    },
    roleSection(values, role, (s3Key, title) => setDocPreview({ s3Key, title })),
    { title: "Bio", rows: [{ label: "Short Bio", value: values.bio, full: true }] },
  ];

  return (
    <>
      <div className="flex flex-col gap-6">
      {/* Profile picture */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface-container-highest bg-surface-container-high sm:size-24">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Profile" className="size-full object-cover" />
          ) : (
            <Avatar photoKey={values.photo} alt="Profile" className="size-full">
              <Icon name="person" size={36} className="text-surface-dim" />
            </Avatar>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-headline text-base font-bold text-on-surface sm:text-lg">
            {[values.firstName, values.lastName].filter(Boolean).join(" ") || "—"}
          </span>
        </div>
      </div>

      {sections.filter((s): s is Section => !!s).map((section) => {
        const rows = section.rows.filter((r) => hasValue(r.value));
        if (rows.length === 0) return null;
        return (
          <div key={section.title} className="flex flex-col gap-3 border-t border-outline/10 pt-4">
            <h3 className="font-headline text-sm font-bold text-on-surface sm:text-base">{section.title}</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map((r) => (
                <Field key={r.label} label={r.label} value={r.value} full={r.full} />
              ))}
            </div>
          </div>
        );
      })}
      </div>
      <DocumentPreviewModal
        s3Key={docPreview?.s3Key ?? null}
        title={docPreview?.title}
        onClose={() => setDocPreview(null)}
      />
    </>
  );
}
