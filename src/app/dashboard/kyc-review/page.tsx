"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/input";
import { AsyncState } from "@/components/ui/AsyncState";
import { useAuth } from "@/components/auth/AuthProvider";
import { KycReviewDrawer } from "@/components/dashboard/KycReviewDrawer";
import { KYC_REVIEW_STATUS_META, StatusPill } from "@/components/dashboard/kyc-status";
import { fetchKycSubmissions } from "@/services/admin.service";
import { initials, formatDate } from "@/lib/admin-format";
import { isStaffRole } from "@/lib/roles";
import type { KycReviewStatus, KycSubmissionListItem } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const TABS: { value: "all" | Lowercase<KycReviewStatus>; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];
type Tab = (typeof TABS)[number]["value"];

export default function KycReviewPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<KycSubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KycSubmissionListItem | null>(null);

  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  // The backend returns every submission in one call; tabs filter on company kyc_status.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchKycSubmissions()
      .then((res) => setItems(res.data))
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading; runs once on mount
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (tab !== "all" && item.status !== (tab.toUpperCase() as KycReviewStatus)) return false;
      if (!q) return true;
      return (
        item.applicantName.toLowerCase().includes(q) ||
        (item.email ?? "").toLowerCase().includes(q) ||
        (item.organizationName ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, tab, search]);

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
          KYC Review
        </h1>
        <p className="mt-1 text-on-surface-variant">Review and verify pending KYC submissions.</p>
      </div>

      {/* Tabs + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-container-high p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.value
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search submissions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            adornment={<Icon name="search" size={18} />}
          />
        </div>
      </div>

      {/* List */}
      <Card surface="lowest" padding="none" className="overflow-hidden">
        <AsyncState
          loading={loading}
          error={error}
          onRetry={load}
          isEmpty={filtered.length === 0}
          emptyIcon="inbox"
          emptyText="No submissions in this tab."
        >
          <ul className="divide-y divide-outline/5">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-container-low"
                >
                  <Avatar photoKey={item.photoKey} alt={item.applicantName} className="size-9 shrink-0 rounded-full">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                      {initials(item.applicantName)}
                    </div>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">{item.applicantName}</p>
                    <p className="truncate text-xs text-on-surface-variant">{item.email}</p>
                    <p className="truncate text-xs text-on-surface-variant md:hidden">
                      {item.documents
                        .map((doc) => `${doc.type}: ${KYC_REVIEW_STATUS_META[doc.status].label}`)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="hidden min-w-0 flex-1 text-sm text-on-surface md:block">
                    <p className="truncate">{item.organizationName ?? "—"}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {item.documents
                        .map((doc) => `${doc.type}: ${KYC_REVIEW_STATUS_META[doc.status].label}`)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-xs text-on-surface-variant sm:block">
                    {item.submittedAt ? `Submitted ${formatDate(item.submittedAt)}` : ""}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                      Account
                    </span>
                    <StatusPill {...KYC_REVIEW_STATUS_META[item.status]} />
                  </div>
                  <Icon name="chevron_right" size={20} className="shrink-0 text-on-surface-variant" />
                </button>
              </li>
            ))}
          </ul>
        </AsyncState>
      </Card>

      <KycReviewDrawer submission={selected} onClose={() => setSelected(null)} onReviewed={load} />
    </div>
  );
}
