"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/layout/navbar";
import { ONBOARDING_STEPS, stepNumber } from "@/lib/onboarding-steps";
import "../registration.css";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { INTENT_OPTIONS } from "@/lib/startup-profile-options";
import { PRIMARY_INTENT_OPTIONS } from "@/lib/investor-profile-options";
import { BUSINESS_INTENTS } from "@/lib/b2b-profile-options";
import { buildProfile, getUserProfile } from "@/services/user.service";
import type { UserProfilePayload } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/** Per-role intent config: option list, the profile payload column, and the onboarding-data slot. */
const INTENT_CONFIG = {
  startup: { options: INTENT_OPTIONS, column: "startup_intent", section: "startup", field: "intent" },
  investor: { options: PRIMARY_INTENT_OPTIONS, column: "investor_intent", section: "investor", field: "primaryIntent" },
  b2b_enterprise: { options: BUSINESS_INTENTS, column: "b2b_intent", section: "b2b", field: "businessIntent" },
} as const;

const INTENT_DESC: Record<string, string> = {
  seeking_distributor: "Find distributors who already serve your kind of customer",
  seeking_supplier: "Find verified suppliers for materials or components",
  seeking_export_buyer: "Meet buyers for your products abroad",
  seeking_manufacturing_partner: "Find a co-packer or contract manufacturer",
  open_to_alliance: "Partnerships, joint bids and shared capacity",
  seed_investment: "Meet investors leading or joining seed rounds",
  angel_investor: "Meet angels who write early cheques",
  strategic_partner: "Find a corporate or industry partner",
  open_to_acquisition: "Talk to acquirers and strategic buyers",
  actively_deploying: "See founders raising now that fit your thesis",
  selectively_investing: "A few strong introductions a month",
  open_to_co_investment: "Meet investors to share deals with",
};

/**
 * Step 5 of the new UI: "What are you looking for?". Intent used to be a dropdown inside the
 * role-specific profile form. The profile is now held locally until this step, which saves it
 * (build-profile, same payload as before) together with the chosen intent.
 *
 * The optional "Anything specific?" note is saved with the intent in user.intent_note (max 300 characters).
 */
