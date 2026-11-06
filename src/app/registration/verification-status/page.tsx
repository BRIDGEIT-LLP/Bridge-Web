"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLockup } from "@/components/layout/navbar";
import Link from "next/link";
import { Check, Clock, ShieldCheck, ShieldX } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { logoutSession } from "@/lib/logout";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { getBusinessCheck, type BusinessCheckData } from "@/services/user.service";
import "../registration.css";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { DocumentUploadCard, type ScannedDoc, type UploadSlot } from "@/components/onboarding/DocumentUploadCard";
import { DOC_MAX_MB } from "@/config/docTypes";
import { getKycDocs } from "@/services/file.service";
import { saveKycInfo } from "@/services/kyc.service";
import { AADHAAR_REGEX, PAN_REGEX } from "@/lib/validation";
import type { GetKycDocsResponse, KycDocEntry, KycDocFile, KycReviewStatus, SaveKycInfoPayload } from "@/types/api.types";
import { toast } from "sonner";
import type { ApiError } from "@/lib/axios";

/** Company / document review state on this page. */
type ReviewState = KycReviewStatus;

/** Map backend title-case (`Approved` / `Rejected` / `Pending`) to the review enum. */
function toReviewState(status?: string | null): ReviewState {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "APPROVED" || s === "VERIFIED") return "APPROVED";
  if (s === "REJECTED") return "REJECTED";
  return "PENDING";
}

const ACCOUNT_COPY: Record<ReviewState, { title: string; body: (email: string) => string }> = {
  PENDING: {
    title: "Your application is with us",
    body: (email) =>
      `Verification is usually done within 24 hours. We'll email ${email || "you"} and send an SMS as soon as it's done. Nothing else on Bridge opens until then.`,
  },
  APPROVED: {
    title: "You're verified",
    body: () => "Your documents have been verified and your account is approved. You can continue to the dashboard.",
  },
  REJECTED: {
    title: "We couldn't verify your application",
    body: () => "Please review the reason below, then upload the corrected documents.",
  },
};

/** One received document on the status checklist. */
interface SubmittedDoc {
  label: string;
  fileName: string | null;
  status: ReviewState;
}

type DocType = "AADHAAR" | "PAN";
type AnyDocType = "AADHAAR" | "PAN" | "GST_CERTIFICATE" | "INCORPORATION_CERTIFICATE" | "PITCH_DECK";
type DocsByType = Partial<Record<AnyDocType, KycDocEntry>>;

/**
 * Per-document config for the re-upload cards — the same card/validation setup the
 * document-upload step uses, so a resubmission collects exactly the same shape. The map
 * key doubles as the scan API's `docType`.
 */
const REUPLOAD_CONFIG: Record<
  DocType,
  { title: string; subtitle: string; icon: string; slots: UploadSlot[]; numberLabel: string; maxLength: number; placeholder: string; uppercase: boolean; test: (v: string) => boolean; numberError: string }
> = {
  AADHAAR: {
    title: "Aadhaar Card",
    subtitle: "Front and back view required",
    icon: "badge",
    slots: [
      { key: "front", label: "Front Side", side: "front" },
      { key: "back", label: "Back Side", side: "back" },
    ],
    numberLabel: "Aadhaar Number",
    maxLength: 12,
    placeholder: "1234 5678 9012",
    uppercase: false,
    test: (v) => AADHAAR_REGEX.test(v),
    numberError: "Enter a valid 12-digit Aadhaar number.",
  },
  PAN: {
    title: "PAN Card",
    subtitle: "Clear photo of the original card",
    icon: "credit_card",
    slots: [{ key: "pan", label: "PAN Card" }],
    numberLabel: "PAN Number",
    maxLength: 10,
    placeholder: "ABCDE1234F",
    uppercase: true,
    test: (v) => PAN_REGEX.test(v.toUpperCase()),
    numberError: "Enter a valid PAN (e.g. ABCDE1234F).",
  },
};

/** Map a scanned slot to the save-kyc-info file shape (s3 key + file metadata). */
const toKycFile = (doc: ScannedDoc): KycDocFile => ({
  s3_key: doc.s3Key,
  mimetype: doc.mimetype,
  file_name: doc.fileName,
  file_size: doc.fileSize,
});

