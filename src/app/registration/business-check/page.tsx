"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLockup } from "@/components/layout/navbar";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { ONBOARDING_STEPS, stepNumber } from "@/lib/onboarding-steps";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { verifyCin, verifyGst } from "@/services/auth.service";
import { getBusinessCheck, saveBusinessCheck } from "@/services/user.service";
import { CIN_REGEX, GST_REGEX, PAN_REGEX } from "@/lib/validation";
import { ERROR_MESSAGES } from "@/lib/messages";
import type { ApiError } from "@/lib/axios";
import "../registration.css";

type CheckState = "idle" | "checking" | "verified" | "failed";
type FieldKey = "gstin" | "cin" | "pan";

interface CheckSpec {
  key: FieldKey;
  label: string;
  placeholder: string;
  hint: string;
  optional?: boolean;
}

/** Fields (and their order) per role, as in the prototype's CHECK_FIELDS. */
const CHECK_FIELDS: Record<"b2b_enterprise" | "startup" | "investor", CheckSpec[]> = {
  b2b_enterprise: [
    { key: "gstin", label: "GSTIN", placeholder: "24AABCS1429B1Z5", hint: "15 characters. We check it live against the GST network." },
    { key: "cin", label: "CIN or LLPIN", placeholder: "U25209GJ2008PTC053311", hint: "From your certificate of incorporation." },
  ],
  startup: [
    { key: "cin", label: "CIN or LLPIN", placeholder: "U72900MH2021PTC351234", hint: "From your certificate of incorporation." },
    { key: "pan", label: "Your PAN", placeholder: "ABCDE1234F", hint: "Format: 5 letters, 4 digits, 1 letter." },
  ],
  investor: [
    { key: "pan", label: "Your PAN", placeholder: "ABCDE1234F", hint: "Format: 5 letters, 4 digits, 1 letter." },
    { key: "cin", label: "Fund or company CIN (optional)", placeholder: "U65990MH2019PTC322110", hint: "Leave blank if you invest personally.", optional: true },
  ],
};

const PAN_ERROR = "PAN is 5 letters, 4 digits, then 1 letter, like ABCDE1234F.";

/**
 * Step 3: "Check your business". Which data points are asked depends on the role.
 *
 * - Business owner: GSTIN + CIN, both required and verified live (GST network / MCA21).
 * - Founder: CIN (verified against MCA) + PAN.
 * - Investor: PAN + optional fund CIN.
 *
 * PAN has no verification endpoint, so it is format-checked only and carried to the Documents
 * screen, which prefills the PAN number from it. PUT /business-check stores whatever the role
 * asks for (GSTIN/CIN on the company, PAN in the KYC record).
 */
