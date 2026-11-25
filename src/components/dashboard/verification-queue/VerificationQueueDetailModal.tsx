"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/modal/Modal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Loader } from "@/components/common/loader";
import { AsyncState } from "@/components/ui/AsyncState";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { fetchVerificationQueueDetail, reviewKyc } from "@/services/admin.service";
import { VerificationStatusPill } from "./VerificationStatusPill";
import { detailRoleLabel, formatApplicantSize } from "@/lib/verification-queue-format";
import { emitVerificationQueueChanged } from "@/lib/verification-queue-events";
import { formatDateTime } from "@/lib/admin-format";
import { VERIFICATION_REJECTION_REASONS } from "@/config/constant";
import type { VerificationQueueDetail } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const DOC_TYPE_LABELS: Record<string, string> = {
  PAN: "PAN card",
  GST_CERTIFICATE: "GST registration certificate",
  INCORPORATION_CERTIFICATE: "Certificate of incorporation",
  PITCH_DECK: "Pitch deck",
};

const REASON_OPTIONS = VERIFICATION_REJECTION_REASONS.map((r) => ({ value: r.code, label: r.label }));

interface DocRow {
  key: string;
  label: string;
  s3Key: string | null;
}

/** Shown instead of a blank/dash for any value the backend doesn't have yet. */
const NA = "NA";

/** One label/value row — fixed label column so every row's value starts at the same x (S49). */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
      <span className="text-on-surface-variant">{label}</span>
      <span className="flex flex-wrap items-center gap-2">{children}</span>
    </div>
  );
}

/** Flattens one AADHAAR entry (front+back) into two rows; everything else is one row. */
function toDocRows(documents: VerificationQueueDetail["documents"]): DocRow[] {
  return documents.flatMap((d) => {
    if (d.documentType === "AADHAAR") {
      const rows: DocRow[] = [];
      if (d.frontS3Key) rows.push({ key: `${d.documentType}-front`, label: "Aadhaar front", s3Key: d.frontS3Key });
      if (d.backS3Key) rows.push({ key: `${d.documentType}-back`, label: "Aadhaar back", s3Key: d.backS3Key });
      return rows;
    }
    return d.frontS3Key
      ? [{ key: d.documentType, label: DOC_TYPE_LABELS[d.documentType] ?? d.documentType, s3Key: d.frontS3Key }]
      : [];
  });
}

/**
 * Detail modal for one applicant on the Verification queue (FRD §12.5, §4.7). Centered
 * modal (not a side drawer) per the new design — see Bridge_App_Design.pdf S49.
 * Approve/Reject reuse the same company-level `reviewKyc` action as the old KYC Review
 * screen; "Book screening call" has no backend yet (feature still in discussion) and is
 * rendered disabled, performing no action.
 */
