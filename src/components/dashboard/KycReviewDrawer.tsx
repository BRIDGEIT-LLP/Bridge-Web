"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Textarea } from "@/components/ui/Textarea";
import { Loader } from "@/components/common/loader";
import { DocumentPreviewModal } from "@/components/onboarding/DocumentPreviewModal";
import { reviewKyc, reviewKycDocument } from "@/services/admin.service";
import { initials, formatDate } from "@/lib/admin-format";
import { KYC_REVIEW_STATUS_META, StatusPill } from "@/components/dashboard/kyc-status";
import type { KycDocument, KycReviewStatus, KycSubmissionListItem, ReviewKycPayload } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

/** A section heading inside the drawer. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-on-surface-variant">{children}</h3>;
}

/**
 * Compact per-document Approve/Reject control. Renders as a subtle outlined chip
 * that fills in (primary for approve, error for reject) once that decision is the
 * document's current status — so the chosen state reads clearly without color noise.
 */
function DocActionButton({
  icon,
  label,
  active,
  tone,
  loading,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  tone: "approve" | "reject";
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const base = "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50";
  const activeCls =
    tone === "approve"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-error/30 bg-error/10 text-error";
  const idleCls =
    tone === "approve"
      ? "border-outline/20 text-on-surface hover:bg-surface-container-high"
      : "border-outline/20 text-error hover:bg-error/10";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${active ? activeCls : idleCls}`}>
      {loading ? <Loader size={14} /> : <Icon name={icon} size={16} />}
      {label}
    </button>
  );
}

/**
 * Right-side drawer to review one KYC submission. The `get-user-kyc_docs` list
 * response already carries the applicant + every document, so this renders the
 * passed-in row directly (no extra fetch). Each document side (front/back) opens
 * in the shared `DocumentPreviewModal`. Document actions come first; company
 * Approve / Reject stay visible and only enable after every document is decided.
 */
export function KycReviewDrawer({
  submission,
  onClose,
  onReviewed,
}: {
  submission: KycSubmissionListItem | null;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<ReviewKycPayload["action"] | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // Per-document review state: optimistic status override + which doc is in-flight.
  const [docStatus, setDocStatus] = useState<Record<number, KycReviewStatus>>({});
  const [docSubmitting, setDocSubmitting] = useState<number | null>(null);

  // Reset note + per-doc overrides each time a different submission opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets on open
    setNote("");
    setDocStatus({});
  }, [submission?.id]);

  // Effective per-document statuses (optimistic override layered over backend
  // status, so this is correct on refresh and back/forward navigation too).
  const docStatuses = submission?.documents.map((doc) => docStatus[doc.kycId] ?? doc.status) ?? [];
  const anyDocPending = docStatuses.length === 0 || docStatuses.some((s) => s === "PENDING");
  const anyDocRejected = docStatuses.some((s) => s === "REJECTED");
  const allDocsApproved = docStatuses.length > 0 && docStatuses.every((s) => s === "APPROVED");
  // Company action only after every document has a decision, and only while the
  // account itself is still pending.
  const accountPending = submission?.status === "PENDING";
  const canApproveAccount = Boolean(accountPending && allDocsApproved);
  const canRejectAccount = Boolean(accountPending && !anyDocPending && anyDocRejected);

  // Approve / reject a single document (document-action endpoint; optimistic UI).
  // The document-level API takes only kyc_id + action — no reason — so no note check.
  const reviewDocument = async (doc: KycDocument, action: "APPROVE" | "REJECT") => {
    const current = docStatus[doc.kycId] ?? doc.status;
    if (current !== "PENDING") return;
    setDocSubmitting(doc.kycId);
    try {
      const res = await reviewKycDocument(doc.kycId, action);
      const next: KycReviewStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      setDocStatus((m) => ({ ...m, [doc.kycId]: next }));
      toast.success(res.message ?? `Document ${action === "APPROVE" ? "approved" : "rejected"}.`);
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setDocSubmitting(null);
    }
  };

  const submitReview = async (action: ReviewKycPayload["action"]) => {
    if (!submission) return;
    if (action === "APPROVE" && !canApproveAccount) return;
    if (action === "REJECT" && !canRejectAccount) return;
    if (action !== "APPROVE" && !note.trim()) {
      toast.error("Please add a note explaining the decision.");
      return;
    }
    if (submission.companyId == null) {
      toast.error("This submission is missing its company reference.");
      return;
    }
    setSubmitting(action);
    try {
      const res = await reviewKyc(submission.companyId, { action, note: note.trim() || undefined });
      toast.success(res.message ?? "Review submitted.");
      onReviewed();
      onClose();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setSubmitting(null);
    }
  };

  const footer = submission ? (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => submitReview("REQUEST_INFO")}
        disabled={submitting !== null || !accountPending}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-50"
      >
        {submitting === "REQUEST_INFO" ? <Loader size={16} /> : <Icon name="mail" size={18} />}
        Request Info
      </button>
      <button
        type="button"
        onClick={() => submitReview("REJECT")}
        disabled={submitting !== null || !canRejectAccount}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-error/40 px-4 text-sm font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
      >
        {submitting === "REJECT" ? <Loader size={16} /> : <Icon name="cancel" size={18} />}
        Reject
      </button>
      <button
        type="button"
        onClick={() => submitReview("APPROVE")}
        disabled={submitting !== null || !canApproveAccount}
        className="cta-gradient flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-on-primary transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {submitting === "APPROVE" ? <Loader size={16} /> : <Icon name="task_alt" size={18} />}
        Approve
      </button>
    </div>
  ) : null;

  const phone = submission
    ? `${submission.countryCode ? `${submission.countryCode} ` : ""}${submission.phone ?? ""}`.trim()
    : "";

  return (
    <Drawer
      open={submission !== null}
      onClose={onClose}
      title={submission?.applicantName ?? "KYC Review"}
      subtitle={submission?.organizationName}
      widthClass="max-w-lg"
      footer={footer}
    >
      {submission && (
        <>
          {/* Applicant */}
          <div className="flex items-center gap-4">
            <Avatar
              photoKey={submission.photoKey}
              alt={submission.applicantName}
              className="size-14 shrink-0 rounded-full"
            >
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline text-lg font-bold text-on-primary-container">
                {initials(submission.applicantName)}
              </div>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-0.5">
              {submission.email && (
                <p className="flex items-center gap-1.5 truncate text-sm text-on-surface-variant">
                  <Icon name="mail" size={15} /> {submission.email}
                </p>
              )}
              {phone && (
                <p className="flex items-center gap-1.5 truncate text-sm text-on-surface-variant">
                  <Icon name="call" size={15} /> {phone}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Account status</span>
              <StatusPill {...KYC_REVIEW_STATUS_META[submission.status]} />
            </div>
          </div>

          {submission.submittedAt && (
            <p className="mt-3 text-xs text-on-surface-variant">Submitted {formatDate(submission.submittedAt)}</p>
          )}

          {/* Documents */}
          <SectionTitle>Uploaded Documents</SectionTitle>
          <div className="space-y-3">
            {submission.documents.map((doc) => {
              const status = docStatus[doc.kycId] ?? doc.status;
              const busy = docSubmitting === doc.kycId;
              return (
                <div key={doc.kycId} className="rounded-xl border border-outline/10 bg-surface-container-low p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                      <Icon name="description" size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">{doc.type}</p>
                      {doc.documentNumber ? (
                        <p className="truncate font-mono text-xs tracking-wide text-on-surface-variant">
                          {doc.documentNumber}
                        </p>
                      ) : (
                        <p className="truncate text-xs text-on-surface-variant">
                          {doc.sides.length} file{doc.sides.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                        Document status
                      </span>
                      <StatusPill {...KYC_REVIEW_STATUS_META[status]} />
                    </div>
                  </div>

                  {/* Front / Back view buttons */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {doc.sides.map((side) => (
                      <button
                        key={side.s3Key}
                        type="button"
                        onClick={() => setPreviewKey(side.s3Key)}
                        className="flex items-center gap-1 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:text-primary-dim"
                      >
                        <Icon name="visibility" size={16} />
                        {side.label}
                      </button>
                    ))}
                  </div>

                  {doc.rejectionReason && <p className="mt-2 text-xs text-error">Rejected: {doc.rejectionReason}</p>}

                  {/* Always shown — enabled only while this document is still pending. */}
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-outline/10 pt-3">
                    <DocActionButton
                      icon="check_circle"
                      label="Approve"
                      active={status === "APPROVED"}
                      tone="approve"
                      loading={busy}
                      disabled={busy || status !== "PENDING"}
                      onClick={() => reviewDocument(doc, "APPROVE")}
                    />
                    <DocActionButton
                      icon="cancel"
                      label="Reject"
                      active={status === "REJECTED"}
                      tone="reject"
                      loading={busy}
                      disabled={busy || status !== "PENDING"}
                      onClick={() => reviewDocument(doc, "REJECT")}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Account reject note — company.kyc_rejection_reason, not per-document. */}
          {submission.status === "REJECTED" && (
            <div className="mt-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-on-surface">
              <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-error">Rejection reason</p>
              {submission.rejectionReason?.trim() || "No reason provided."}
            </div>
          )}

          {/* Admin notes — only while the account can still be decided. */}
          {accountPending && (
            <>
              <SectionTitle>Admin Notes</SectionTitle>
              <Textarea
                placeholder="Add a note (required to reject or request info)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </>
          )}
        </>
      )}

      <DocumentPreviewModal s3Key={previewKey} onClose={() => setPreviewKey(null)} />
    </Drawer>
  );
}