export default function BusinessCheckPage() {
  const { data, setData, goNext } = useOnboarding();
  const role = String(data.role ?? "");
  const isB2B = role === "b2b_enterprise";
  const specs = CHECK_FIELDS[(role in CHECK_FIELDS ? role : "startup") as keyof typeof CHECK_FIELDS];
  const company = String(data.legalName ?? "") || "Your company";
  const personName = `${String(data.firstName ?? "")} ${String(data.lastName ?? "")}`.trim();

  const savedCin = String((isB2B ? data.cinNumber : data.businessCin) ?? "");
  const [cin, setCin] = useState(savedCin);
  const [cinState, setCinState] = useState<CheckState>(savedCin ? "verified" : "idle");
  const [gst, setGst] = useState(String(data.gstNumber ?? ""));
  const [gstState, setGstState] = useState<CheckState>(data.gstNumber ? "verified" : "idle");
  const [gstMsg, setGstMsg] = useState("");
  const gstReq = useRef(0);
  const [cinMsg, setCinMsg] = useState("");
  const [pan, setPan] = useState(String(data.panNumber ?? ""));
  const cinReq = useRef(0);

  // Prefill from what PUT /business-check stored, e.g. after a refresh or on another device. Only fills
  // fields that are still empty so it never overwrites what the user has typed.
  useEffect(() => {
    let cancelled = false;
    getBusinessCheck()
      .then((res) => {
        const saved = res.data;
        if (cancelled || !saved) return;
        if (saved.cin_number && saved.is_cin_verified) {
          setCin((cur) => cur || saved.cin_number!);
          setCinState((cur) => (cur === "idle" ? "verified" : cur));
        }
        if (saved.gst_number && saved.is_gst_verified) {
          setGst((cur) => cur || saved.gst_number!);
          setGstState((cur) => (cur === "idle" ? "verified" : cur));
        }
        if (saved.pan_number) setPan((cur) => cur || saved.pan_number!);
      })
      .catch(() => {
        /* nothing saved yet, or offline: the local draft is enough */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cinOptional = role === "investor";
  const panValid = PAN_REGEX.test(pan);
  const cinOk = cinState === "verified" || (cinOptional && !cin);
  const gstOk = gstState === "verified";
  const busy = cinState === "checking" || gstState === "checking";
  const canContinue = (!isB2B || gstOk) && cinOk && (isB2B || panValid) && !busy;

  const missing: string[] = [];
  for (const s of specs) {
    if (s.key === "gstin" && !gstOk) missing.push("GSTIN");
    if (s.key === "cin" && !cinOk) missing.push("CIN or LLPIN");
    if (s.key === "pan" && !panValid) missing.push("Your PAN");
  }
  const missingText = missing.length ? `Still needed: a verified ${missing.join(" and ")}.` : "";

  const runCin = async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) {
      setCinState("idle");
      setCinMsg("");
      return;
    }
    if (!CIN_REGEX.test(value)) {
      setCinState("failed");
      setCinMsg("That doesn’t look like a CIN or LLPIN. Check your certificate of incorporation.");
      return;
    }
    const id = ++cinReq.current;
    setCinState("checking");
    try {
      const res = await verifyCin({ cin: value });
      if (id !== cinReq.current) return;
      if (!res.data?.verified) throw { message: res.message ?? ERROR_MESSAGES.CIN_VERIFICATION_FAILED } as ApiError;
      setCinState("verified");
      setCinMsg(res.message ?? "");
    } catch (err) {
      if (id !== cinReq.current) return;
      setCinState("failed");
      setCinMsg((err as ApiError).message ?? ERROR_MESSAGES.CIN_VERIFICATION_FAILED);
    }
  };

  const runGst = async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) {
      setGstState("idle");
      setGstMsg("");
      return;
    }
    if (!GST_REGEX.test(value)) {
      setGstState("failed");
      setGstMsg("Invalid GSTIN. Please check and try again.");
      return;
    }
    const id = ++gstReq.current;
    setGstState("checking");
    try {
      const res = await verifyGst({ gstin: value });
      if (id !== gstReq.current) return;
      if (!res.data?.verified) throw { message: res.message ?? ERROR_MESSAGES.GST_VERIFICATION_FAILED } as ApiError;
      setGstState("verified");
      setGstMsg(res.message ?? "");
    } catch (err) {
      if (id !== gstReq.current) return;
      setGstState("failed");
      setGstMsg((err as ApiError).message ?? ERROR_MESSAGES.GST_VERIFICATION_FAILED);
    }
  };

  /**
   * Save as draft: the verified GSTIN / CIN and a well-formed PAN are written to the database as they are (nothing
   * is required, nothing unverified is stored) with the step recorded, and the values are kept locally as well.
   */
  const [savedAt, setSavedAt] = useState<number | null>(data.draftSavedAt ? Number(data.draftSavedAt) : null);
  const saveDraft = async () => {
    const vCin = cinState === "verified" ? cin.trim().toUpperCase() : "";
    const vGst = gstState === "verified" ? gst.trim().toUpperCase() : "";
    try {
      await saveBusinessCheck(
        {
          gst_number: isB2B && vGst ? vGst : undefined,
          cin_number: vCin || undefined,
          pan_number: !isB2B && PAN_REGEX.test(pan) ? pan : undefined,
        },
        { step: "business" },
      );
    } catch (err) {
      toast.error((err as ApiError).message ?? "Could not save your draft. Please try again.");
      return;
    }
    const now = Date.now();
    setData(isB2B ? { gstNumber: vGst, cinNumber: vCin, draftSavedAt: now } : { businessCin: vCin, panNumber: pan, draftSavedAt: now });
    setSavedAt(now);
    toast.success("Draft saved. You can close this tab and pick up later.");
  };
  const draftLabel = savedAt ? `at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";

  const [saving, setSaving] = useState(false);
  const handleContinue = async () => {
    const verifiedCin = cinState === "verified" ? cin.trim().toUpperCase() : "";
    setSaving(true);
    try {
      // Persists CIN (company) and PAN (KYC record) on the server; the role decides what it accepts.
      await saveBusinessCheck(
        isB2B
          ? { gst_number: gst.trim().toUpperCase(), cin_number: verifiedCin }
          : { cin_number: verifiedCin || undefined, pan_number: pan || undefined }
      );
    } catch (err) {
      toast.error((err as ApiError).message ?? "Could not save your business details. Please try again.");
      setSaving(false);
      return;
    }
    setData(isB2B ? { gstNumber: gst.trim().toUpperCase(), cinNumber: verifiedCin } : { businessCin: verifiedCin, panNumber: pan });
    goNext("business");
  };

  const current = stepNumber("business");

  const Ok = ({ title, detail }: { title: string; detail: string }) => (
    <div className="gst-result ok">
      <span style={{ color: "var(--success)" }}><Check size={16} strokeWidth={3} /></span>
      <div className="stack" style={{ ["--g" as string]: "2px" }}>
        <strong className="small">{title}</strong>
        {detail && <span className="tiny muted">{detail}</span>}
      </div>
    </div>
  );
  const Fail = ({ msg }: { msg: string }) => (
    <div className="gst-result err"><AlertCircle size={16} /><span>{msg}</span></div>
  );
  const Wait = ({ what }: { what: string }) => (
    <div className="gst-result wait"><span className="spin" /><span>Checking with {what}…</span></div>
  );

  const result = (key: FieldKey) => {
    if (key === "gstin") {
      if (gstState === "checking") return <Wait what="the GST network" />;
      if (gstState === "failed") return <Fail msg={gstMsg} />;
      if (gstState === "verified") return <Ok title={`${company} · Active`} detail={gstMsg || "Verified with the GST network"} />;
      return null;
    }
    if (key === "cin") {
      if (cinState === "checking") return <Wait what="MCA21" />;
      if (cinState === "failed") return <Fail msg={cinMsg} />;
      if (cinState === "verified") return <Ok title={`${company} · Active on MCA21`} detail={cinMsg} />;
      return null;
    }
    if (!pan) return null;
    if (!panValid) return pan.length === 10 ? <Fail msg={PAN_ERROR} /> : null;
    return <Ok title={`PAN format valid${personName ? ` · ${personName}` : ""}`} detail="The name is matched against the PAN record during review." />;
  };

  const valueOf = (key: FieldKey) =>
    key === "gstin" ? gst : key === "cin" ? cin : pan;

  return (
    <div className="bp">
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
            <button
              className="btn secondary sm"
              type="button"
              onClick={() => void saveDraft()}
            >
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
              className={current > i + 1 ? "done" : current === i + 1 ? "current" : ""}
              aria-current={current === i + 1 ? "step" : undefined}
            >
              {i + 1} {s.label}
            </li>
          ))}
        </ol>

        <main className="ob-main">
          <div className="ob-card wide">
            <Link className="back" href="/registration/verify-account">
              <ArrowLeft size={14} /> Back
            </Link>
            <div>
              <h2>Check your business</h2>
              <p className="lede">We verify every member against government records. This takes a few seconds.</p>
            </div>

            {specs.map((s) => (
              <div key={s.key} className="stack" style={{ ["--g" as string]: "8px" }}>
                <div className="field">
                  <label htmlFor={`ck-${s.key}`}>{s.label}</label>
                  <input
                    id={`ck-${s.key}`}
                    type="text"
                    placeholder={s.placeholder}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={s.key === "pan" ? 10 : s.key === "gstin" ? 15 : 21}
                    value={valueOf(s.key)}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
                      if (s.key === "pan") {
                        setPan(v.replace(/-/g, ""));
                        return;
                      }
                      if (s.key === "gstin") {
                        setGst(v.replace(/-/g, ""));
                        setGstState("idle");
                        setGstMsg("");
                        if (v.length === 15) void runGst(v);
                        return;
                      }
                      setCin(v);
                      setCinState("idle");
                      setCinMsg("");
                      if (v.length === 21) void runCin(v);
                    }}
                    onBlur={() => {
                      if (s.key === "cin" && cin && cinState === "idle") void runCin(cin);
                      if (s.key === "gstin" && gst && gstState === "idle") void runGst(gst);
                    }}
                  />
                  <p className="msg">{s.hint}</p>
                </div>
                <div>{result(s.key)}</div>
              </div>
            ))}

            <div className="banner info">
              <ShieldCheck size={16} />
              <span className="grow small">
                The name on these records must match <strong>{String(data.legalName ?? "") || "your company"}</strong>. If it
                doesn’t, we’ll ask you to explain during review.
              </span>
            </div>

            <div className="foot">
              <span className="spacer" />
              <button className="btn primary" type="button" onClick={handleContinue} disabled={!canContinue || saving}>
                {saving ? <span className="spin" /> : "Continue"}
              </button>
            </div>
            <p className="helper-missing">{missingText}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