export function VerificationQueueDetailModal({
  companyId,
  onClose,
  onReviewed,
}: {
  companyId: string | null;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [detail, setDetail] = useState<VerificationQueueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVE" | "REJECT" | null>(null);
  const [previewS3Key, setPreviewS3Key] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the closed modal's state
      setDetail(null);
      setReasonCode("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchVerificationQueueDetail(companyId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const submit = async (action: "APPROVE" | "REJECT") => {
    if (!detail) return;
    if (action === "REJECT" && !reasonCode) {
      toast.error("Choose a reason before rejecting.");
      return;
    }
    const reasonLabel = REASON_OPTIONS.find((r) => r.value === reasonCode)?.label;
    setSubmitting(action);
    try {
      await reviewKyc(detail.companyId, { action, note: action === "REJECT" ? reasonLabel : undefined });
      toast.success(action === "APPROVE" ? "Applicant approved." : "Applicant rejected.");
      emitVerificationQueueChanged();
      onReviewed();
      onClose();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setSubmitting(null);
    }
  };

  const mismatch = detail && (detail.nameMatchStatus === "FAILED" || detail.nameMatchStatus === "CHECK") && detail.nameMatchNote;

  return (
    <>
      <Modal
        open={companyId != null}
        onClose={onClose}
        // A tight name + subtitle block (no header divider) matching the S49 mockup,
        // instead of Modal's default single-line title with a border under it.
        headerContent={
          <div className="min-w-0 flex-1">
            {/* `applicantName` can be empty for an applicant who hasn't filled their name
                yet (early/incomplete registration) — `||` catches that, `??` would not. */}
            <p className="truncate font-headline text-lg font-bold text-on-surface sm:text-xl">
              {detail?.applicantName || detail?.companyName || "Applicant"}
            </p>
            {detail && (
              <p className="truncate text-sm text-on-surface-variant">
                {detail.companyName || NA} · {detailRoleLabel(detail.role)}
                {detail.city?.trim() ? ` · ${detail.city}` : ""}
              </p>
            )}
          </div>
        }
        headerBorder={false}
        maxWidthClass="max-w-xl"
        closeDisabled={submitting != null}
        footer={
          detail ? (
            <>
              <Button
                variant="secondary"
                disabled
                title="Screening calls are not available yet"
              >
                Book screening call
              </Button>
              {/* "Danger" style per the design system (page 4) — same size as every other
                  button here, just outline-red instead of filled. */}
              <Button
                variant="secondary"
                className="border border-error/30 !bg-transparent !text-error hover:!bg-error/10"
                disabled={submitting != null || !reasonCode}
                onClick={() => submit("REJECT")}
              >
                {submitting === "REJECT" ? <Loader size={16} /> : "Reject"}
              </Button>
              {/* "Confirm" style per the design system (page 4) — Approve is the success
                  green, distinct from the blue "Continue" primary used elsewhere. */}
              <Button
                variant="secondary"
                className="!bg-[#1F7A4D] text-white hover:!bg-[#19613f]"
                disabled={submitting != null}
                onClick={() => submit("APPROVE")}
              >
                {submitting === "APPROVE" ? <Loader size={16} /> : "Approve"}
              </Button>
            </>
          ) : null
        }
      >
        <AsyncState loading={loading} error={error}>
          {detail && (
            <div className="flex flex-col gap-5">
              {mismatch && (
                <div className="flex items-start gap-2 rounded-xl bg-[#FDF3E2] p-3 text-sm text-[#B26A00]">
                  <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
                  <span>{detail.nameMatchNote}</span>
                </div>
              )}

              <div className="flex flex-col gap-2.5 text-sm">
                <DetailRow label="Submitted">
                  <span className="font-medium text-on-surface">{formatDateTime(detail.submittedAt ?? undefined)}</span>
                </DetailRow>

                <DetailRow label="GSTIN">
                  <span className="font-medium text-on-surface">{detail.gstin ?? NA}</span>
                  <VerificationStatusPill status={detail.gstStatus} />
                </DetailRow>

                <DetailRow label="CIN / LLPIN">
                  <span className="font-medium text-on-surface">{detail.cin ?? NA}</span>
                  <VerificationStatusPill status={detail.mcaStatus} />
                </DetailRow>

                <DetailRow label="PAN">
                  <VerificationStatusPill status={detail.panStatus} />
                </DetailRow>

                <DetailRow label="Name match">
                  <VerificationStatusPill status={detail.nameMatchStatus} />
                </DetailRow>

                <DetailRow label="Size">
                  <span className="font-medium text-on-surface">{formatApplicantSize(detail) || NA}</span>
                </DetailRow>

                <DetailRow label="Vouched by">
                  <span className="font-medium text-on-surface">{detail.vouchedByName ?? NA}</span>
                </DetailRow>

                <DetailRow label="Re-submissions">
                  <span className="font-medium text-on-surface">{detail.kycRejectionCount}</span>
                </DetailRow>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Documents</h3>
                {toDocRows(detail.documents).length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No documents uploaded yet.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-outline/10">
                    {toDocRows(detail.documents).map((row, i) => (
                      <div
                        key={row.key}
                        className={`flex items-center justify-between px-3 py-2.5 text-sm ${i > 0 ? "border-t border-outline/10" : ""}`}
                      >
                        <span className="text-on-surface">{row.label}</span>
                        <button
                          type="button"
                          onClick={() => setPreviewS3Key(row.s3Key)}
                          className="font-semibold text-primary hover:underline"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Select
                label="Reason (required to reject)"
                placeholder="Choose a reason"
                options={REASON_OPTIONS}
                value={reasonCode}
                onChange={setReasonCode}
              />
            </div>
          )}
        </AsyncState>
      </Modal>

      <DocumentPreviewModal s3Key={previewS3Key} onClose={() => setPreviewS3Key(null)} />
    </>
  );
}