/**
 * The document types the user is allowed to replace, given the submission was rejected.
 *
 * Normally the reviewer marks the offending documents `Rejected` one by one before
 * rejecting the submission, and only those are offered. But the admin's Reject button is
 * only blocked when every document is already approved — so a reviewer can reject the
 * submission outright with every document still `Pending`. That left the user staring at
 * a rejection banner with nothing to act on, so fall back to every submitted type.
 */
function collectRejectedTypes(byType: DocsByType): DocType[] {
  const types = Object.keys(REUPLOAD_CONFIG) as DocType[];
  const flagged = types.filter((t) => byType[t]?.status?.toLowerCase() === "rejected");
  return flagged.length > 0 ? flagged : types.filter((t) => !!byType[t]);
}

/**
 * Merge the API's `docDetails` (an array of single-key objects like `[{AADHAAR:…},{PAN:…}]`)
 * into one lookup keyed by document type, so order/labels stay fixed regardless of how the
 * backend orders the array.
 */
function mergeDocDetails(docDetails: GetKycDocsResponse["docDetails"]): DocsByType {
  return Object.assign({}, ...(docDetails ?? [])) as DocsByType;
}

/** Ordered checklist rows from the merged lookup, in the order the Documents step asks for them. */
function buildSubmittedDocs(byType: DocsByType, isB2B: boolean): SubmittedDoc[] {
  const row = (label: string, entry?: KycDocEntry, file?: KycDocFile): SubmittedDoc | null =>
    file?.s3_key ? { label, fileName: file.file_name ?? null, status: toReviewState(entry?.status) } : null;
  return [
    row(isB2B ? "Company PAN card" : "PAN card", byType.PAN, byType.PAN?.front),
    row("Aadhaar, front", byType.AADHAAR, byType.AADHAAR?.front),
    row("Aadhaar, back", byType.AADHAAR, byType.AADHAAR?.back),
    row("GST registration certificate", byType.GST_CERTIFICATE, byType.GST_CERTIFICATE?.front),
    row("Certificate of incorporation", byType.INCORPORATION_CERTIFICATE, byType.INCORPORATION_CERTIFICATE?.front),
    row("Pitch deck", byType.PITCH_DECK, byType.PITCH_DECK?.front),
  ].filter((d): d is SubmittedDoc => !!d);
}

/** One line of the status checklist: a green tick (or a hollow/red marker) with a title and a small sub-line. */
function StatusRow({ title, sub, kind = "" }: { title: string; sub?: string | null; kind?: "" | "wait" | "bad" }) {
  return (
    <li>
      <span className={`st-dot${kind ? " " + kind : ""}`}>{kind ? null : <Check size={11} strokeWidth={3} />}</span>
      <div>
        <p className="st-t">{title}</p>
        {sub ? <p className="st-s">{sub}</p> : null}
      </div>
    </li>
  );
}

