"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { AsyncState } from "@/components/ui/AsyncState";
import { useAuth } from "@/components/auth/AuthProvider";
import { VerificationStatusPill } from "@/components/dashboard/verification-queue/VerificationStatusPill";
import { VerificationQueueDetailModal } from "@/components/dashboard/verification-queue/VerificationQueueDetailModal";
import { TablePager } from "@/components/dashboard/TablePager";
import { fetchVerificationQueue } from "@/services/admin.service";
import { initials } from "@/lib/admin-format";
import { formatWaiting, isOverdue, queueRoleLabel } from "@/lib/verification-queue-format";
import { isStaffRole } from "@/lib/roles";
import type { VerificationQueueListItem } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const PAGE_SIZE = 10;

/** Table headers (S48). A real `<table>` — not a CSS grid — so header and row columns
 *  are guaranteed to line up regardless of each column's content width. */
const COLUMNS: { label: string; className?: string }[] = [
  { label: "Applicant", className: "pl-8" },
  { label: "Role" },
  { label: "GST" },
  { label: "MCA" },
  { label: "PAN" },
  { label: "Name match" },
  { label: "Vouch" },
  { label: "Waiting" },
  { label: "", className: "pr-8 text-right" },
];

/**
 * Admin-only Verification queue (FRD §12.5) — replaces the old KYC Review screen.
 * Only reads data captured earlier (registration's business check + documents, plus
 * the not-yet-built vouch/name-match pieces, which render as "Waiting"/"—" until those
 * features exist); this screen takes no new input of its own besides the review decision.
 */
export default function VerificationQueuePage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [items, setItems] = useState<VerificationQueueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchVerificationQueue()
      .then(setItems)
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading; runs once on mount
    load();
  }, [load]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage]
  );
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      <div className="mb-5">
        <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
          Verification queue
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Oldest first. Target: a decision within 24 hours.
        </p>
      </div>

      <Card surface="lowest" padding="none" className="overflow-hidden">
        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          isEmpty={items.length === 0}
          emptyIcon="verified_user"
          emptyText="Nothing waiting on review."
        >
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      className={`border-b border-outline/10 bg-surface-container-lowest px-5 py-3 text-sm font-bold text-on-surface-variant ${col.className ?? ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item) => {
                  const overdue = isOverdue(item.submittedAt);
                  return (
                    <tr
                      key={item.companyId}
                      className="group transition-colors last:[&>td]:border-0 hover:bg-surface-container-low [&>td]:border-b [&>td]:border-outline/5"
                    >
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar photoKey={item.photoKey} alt={item.applicantName} className="size-9 shrink-0 rounded-full">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                              {initials(item.applicantName)}
                            </div>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-on-surface">{item.applicantName}</p>
                            <p className="truncate text-xs text-on-surface-variant">{item.companyName ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{queueRoleLabel(item.role)}</td>
                      <td className="px-5 py-4"><VerificationStatusPill status={item.gstStatus} /></td>
                      <td className="px-5 py-4"><VerificationStatusPill status={item.mcaStatus} /></td>
                      <td className="px-5 py-4"><VerificationStatusPill status={item.panStatus} /></td>
                      <td className="px-5 py-4"><VerificationStatusPill status={item.nameMatchStatus} /></td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{item.vouchedByName ?? "—"}</td>
                      <td className={`px-5 py-4 text-sm font-semibold ${overdue ? "text-error" : "text-on-surface-variant"}`}>
                        {formatWaiting(item.submittedAt)}
                      </td>
                      <td className="py-4 pl-5 pr-8 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCompanyId(item.companyId)}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim"
                        >
                          Review
                          <Icon name="chevron_right" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <TablePager
            page={safePage}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={total}
            noun="applicants"
            onPage={setPage}
          />
        </AsyncState>
      </Card>

      <VerificationQueueDetailModal
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
        onReviewed={load}
      />
    </div>
  );
}
