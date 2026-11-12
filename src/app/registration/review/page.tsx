"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/layout/navbar";
import { logoutSession } from "@/lib/logout";
import { ONBOARDING_STEPS, stepNumber } from "@/lib/onboarding-steps";
import "../registration.css";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { getKycRequirements, saveKycInfo } from "@/services/kyc.service";
import { getUserProfile, getBusinessCheck, type BusinessCheckData, type ProfileField } from "@/services/user.service";
import { fieldLabel, getFieldOptionConfig } from "@/lib/profile-field-options";
import { STATUS_ROUTE } from "@/lib/onboarding-steps";
import { INTENT_OPTIONS } from "@/lib/startup-profile-options";
import { PRIMARY_INTENT_OPTIONS } from "@/lib/investor-profile-options";
import { BUSINESS_INTENTS } from "@/lib/b2b-profile-options";
import { roleSection } from "@/components/onboarding/ProfilePreview";
import { COUNTRIES } from "@/lib/countries";
import { PRIMARY_SECTORS, SECTOR_OPTIONS } from "@/lib/b2b-profile-options";
import type { CompleteProfileForm } from "@/components/onboarding/StartupProfileFields";
import type { KycDocFile, KycRequirementsData, SaveKycInfoPayload } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const ROLE_LABELS: Record<string, string> = { startup: "Founder", investor: "Investor", b2b_enterprise: "Business owner" };
const ROLE_SECTION: Record<string, { key: "startup" | "investor" | "b2b"; title: string }> = {
  startup: { key: "startup", title: "Your raise" },
  investor: { key: "investor", title: "How you invest" },
  b2b_enterprise: { key: "b2b", title: "Your business" },
};
const INTENT_LISTS: Record<string, { value: string; label: string }[]> = {
  startup: INTENT_OPTIONS,
  investor: PRIMARY_INTENT_OPTIONS,
  b2b_enterprise: BUSINESS_INTENTS,
};

type Row = [label: string, value: ReactNode];

