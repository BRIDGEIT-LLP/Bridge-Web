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
import { PRIMARY_SECTORS } from "@/lib/b2b-profile-options";
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
  const COMMON_COLUMNS = new Set([
    "first_name", "last_name", "profile_photo", "intro_video", "short_bio", "country", "continent", "state", "city",
    "mobile_number", "country_code", "company_email", "primary_sector", "organization_name", "intent_note",
    "startup_intent", "investor_intent", "b2b_intent", "incorporation_certificate", "pitch_deck_certificate",
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
        .filter((r) => !/intent/i.test(r.label))
        .map((r) => [r.label, r.value] as Row)
    : (profileFields ?? [])
        .filter((f) => !COMMON_COLUMNS.has(f.columnName))
        .map((f) => [fieldLabel(f.columnName, f.label), display(f.columnName, f.value)] as Row);

  // Documents: what is stored, with a browser copy of the payload as the fallback.
  const kyc = data.kycPayload as SaveKycInfoPayload | undefined;
  const aadhaarDoc = reqs?.documents.find((d) => d.document_type === "AADHAAR");
  const aadhaar = aadhaarDoc?.number ?? String(data.aadhaarNumber ?? "");
  const maskedAadhaar = aadhaar.length === 12 ? `XXXX XXXX ${aadhaar.slice(8)}` : aadhaar;
  const panNumber = biz?.pan_number || reqs?.documents.find((d) => d.document_type === "PAN")?.number || show(data.panNumber);
  const docRows: Row[] = reqs
    ? [
        ...(aadhaarDoc ? ([["Aadhaar", maskedAadhaar]] as Row[]) : []),
        ...reqs.documents
          .filter((d) => d.uploaded)
          .map((d) => [d.label, d.sides.map((s) => d.files[s]?.file_name).filter(Boolean).join(", ")] as Row),
      ]
    : [
        ...(role === "b2b_enterprise" ? [] : ([
          ["Aadhaar", maskedAadhaar],
          ["Aadhaar files", [kyc?.AADHAAR?.front?.file_name, kyc?.AADHAAR?.back?.file_name].filter(Boolean).join(", ")],
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
      href: "/registration",
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
        ["Sectors", sectors.map((v) => labelOf(PRIMARY_SECTORS, v)).join(", ")],
        ["Bio", fieldText("short_bio") || show(data.bio)],
      ],
    },
    { title: section?.title ?? "Details", href: "/registration/complete-profile", rows: roleRows },
    { title: "Looking for", href: "/registration/intent", rows: [["Intent", intentLabel], ["Details", intentNote]] },
    {
      title: "Documents",
      href: "/registration/document-upload",
      rows: [...docRows, ["Address", show(data.kycAddress)]],
    },
  ];

  // Same approximation the Your profile ring uses: share of filled shared fields plus the role section.
  const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");
  const leaves = profileFields
    ? [
        field("first_name"), field("last_name"), field("country"), field("primary_sector"), field("short_bio"), field("profile_photo"),
        ...profileFields.filter((f) => !COMMON_COLUMNS.has(f.columnName)).map((f) => f.value),
      ]
    : [
        data.firstName, data.lastName, data.country, data.primarySectors, data.bio, data.photo,
        ...Object.entries(roleValues).filter(([k]) => !/intent/i.test(k)).map(([, v]) => v),
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
          <Link className="brand" href="/" aria-label="Bridge Platform home">
            <BrandLockup />
          </Link>
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