export default function VerificationStatusPage() {
  const [kyc, setKyc] = useState<GetKycDocsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [biz, setBiz] = useState<BusinessCheckData | null>(null);
  const { data: onboarding } = useOnboarding();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  // Re-upload state, keyed by document type: freshly scanned files, the retyped number,
  // and the in-flight/validation state of the resubmission.
  const [reFiles, setReFiles] = useState<Partial<Record<DocType, Record<string, ScannedDoc>>>>({});
  const [reNumbers, setReNumbers] = useState<Partial<Record<DocType, string>>>({});
  // Which numbers the user has unlocked with the pencil — locked by default so the
  // pre-filled value isn't edited by accident when only the photo was the problem.
  const [editingNumbers, setEditingNumbers] = useState<Partial<Record<DocType, boolean>>>({});
  const [resubmitting, setResubmitting] = useState(false);

  // Set to true by the mount effect's cleanup, and checked before every setState below:
  // load() is awaited both on mount and from handleResubmit, so navigating away with
  // either fetch in flight would otherwise update an unmounted component.
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const [res, bizRes] = await Promise.all([getKycDocs(), getBusinessCheck().catch(() => null)]);
      if (cancelled.current) return;
      setKyc(res);
      setBiz(bizRes?.data ?? null);
      setLoadError(null);
    } catch (err) {
      if (cancelled.current) return;
      setLoadError((err as ApiError)?.message || "Couldn't load your verification status.");
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, []);

  // Fetch the submitted documents + submission/expiry timestamps on mount.
  useEffect(() => {
    cancelled.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() drives loading state
    load();
    return () => {
      cancelled.current = true;
    };
  }, [load]);

  const byType = useMemo(() => (kyc ? mergeDocDetails(kyc.docDetails) : {}), [kyc]);
  const isB2B = biz?.role === "B2B";
  const submitted = buildSubmittedDocs(byType, isB2B);
  const panNumber = byType.PAN?.number || biz?.pan_number || "";
  // Company-level `kycStatus` is the account decision. Pending keeps the countdown;
  // approved / rejected swap the hero copy (rejected also shows the admin's reason).
  const accountStatus = toReviewState(kyc?.kycStatus);
  const isRejected = accountStatus === "REJECTED";
  // From the first rejection until approval (counter-based, so it also shows after a
  // resubmission has moved the status back to Pending). `maxRejections` is configurable.
  const showAttemptsWarning =
    (kyc?.kycRejectionCount ?? 0) >= 1 &&
    accountStatus !== "APPROVED" &&
    kyc?.attemptsRemaining != null &&
    kyc.attemptsRemaining >= 1 &&
    kyc.maxRejections != null;
  const isLastAttempt = kyc?.attemptsRemaining === 1;
  const attemptsMessage = isLastAttempt
    ? "This is your last attempt. If your KYC is rejected again, this account will be blocked."
    : `Your KYC has been rejected ${kyc?.kycRejectionCount} of ${kyc?.maxRejections} times. ${kyc?.attemptsRemaining} attempts remaining before this account is blocked.`;

  // Warn on arrival (not at sign-in). The fixed id stops a duplicate toast on re-render.
  useEffect(() => {
    if (showAttemptsWarning) toast.warning(attemptsMessage, { id: "kyc-attempts-warning", duration: 10000 });
  }, [showAttemptsWarning, attemptsMessage]);
  const isApproved = accountStatus === "APPROVED";
  const isPending = accountStatus === "PENDING";
  const copy = ACCOUNT_COPY[accountStatus];

  // Only the documents the reviewer actually flagged can be replaced here.
  const rejectedTypes = isRejected ? collectRejectedTypes(byType) : [];
  /** The number to send for a type: whatever they retyped, else the one already on file. */
  const numberFor = (t: DocType) => reNumbers[t] ?? byType[t]?.number ?? "";
  const canResubmit =
    rejectedTypes.length > 0 &&
    rejectedTypes.every((t) => {
      const cfg = REUPLOAD_CONFIG[t];
      return cfg.slots.every((s) => !!reFiles[t]?.[s.key]) && cfg.test(numberFor(t));
    });

  const handleResubmit = async () => {
    const payload: SaveKycInfoPayload = {};
    for (const t of rejectedTypes) {
      const cfg = REUPLOAD_CONFIG[t];
      const files = reFiles[t] ?? {};
      const number = cfg.uppercase ? numberFor(t).toUpperCase() : numberFor(t);
      if (t === "AADHAAR") {
        payload.AADHAAR = { number, front: toKycFile(files.front), back: toKycFile(files.back) };
      } else {
        payload.PAN = { number, front: toKycFile(files.pan) };
      }
    }

    setResubmitting(true);
    try {
      const res = await saveKycInfo(payload);
      toast.success(res.message ?? "Documents resubmitted for verification.");
      // The backend clears the company-level rejection on resubmit, so re-fetching flips
      // this page back to the "in progress" state.
      setReFiles({});
      setReNumbers({});
      setEditingNumbers({});
      await load();
    } catch (err) {
      toast.error((err as ApiError)?.message ?? "Couldn't resubmit your documents. Please try again.");
    } finally {
      setResubmitting(false);
    }
  };

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

  const email = String(onboarding?.email ?? "");
  const HeroIcon = isApproved ? ShieldCheck : isRejected ? ShieldX : Clock;
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

        <main className="ob-main">
          <section className="ob-card narrow">
            <span className={`st-ico${isApproved ? " ok" : isRejected ? " bad" : ""}`}>
              <HeroIcon size={22} />
            </span>
            <div>
              <h2>{copy.title}</h2>
              <p className="lede">{copy.body(email)}</p>
            </div>

            {showAttemptsWarning && <p className="st-warn" role="alert">{attemptsMessage}</p>}

            {isRejected && (
              <p className="st-reason">
                <strong>Reason: </strong>
                {kyc?.rejectionReason || "No reason provided."}
              </p>
            )}

            {loading ? (
              <p className="st-help">Loading your application…</p>
            ) : loadError ? (
              <p className="st-reason">{loadError}</p>
            ) : (
              <ul className="st-list">
                <StatusRow title="Mobile and email verified" />
                {biz?.is_gst_verified && biz.gst_number ? <StatusRow title="GSTIN matched" sub={biz.gst_number} /> : null}
                {biz?.is_cin_verified && biz.cin_number ? <StatusRow title="CIN or LLPIN matched" sub={biz.cin_number} /> : null}
                {panNumber ? <StatusRow title={isB2B ? "Company PAN matched" : "Your PAN matched"} sub={panNumber} /> : null}
                {submitted.map((d) => (
                  <StatusRow
                    key={d.label}
                    title={d.label}
                    kind={d.status === "REJECTED" ? "bad" : ""}
                    sub={`${d.fileName ?? "file"} · ${d.status === "REJECTED" ? "needs a new upload" : d.status === "APPROVED" ? "approved" : "received"}`}
                  />
                ))}
                {isPending && <StatusRow title="Founder review" kind="wait" sub="Usually done within 24 hours." />}
              </ul>
            )}

            {/* Replace the rejected documents — only the ones the reviewer flagged. */}
            {rejectedTypes.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="font-headline text-base font-bold text-on-surface">
                  Re-upload rejected document{rejectedTypes.length > 1 ? "s" : ""}
                </h3>

                {/* Document numbers, pre-filled from what's on file and locked until the pencil unlocks one. */}
                <div className="grid grid-cols-1 gap-3">
                  {rejectedTypes.map((t) => {
                    const cfg = REUPLOAD_CONFIG[t];
                    const number = numberFor(t);
                    const numberInvalid = number.length > 0 && !cfg.test(number);
                    const editing = !!editingNumbers[t];
                    return (
                      <Input
                        key={t}
                        id={`${t}-number`}
                        type="text"
                        label={cfg.numberLabel}
                        required
                        maxLength={cfg.maxLength}
                        placeholder={cfg.placeholder}
                        className={cfg.uppercase ? "uppercase" : ""}
                        inputMode={cfg.uppercase ? undefined : "numeric"}
                        value={number}
                        readOnly={!editing}
                        error={numberInvalid ? cfg.numberError : undefined}
                        onChange={(e) => setReNumbers((prev) => ({ ...prev, [t]: e.target.value }))}
                        adornment={
                          <button
                            type="button"
                            onClick={() => setEditingNumbers((prev) => ({ ...prev, [t]: !prev[t] }))}
                            aria-label={`${editing ? "Done editing" : "Edit"} ${cfg.numberLabel}`}
                            className="flex h-full items-center justify-center text-on-surface-variant transition-colors hover:text-primary"
                          >
                            <Icon name={editing ? "check" : "edit"} size={20} />
                          </button>
                        }
                      />
                    );
                  })}
                </div>

                {rejectedTypes.map((t) => {
                  const cfg = REUPLOAD_CONFIG[t];
                  return (
                    <DocumentUploadCard
                      key={t}
                      title={cfg.title}
                      subtitle={cfg.subtitle}
                      icon={cfg.icon}
                      scanType="image"
                      docType={t}
                      slots={cfg.slots}
                      maxSizeMB={DOC_MAX_MB[t]}
                      onChange={(docs) => setReFiles((prev) => ({ ...prev, [t]: docs }))}
                    />
                  );
                })}

                <button className="btn primary block" type="button" disabled={!canResubmit || resubmitting} onClick={handleResubmit}>
                  {resubmitting ? <span className="spin" /> : "Resubmit for verification"}
                </button>
              </div>
            )}

            {isApproved && (
              <Link className="btn primary block" href="/dashboard">
                Go to dashboard
              </Link>
            )}

            <p className="st-help">
              Questions about your application? <a href="mailto:support@bridge.com">Chat with us</a>, Monday to Saturday, 09:00 to 18:00 IST.
            </p>
          </section>
        </main>
      </div>
      <DocumentPreviewModal s3Key={previewKey} onClose={() => setPreviewKey(null)} />
    </div>
  );
}