const labelOf = (opts: { value: string; label: string }[], v: unknown) => opts.find((o) => o.value === String(v))?.label ?? String(v);
const show = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) {
    // Founders rows are { name, url } objects; everything else is a string list.
    return v
      .map((x) => (x && typeof x === "object" ? String((x as { name?: unknown }).name ?? "") : String(x)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof v === "object") return "";
  return String(v);
};

/**
 * Step 7 of the new UI: "Review your application". Nothing is sent before this point except the
 * profile (Intent screen) — this screen sends the KYC documents with the same save-kyc-info call
 * the Documents screen used to make, then moves to the verification-status screen.
 */
export default function ReviewPage() {
  const router = useRouter();
  const { data, markComplete } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);

  const [profileFields, setProfileFields] = useState<ProfileField[] | null>(null);
  const [biz, setBiz] = useState<BusinessCheckData | null>(null);
  const [reqs, setReqs] = useState<KycRequirementsData | null>(null);

  // The database holds what was saved on each step (and any draft), so Review reads it from there. The browser copy
  // only fills in what the server does not return (e.g. the registered address), and covers a failed request.
  useEffect(() => {
    let cancelled = false;
    getUserProfile().then((r) => !cancelled && setProfileFields(Array.isArray(r.data) ? r.data : null)).catch(() => undefined);
    getBusinessCheck().then((r) => !cancelled && setBiz(r.data ?? null)).catch(() => undefined);
    getKycRequirements().then((r) => !cancelled && setReqs(r)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const role = String(data.role ?? "");
  const section = ROLE_SECTION[role];
  const roleValues = (section ? (data[section.key] as Record<string, unknown> | undefined) : undefined) ?? {};
  const field = (column: string) => profileFields?.find((f) => f.columnName === column)?.value;
  const fieldText = (column: string): string => {
    const v = field(column);
    if (v === undefined || v === null || Array.isArray(v) || typeof v === "object") return "";
    return String(v);
  };
  /** A stored value as its display name(s): option values are looked up, lists joined, founders by name. */
  const display = (column: string, v: unknown): string => {
    // Money columns are stored in rupees; the form works in ₹ Cr, so show them the same way.
    if (/^(ticket_size_amt_|funding_ask_amt_)(min|max)$/.test(column) && v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v))) {
      return `₹ ${Number((Number(v) / 1e7).toFixed(4))} Cr`;
    }
    const cfg = getFieldOptionConfig(column);
    const one = (x: unknown) => (cfg ? labelOf(cfg.options, x) : show(x));
    return Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? show([x]) : one(x))).filter(Boolean).join(", ") : one(v);
  };

  const intentColumn = role === "startup" ? "startup_intent" : role === "investor" ? "investor_intent" : "b2b_intent";
  const intentValue = fieldText(intentColumn) || String(roleValues.intent ?? roleValues.primaryIntent ?? roleValues.businessIntent ?? "");
  const intentLabel = INTENT_LISTS[role]?.find((o) => o.value === intentValue)?.label ?? "";
  const intentNote = fieldText("intent_note") || show(data.intentNote);

  // Account / profile values: the server's when it has them, otherwise what this browser holds.
  const fullName = `${fieldText("first_name") || show(data.firstName)} ${fieldText("last_name") || show(data.lastName)}`.trim();
  const sectors = (field("primary_sector") as string[] | undefined) ?? (data.primarySectors as string[] | undefined) ?? [];
  const country = fieldText("country") || show(data.country);
  const based = [fieldText("city") || show(data.city), fieldText("state") || show(data.state)].filter(Boolean).join(", ");

  // Role section: the labelled preview rows when this browser has the form values; otherwise the saved columns.
  // Review wording for a few B2B columns (the shared labels are also used by the profile pages).
  const REVIEW_LABELS: Record<string, string> = {
    revenue_band: "Annual Revenue",
    business_requirements: "What You Need",
    operational_capacity_description: "Operational Capacity",
  };
  // Order of the "Your business" form, so the saved columns read in the same order as the screen.
  const B2B_ORDER = [
    "b2b_sub_sector", "industry_vertical", "revenue_band", "years_in_operation", "min_order_quantity", "export_rediness",
    "b2b_geography_country", "b2b_geography_continent", "products_ervice_Offered", "business_requirements",
    "operational_capacity_description",
  ];
  const orderIdx = (c: string) => {
    const i = role === "b2b_enterprise" ? B2B_ORDER.indexOf(c) : -1;
    return i < 0 ? 999 : i;
  };
  const COMMON_COLUMNS = new Set([
    // B2B sector is the "Sectors" row under About you; the business name is the Company row under Account.
    ...(role === "b2b_enterprise" ? ["b2b_sector"] : []),
    "first_name", "last_name", "profile_photo", "intro_video", "short_bio", "country", "continent", "state", "city",
    "mobile_number", "country_code", "company_email", "primary_sector", "organization_name", "intent_note",
    "startup_intent", "investor_intent", "b2b_intent", "incorporation_certificate", "pitch_deck_certificate",
    // LinkedIn / website are shown under "About you".
    "linkedin_profile_url", "company_website_url",
  ]);
  const hasLocalRole = Object.keys(roleValues).length > 0;
  const roleRows: Row[] = hasLocalRole
    ? (
        roleSection(
          { startup: data.startup, investor: data.investor, b2b: data.b2b } as unknown as CompleteProfileForm,
          role,
          () => undefined
        )?.rows ?? []
      )
        .filter((r) => !/intent/i.test(r.label) && !/^(website|linkedin)$/i.test(r.label))
        .map((r) => [r.label, r.value] as Row)
    : (profileFields ?? [])
        .filter((f) => !COMMON_COLUMNS.has(f.columnName))
        .sort((a, b) => orderIdx(a.columnName) - orderIdx(b.columnName))
        .map((f) => [REVIEW_LABELS[f.columnName] ?? fieldLabel(f.columnName, f.label), display(f.columnName, f.value)] as Row);

  // Documents: what is stored, with a browser copy of the payload as the fallback.
  const kyc = data.kycPayload as SaveKycInfoPayload | undefined;
  const aadhaarDoc = reqs?.documents.find((d) => d.document_type === "AADHAAR");
  const aadhaar = aadhaarDoc?.number ?? "";
  const maskedAadhaar =
    aadhaar.length === 12 ? `XXXX XXXX ${aadhaar.slice(8)}` : data.aadhaarLast4 ? `XXXX XXXX ${String(data.aadhaarLast4)}` : aadhaar;
  const panNumber = biz?.pan_number || reqs?.documents.find((d) => d.document_type === "PAN")?.number || show(data.panNumber);
  const docRows: Row[] = reqs
    ? [
        ...(aadhaarDoc ? ([["Aadhaar number", maskedAadhaar]] as Row[]) : []),
        // One row per file, so e.g. the Aadhaar front and back are listed separately.
        ...reqs.documents
          .filter((d) => d.uploaded)
          .flatMap((d) =>
            d.sides.length > 1
              ? d.sides.map((s) => [`${d.label.replace(/ card$/i, "")}, ${s}`, d.files[s]?.file_name ?? ""] as Row)
              : ([[d.label, d.sides.map((s) => d.files[s]?.file_name).filter(Boolean).join(", ")]] as Row[]),
          ),
      ]
    : [
        ...(role === "b2b_enterprise" ? [] : ([
          ["Aadhaar number", maskedAadhaar],
          ["Aadhaar, front", show(kyc?.AADHAAR?.front?.file_name)],
          ["Aadhaar, back", show(kyc?.AADHAAR?.back?.file_name)],
        ] as Row[])),
        ["PAN", panNumber],
        ["PAN file", show(kyc?.PAN?.front?.file_name)],
        ...(kyc?.GST_CERTIFICATE ? ([["GST registration certificate", show(kyc.GST_CERTIFICATE.front.file_name)]] as Row[]) : []),
        ...(kyc?.INCORPORATION_CERTIFICATE ? ([["Certificate of incorporation", show(kyc.INCORPORATION_CERTIFICATE.front.file_name)]] as Row[]) : []),
        ...(kyc?.PITCH_DECK ? ([["Pitch deck", show(kyc.PITCH_DECK.front.file_name)]] as Row[]) : []),
      ];

  const sections: { title: string; href: string; rows: Row[] }[] = [
    {
      title: "Account",
      // ?edit=1 keeps the draft and the session; without it this page starts a brand-new application.
      href: "/registration?edit=1",
      rows: [
        ["Applying as", ROLE_LABELS[role] ?? role],
        ["Name", fullName],
        ["Company", show(data.legalName) || fieldText("organization_name")],
        ["Email", show(data.email) || fieldText("company_email")],
        ["Mobile", `${show(data.countryCode) || fieldText("country_code")} ${show(data.contact) || fieldText("mobile_number")}`.trim()],
      ],
    },
    {
      title: "Business checks",
      href: "/registration/business-check",
      rows:
        role === "b2b_enterprise"
          ? [["GSTIN", biz?.gst_number || show(data.gstNumber)], ["CIN or LLPIN", biz?.cin_number || show(data.cinNumber)]]
          : [["CIN or LLPIN", biz?.cin_number || show(data.businessCin)], ["PAN", panNumber]],
    },
    {
      title: "About you",
      href: "/registration/complete-profile",
      rows: [
        ["Based in", based || (country ? labelOf(COUNTRIES, country) : "")],
        ["Sectors", sectors.map((v) => labelOf(role === "b2b_enterprise" ? SECTOR_OPTIONS : PRIMARY_SECTORS, v)).join(", ")],
        ["Bio", fieldText("short_bio") || show(data.bio)],
        ["LinkedIn", fieldText("linkedin_profile_url") || show(roleValues.linkedinUrl)],
        ["Website", fieldText("company_website_url") || show(roleValues.websiteUrl)],
      ],
    },
    { title: section?.title ?? "Details", href: "/registration/complete-profile?tab=role", rows: roleRows },
    { title: "Looking for", href: "/registration/intent", rows: [["Intent", intentLabel], ["Details", intentNote]] },
    {
      title: "Documents",
      href: "/registration/document-upload",
      rows: docRows,
    },
  ];

  // Same approximation the Your profile ring uses: share of filled shared fields plus the role section.
  const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");
  // Same fields as the Profile step's ring (only what the new design shows), so the two agree and 100% is reachable.
  const rv = roleValues as Record<string, unknown>;
  const localRoleLeaves: unknown[] =
    role === "startup"
      ? [rv.fundingStage, rv.raisingCr || rv.fundingMax, rv.useOfFunds, rv.teamSize, rv.yearOfIncorporation, rv.fundsRaised]
      : role === "investor"
        ? [rv.investorType, rv.investmentStages, rv.ticketMinCr || rv.ticketMin, rv.ticketMaxCr || rv.ticketMax, rv.geoCountries, rv.investmentThesis, rv.numberOfInvestments]
        : [rv.sector, rv.subSector, rv.revenueBand, rv.yearsInOperation, rv.moq, rv.exportReadiness, rv.geoCountries, rv.productsServices, rv.businessRequirements];
  const serverRoleColumns =
    role === "startup"
      ? ["funding_stage", "funding_ask_amt_max", "use_of_funds", "team_size_min"]
      : role === "investor"
        ? ["investor_type", "prefrerred_investment_stage", "ticket_size_amt_min", "ticket_size_amt_max", "geographic_investment_preference", "investment_thesis", "number_of_investments_to_date"]
        : ["b2b_sector", "b2b_sub_sector", "revenue_band", "years_in_operation", "min_order_quantity", "export_rediness", "b2b_geography_country", "products_ervice_Offered", "business_requirements"];
  const leaves =
    profileFields && !hasLocalRole
      ? [
          field("first_name"), field("last_name"), field("state"), field("city"), field("primary_sector"), field("short_bio"),
          field("linkedin_profile_url"), field("company_website_url"),
          ...serverRoleColumns.map((c) => field(c)),
        ]
      : [
          data.firstName, data.lastName, data.state, data.city, data.primarySectors, data.bio, rv.linkedinUrl, rv.websiteUrl,
          ...localRoleLeaves,
        ];
  const pct = leaves.length ? Math.round((leaves.filter(filled).length / leaves.length) * 100) : 0;

  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutSession();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };
  const current = stepNumber("review");

  /** The payload to submit: the browser copy, otherwise rebuilt from the documents stored in the database. */
  const payloadFromStored = (): SaveKycInfoPayload | undefined => {
    if (!reqs) return undefined;
    const out: Record<string, unknown> = {};
    for (const d of reqs.documents) {
      if (!d.uploaded) continue;
      const file = (side: "front" | "back"): KycDocFile | undefined => {
        const f = d.files[side];
        return f ? { s3_key: f.s3_key, mimetype: f.mimetype ?? "", file_name: f.file_name ?? "", file_size: f.file_size ?? 0 } : undefined;
      };
      out[d.document_type] = {
        ...(d.number && d.number_source === "user" ? { number: d.number } : {}),
        front: file("front"),
        ...(d.sides.includes("back") ? { back: file("back") } : {}),
      };
    }
    return Object.keys(out).length ? (out as unknown as SaveKycInfoPayload) : undefined;
  };

  const handleSubmit = async () => {
    const submitKyc = (data.kycPayload as SaveKycInfoPayload | undefined) ?? payloadFromStored();
    if (!submitKyc) {
      toast.error("Please upload your documents first.");
      router.push("/registration/document-upload");
      return;
    }
    setSubmitting(true);
    try {
      const res = await saveKycInfo(submitKyc);
      toast.success(res.message ?? "Documents submitted for verification.");
      markComplete("review");
      router.push(STATUS_ROUTE);
    } catch (err) {
      toast.error((err as ApiError)?.message ?? "Couldn't submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bp">
      <div className="ob">
        <div className="ob-top">
          <div className="brand" aria-label="Bridge Platform">
            <BrandLockup />
          </div>
          <button className="btn secondary sm" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>

        <ol
          className="ob-progress"
          style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, 1fr)` }}
          aria-label="Application progress"
        >
          {ONBOARDING_STEPS.map((st, i) => (
            <li
              key={st.key}
              className={current > i + 1 ? "done" : current === i + 1 ? "current" : ""}
              aria-current={current === i + 1 ? "step" : undefined}
            >
              {i + 1} {st.label}
            </li>
          ))}
        </ol>

        <main className="ob-main">
          <div className="ob-card wide">
            <Link className="back" href="/registration/document-upload">
              <ArrowLeft size={14} /> Back
            </Link>
            <div className="spread" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <h2>Review your application</h2>
                <p className="lede">Check everything once. A founder will review it, usually within 24 hours.</p>
              </div>
              <div className="ring" style={{ ["--p" as string]: pct }} data-label={`${pct}%`} title="Profile completeness" aria-label={`Profile ${pct}% complete`} />
            </div>

            {sections.map((sec) => {
              const rows = sec.rows.filter(([, v]) => v);
              return (
                <div key={sec.title} className="review-sec">
                  <div className="spread">
                    <strong>{sec.title}</strong>
                    <button type="button" onClick={() => router.push(sec.href)} className="link small">
                      Edit
                    </button>
                  </div>
                  {rows.length === 0 ? (
                    <p className="tiny-empty">Nothing added yet.</p>
                  ) : (
                    <dl className="facts">
                      {rows.map(([k, v]) => (
                        <div key={k} style={{ display: "contents" }}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}

            <div className="foot">
              <span className="spacer" />
              <button className="btn primary" type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spin" /> Submitting
                  </>
                ) : (
                  "Submit application"
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
