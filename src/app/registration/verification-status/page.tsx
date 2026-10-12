"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Loader } from "@/components/common/loader";
import { FocusedHeader } from "@/components/onboarding/FocusedHeader";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { DocumentUploadCard, type ScannedDoc, type UploadSlot } from "@/components/onboarding/DocumentUploadCard";
import { DOC_MAX_MB } from "@/config/docTypes";
import { useFilePreview } from "@/lib/useFilePreview";
import { getKycDocs } from "@/services/file.service";
import { saveKycInfo } from "@/services/kyc.service";
import { AADHAAR_REGEX, PAN_REGEX } from "@/lib/validation";
import { KYC_REVIEW_STATUS_META, StatusPill } from "@/components/dashboard/kyc-status";
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

const ACCOUNT_COPY: Record<ReviewState, { icon: string; iconClass: string; title: string; body: string }> = {
  PENDING: {
    icon: "pending_actions",
    iconClass: "bg-primary-container text-primary",
    title: "Verification in Progress",
    body: "We've received your documents. Our compliance team is currently performing a secure audit to ensure your account's safety.",
  },
  APPROVED: {
    icon: "verified_user",
    iconClass: "bg-primary-container text-primary",
    title: "Verification Approved",
    body: "Your documents have been verified. Your account is approved — you can continue to the dashboard.",
  },
  REJECTED: {
    icon: "gpp_bad",
    iconClass: "bg-error-container text-error",
    title: "Verification Unsuccessful",
    body: "Our compliance team couldn't verify your documents. Please review the reason below, then re-upload the corrected documents.",
  },
};

/** A submitted document: label + the s3 key returned by the scan upload. */
interface SubmittedDoc {
  label: string;
  icon: string;
  s3Key: string;
  status: ReviewState;
}

/**
 * One submitted-document tile: lazily loads the watermarked thumbnail for its s3 key
 * and opens the full preview modal on click. Falls back to the document icon while
 * loading or if the thumbnail can't be fetched.
 */