export default function IntentPage() {
  const { data, setData, goNext, isDataLoaded } = useOnboarding();
  const role = String(data.role ?? "") as keyof typeof INTENT_CONFIG;
  const cfg = INTENT_CONFIG[role];

  const saved = cfg ? String(((data[cfg.section] as Record<string, unknown> | undefined) ?? {})[cfg.field] ?? "") : "";
  const [intent, setIntent] = useState(saved);
  // Set once the user clicks an option, so a late-arriving saved value never overrides their pick.
  const touched = useRef(false);
  const pick = (v: string) => {
    touched.current = true;
    setIntent(v);
  };

  // Optional free-text note (user.intent_note). Like the intent it is restored from the server when the page opens.
  const [note, setNote] = useState(String(data.intentNote ?? ""));
  const noteTouched = useRef(false);

  // The first render runs before the saved application is reloaded from the server, and after signing back in the
  // draft may be missing or old. The intent saved on the server (build-profile) is the source of truth.
  useEffect(() => {
    if (!isDataLoaded || !cfg) return;
    let cancelled = false;
    getUserProfile()
      .then((res) => {
        if (cancelled || touched.current) return;
        const storedNote = (res.data ?? []).find((f) => f.columnName === "intent_note")?.value;
        if (typeof storedNote === "string" && storedNote && !noteTouched.current) setNote(storedNote);
        const stored = (res.data ?? []).find((f) => f.columnName === cfg.column)?.value;
        const value = typeof stored === "string" ? stored : "";
        if (value && cfg.options.some((o) => o.value === value)) setIntent(value);
        else if (!value && saved) setIntent(saved);
      })
      .catch(() => {
        if (!cancelled && !touched.current && saved) setIntent(saved);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded]);
  const [savedAt, setSavedAt] = useState<number | null>(data.draftSavedAt ? Number(data.draftSavedAt) : null);
  const [saving, setSaving] = useState(false);

  const saveDraft = async () => {
    // Only the intent and its note are written to the database; the rest of the profile was saved on the Profile step.
    if (intent) {
      try {
        await buildProfile({ [cfg.column]: intent, intent_note: note.trim() } as unknown as UserProfilePayload, { step: "intent" });
      } catch (err) {
        toast.error((err as ApiError).message ?? "Could not save your draft. Please try again.");
        return;
      }
    }
    const now = Date.now();
    setData({
      [cfg.section]: { ...((data[cfg.section] as Record<string, unknown> | undefined) ?? {}), [cfg.field]: intent },
      intentNote: note,
      draftSavedAt: now,
    });
    setSavedAt(now);
    toast.success("Draft saved. You can close this tab and pick up later.");
  };
  const draftLabel = savedAt ? `at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
  const current = stepNumber("intent");
  const placeholder =
    role === "startup"
      ? "A lead investor who knows B2B lending"
      : role === "investor"
        ? "Seed rounds in supply-chain software, ₹1 to 5 Cr"
        : "Distributors in Tamil Nadu with cold-chain reach";

  const handleContinue = async () => {
    if (!cfg || !intent) return;
    // The rest of the profile was saved to the database on the Profile step; the server completes it from there.
    const base = (data.profilePayload as UserProfilePayload | undefined) ?? ({} as UserProfilePayload);
    setSaving(true);
    try {
      const res = await buildProfile({ ...base, [cfg.column]: intent, intent_note: note.trim() } as UserProfilePayload);
      toast.success(res.message ?? "Profile saved.");
      setData({
        [cfg.section]: { ...((data[cfg.section] as Record<string, unknown> | undefined) ?? {}), [cfg.field]: intent },
        profilePayload: { ...base, [cfg.column]: intent, intent_note: note.trim() },
        intentNote: note,
      });
      goNext("intent");
    } catch (err) {
      const e = err as ApiError;
      const fieldErrs = (e.data as { data?: { field: string; message: string }[] } | undefined)?.data;
      toast.error(fieldErrs?.[0]?.message ?? e.message ?? "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const sentence = (l: string) => l.charAt(0) + l.slice(1).toLowerCase();

  return (
    <div className="bp">
      <div className="ob">
        <div className="ob-top">
          <div className="brand" aria-label="Bridge Platform">
            <BrandLockup />
          </div>
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
            <Link className="back" href="/registration/complete-profile">
              <ArrowLeft size={14} /> Back
            </Link>
            <div>
              <h2>What are you looking for?</h2>
              <p className="lede">This shapes every introduction we make for you. You can change it any time.</p>
            </div>

            <div className="stack" style={{ ["--g" as string]: "8px" }} role="radiogroup" aria-label="Your intent">
              {(cfg?.options ?? []).map((o) => (
                <label key={o.value} className="choice">
                  <input type="radio" name="intent" value={o.value} checked={intent === o.value} onChange={() => pick(o.value)} />
                  <strong>{sentence(o.label)}</strong>
                  <span>{INTENT_DESC[o.value] ?? ""}</span>
                </label>
              ))}
            </div>

            <div className="field">
              <label htmlFor="intentNote">Anything specific? (optional)</label>
              <textarea id="intentNote" rows={2} maxLength={300} placeholder={placeholder} value={note} onChange={(e) => {
                  noteTouched.current = true;
                  setNote(e.target.value);
                }} />
            </div>

            <div className="foot">
              <span className="spacer" />
              <button className="btn primary" type="button" onClick={handleContinue} disabled={!intent || saving}>
                {saving ? <span className="spin" /> : "Continue"}
              </button>
            </div>
            <p className="helper-missing">{intent ? "" : "Choose what you’re looking for to continue."}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