function SubmittedDocTile({ doc, onPreview }: { doc: SubmittedDoc; onPreview: () => void }) {
  const { url, isPdf, loading } = useFilePreview(doc.s3Key);
  const showThumb = url && !isPdf;
  return (
    <button
      type="button"
      onClick={onPreview}
      className="group relative flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-highest text-on-surface-variant transition-colors hover:border-primary/40"
    >
      {showThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <Icon name={loading ? "progress_activity" : doc.icon} size={28} className={loading ? "animate-spin text-primary" : ""} />
          <span className="px-2 text-center text-xs font-semibold">{doc.label}</span>
        </>
      )}

      {/* Label + hover "Preview" hint over the thumbnail */}
      {showThumb && (
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1 text-xs font-bold text-white">
            <Icon name="zoom_in" size={14} /> {doc.label}
          </span>
        </div>
      )}

      <div
        className={`absolute right-2 top-2 rounded-full p-1 ${
          doc.status === "REJECTED"
            ? "bg-error text-white"
            : doc.status === "APPROVED"
              ? "bg-primary text-white"
              : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        <Icon
          name={doc.status === "REJECTED" ? "close" : doc.status === "APPROVED" ? "check" : "schedule"}
          size={12}
        />
      </div>
    </button>
  );
}

const NEXT_STEPS = [
  { icon: "mark_email_unread", text: "You'll receive an email notification as soon as the review is complete." },
  { icon: "lock", text: "Full account features will be unlocked upon approval." },
  { icon: "support_agent", text: "Our team may contact you if additional information is needed." },
];

function TimeBox({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div className="flex size-12 items-center justify-center rounded-lg bg-surface-container font-headline text-xl font-bold text-on-surface sm:size-16 sm:text-2xl">
        {value}
      </div>
      <span className="text-[11px] uppercase text-on-surface-variant sm:text-xs">{unit}</span>
    </div>
  );
}

type DocType = "AADHAAR" | "PAN";
type DocsByType = Partial<Record<DocType, KycDocEntry>>;

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

/** Ordered tile list from the merged lookup. */
function buildSubmittedDocs(byType: DocsByType): SubmittedDoc[] {
  return [
    { label: "Aadhaar (Front)", icon: "badge", s3Key: byType.AADHAAR?.front?.s3_key, status: toReviewState(byType.AADHAAR?.status) },
    { label: "Aadhaar (Back)", icon: "badge", s3Key: byType.AADHAAR?.back?.s3_key, status: toReviewState(byType.AADHAAR?.status) },
    { label: "PAN Card", icon: "credit_card", s3Key: byType.PAN?.front?.s3_key, status: toReviewState(byType.PAN?.status) },
  ].filter((d): d is SubmittedDoc => !!d.s3Key);
}

export default function VerificationStatusPage() {
  const [kyc, setKyc] = useState<GetKycDocsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
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
      const res = await getKycDocs();
      if (cancelled.current) return;
      setKyc(res);
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

  // Expiry as epoch ms; the countdown is recomputed from this each tick (no drift).
  const expiryMs = useMemo(() => {
    const t = kyc?.expiryTime ? Date.parse(kyc.expiryTime) : NaN;
    return Number.isNaN(t) ? null : t;
  }, [kyc?.expiryTime]);

  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (expiryMs == null) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  const byType = useMemo(() => (kyc ? mergeDocDetails(kyc.docDetails) : {}), [kyc]);
  const submitted = buildSubmittedDocs(byType);
  // Company-level `kycStatus` is the account decision. Pending keeps the countdown;
  // approved / rejected swap the hero copy (rejected also shows the admin's reason).
  const accountStatus = toReviewState(kyc?.kycStatus);
  const isRejected = accountStatus === "REJECTED";
  const isApproved = accountStatus === "APPROVED";
  const isPending = accountStatus === "PENDING";
  const copy = ACCOUNT_COPY[accountStatus];
  const hours = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

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

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center px-4 py-4">
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 rounded-2xl border border-white/40 bg-surface-container-lowest p-4 ambient-shadow sm:p-6 lg:gap-4">
      <FocusedHeader backLabel="Back to Overview" backHref="/registration/document-upload" showLogout />

      {/* <div className="mb-8 mt-4 rounded-xl bg-surface-container-low p-6">
         <StepProgress stepKey="status" showLabels={false} /> 
      </div> */}

      {/* Status hero — pending / approved / rejected from company `kycStatus`. */}
      <div className="flex flex-col items-center text-center sm:px-4">
        <div
          className={`mb-3 flex size-11 items-center justify-center rounded-full shadow-sm sm:size-12 ${copy.iconClass}`}
        >
          <Icon name={copy.icon} size={24} />
        </div>
        <h1 className="mb-2 font-headline text-xl font-extrabold tracking-tight text-on-surface sm:text-2xl md:text-3xl">
          {copy.title}
        </h1>
        <p className="max-w-[600px] text-sm leading-relaxed text-on-surface-variant sm:text-base">
          {copy.body}
        </p>
        <div className="mt-3">
          <StatusPill {...KYC_REVIEW_STATUS_META[accountStatus]} />
        </div>
      </div>

      {/* Why it was rejected — the admin's note from the review, read-only */}
      {isRejected && (
        <div className="flex w-full flex-col gap-2">
          <label
            htmlFor="rejectionReason"
            className="flex items-center gap-2 px-1 font-headline text-sm font-extrabold tracking-tight text-error sm:text-base"
          >
            <Icon name="error" size={20} className="shrink-0" />
            Reason for rejection
          </label>
          <Textarea
            id="rejectionReason"
            value={kyc?.rejectionReason || "No reason provided."}
            readOnly
            rows={3}
            className="cursor-default"
          />
        </div>
      )}

      {/* Timer + info — only while the account review is still pending. */}
      {isPending && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
            <span className="mb-3 text-center font-label text-xs uppercase tracking-wider text-on-surface-variant sm:mb-4 sm:text-sm">
              Estimated Time Remaining
            </span>
            <div className="flex items-center gap-2 sm:gap-4">
              <TimeBox value={loading || expiryMs == null ? "--" : pad(hours)} unit="Hours" />
              <span className="mb-5 text-xl font-bold text-surface-dim sm:mb-6 sm:text-2xl">:</span>
              <TimeBox value={loading || expiryMs == null ? "--" : pad(mins)} unit="Mins" />
              <span className="mb-5 text-xl font-bold text-surface-dim sm:mb-6 sm:text-2xl">:</span>
              <TimeBox value={loading || expiryMs == null ? "--" : pad(secs)} unit="Secs" />
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-high p-4 sm:p-5">
            <h3 className="mb-3 font-headline text-sm font-bold text-on-surface sm:text-base">What happens next?</h3>
            <ul className="space-y-3">
              {NEXT_STEPS.map((s) => (
                <li key={s.text} className="flex items-start gap-2.5 sm:gap-3">
                  <Icon name={s.icon} size={20} className="mt-0.5 shrink-0 text-primary" />
                  <p className="text-xs text-on-surface-variant sm:text-sm">{s.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Submitted documents */}
      <div>
        <h3 className="mb-3 font-headline text-base font-bold text-on-surface sm:text-lg">Submitted Documents</h3>
        {loading ? (
          <p className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-highest px-4 py-6 text-center text-sm text-on-surface-variant">
            <Icon name="progress_activity" size={18} className="animate-spin text-primary" /> Loading your documents…
          </p>
        ) : loadError ? (
          <p className="flex items-center justify-center gap-2 rounded-lg border border-error/30 bg-error-container/30 px-4 py-6 text-center text-sm text-on-error-container">
            <Icon name="error" size={18} className="text-error" /> {loadError}
          </p>
        ) : submitted.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {submitted.map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-2">
                <SubmittedDocTile doc={d} onPreview={() => setPreviewKey(d.s3Key)} />
                <StatusPill {...KYC_REVIEW_STATUS_META[d.status]} />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-outline-variant/20 bg-surface-container-highest px-4 py-6 text-center text-sm text-on-surface-variant">
            No documents found for this session.
          </p>
        )}
      </div>

      {/* Replace the rejected documents — only the ones the reviewer flagged. */}
      {rejectedTypes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">
            Re-upload rejected document{rejectedTypes.length > 1 ? "s" : ""}
          </h3>

          {/* Document numbers, side by side. Pre-filled from what's on file and locked —
              the pencil unlocks one if the number itself was the problem. */}
          <div className={`grid grid-cols-1 gap-3 ${rejectedTypes.length > 1 ? "md:grid-cols-2" : ""}`}>
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

          <Button
            type="button"
            variant="primary"
            disabled={!canResubmit || resubmitting}
            onClick={handleResubmit}
            className="h-12 rounded-xl max-sm:px-4 max-sm:text-sm"
          >
            {resubmitting ? <Loader size={18} /> : "Resubmit for Verification"}
          </Button>
        </div>
      )}

      {isApproved && (
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href="/dashboard" leadingIcon="dashboard" className="w-full sm:w-auto">
            Go to Dashboard
          </Button>
        </div>
      )}
      {/* <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high px-8 font-bold text-on-surface transition-all hover:bg-surface-container-highest sm:w-auto">
          <Icon name="contact_support" size={20} /> Contact Support
        </button>
      </div> */}
      <DocumentPreviewModal s3Key={previewKey} onClose={() => setPreviewKey(null)} />
    </div>
    </div>
  );
}
