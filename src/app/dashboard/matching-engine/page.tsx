"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/input";
import { AsyncState } from "@/components/ui/AsyncState";
import { useAuth } from "@/components/auth/AuthProvider";
import { isStaffRole } from "@/lib/roles";
import { fetchMatchingEngineStats } from "@/services/admin.service";
import type { MatchingEngineStats } from "@/types/api.types";
import type { ApiError } from "@/lib/axios";

const PAGE_SIZE = 10;

// ── Display configs ───────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, { label: string; text: string; bg: string }> = {
  Pending:   { label: "Pending",   text: "#6D28D9", bg: "#EDE9FE" },
  Viewed:    { label: "Viewed",    text: "#0369A1", bg: "#E0F2FE" },
  Accepted:  { label: "Accepted",  text: "#15803D", bg: "#DCFCE7" },
  Declined:  { label: "Declined",  text: "#B91C1C", bg: "#FEE2E2" },
  Deferred:  { label: "Deferred",  text: "#B45309", bg: "#FEF3C7" },
  Withdrawn: { label: "Withdrawn", text: "#374151", bg: "#F3F4F6" },
  Expired:   { label: "Expired",   text: "#6B7280", bg: "#F9FAFB" },
};

const SIGNAL_CHIP: Record<string, { label: string; text: string; bg: string }> = {
  connection_sent:  { label: "Connection Sent",  text: "#1D4ED8", bg: "#DBEAFE" },
  skipped:          { label: "Skipped",          text: "#374151", bg: "#F3F4F6" },
  irrelevant_flag:  { label: "Irrelevant Flag",  text: "#B91C1C", bg: "#FEE2E2" },
  deal_room_opened: { label: "Deal Room Opened", text: "#6D28D9", bg: "#EDE9FE" },
};

const ALGO_META: Record<string, { label: string; text: string; bg: string }> = {
  rule_based: { label: "Rule-Based",  text: "#0369A1", bg: "#E0F2FE" },
  ml_model:   { label: "ML Model",   text: "#6D28D9", bg: "#EDE9FE" },
};

const ROLE_LABEL: Record<string, string> = {
  STARTUP:  "Startup",
  INVESTOR: "Investor",
  B2B:      "B2B Enterprise",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, subtext, iconBg, iconColor,
}: {
  icon: string; label: string; value: string | number;
  subtext?: string; iconBg: string; iconColor: string;
}) {
  return (
    <Card surface="lowest" padding="md" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-on-surface-variant">{label}</p>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg }}
        >
          <Icon name={icon} size={20} style={{ color: iconColor } as React.CSSProperties} />
        </span>
      </div>
      <div>
        <p className="font-headline text-[2rem] font-extrabold leading-none tracking-tight text-on-surface">
          {value}
        </p>
        {subtext && <p className="mt-1.5 text-xs text-on-surface-variant">{subtext}</p>}
      </div>
    </Card>
  );
}

function VolumeCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card surface="lowest" padding="md" className="flex items-center gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon name={icon} size={22} className="text-primary" />
      </span>
      <div>
        <p className="font-headline text-2xl font-extrabold text-on-surface">{value.toLocaleString()}</p>
        <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
      </div>
    </Card>
  );
}

function ChipRow({
  items,
  meta,
  emptyText,
}: {
  items: { status?: string; action?: string; count: number }[];
  meta: Record<string, { label: string; text: string; bg: string }>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">{emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item) => {
        const key = (item.status ?? item.action) || "";
        const chip = meta[key] ?? { label: key, text: "#6B7280", bg: "#F3F4F6" };
        return (
          <div
            key={key}
            className="flex items-center gap-2 rounded-xl px-3.5 py-2"
            style={{ backgroundColor: chip.bg }}
          >
            <span className="text-xs font-semibold" style={{ color: chip.text }}>
              {chip.label}
            </span>
            <span
              className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white"
              style={{ backgroundColor: chip.text }}
            >
              {item.count > 999 ? "999+" : item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AvatarInitials({ name, photoKey }: { name: string; photoKey?: string | null }) {
  const letters = name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <Avatar photoKey={photoKey} alt={name} className="size-8 shrink-0 rounded-full">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
        {letters || "?"}
      </span>
    </Avatar>
  );
}

function PageBtn({ icon, disabled, onClick }: { icon: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MatchingEngineDashboardPage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();
  const [stats, setStats] = useState<MatchingEngineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isLoaded && !isStaffRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMatchingEngineStats()
      .then(setStats)
      .catch((err: ApiError) =>
        setError(err.message ?? "Couldn't load matching engine stats. Please try again."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() drives loading; runs once on mount
    if (isLoaded && isStaffRole(role)) load();
  }, [isLoaded, role, load]);

  const filtered = useMemo(() => {
    if (!stats) return [];
    const q = search.trim().toLowerCase();
    if (!q) return stats.zeroEngagementProfiles;
    return stats.zeroEngagementProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        (ROLE_LABEL[p.role] ?? p.role).toLowerCase().includes(q),
    );
  }, [stats, search]);

  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(safePage * PAGE_SIZE, total);

  const onSearch = (v: string) => { setSearch(v); setPage(1); };

  if (!isLoaded || !isStaffRole(role)) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-headline text-2xl font-extrabold tracking-[-0.02em] text-on-surface md:text-3xl">
          Matching Engine Dashboard
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Monitor match quality, track acceptance rates, and identify profiles with zero engagement.
        </p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={load} isEmpty={false}>
        {stats && (
          <div className="flex flex-col gap-6">

            {/* ── 1. Match Volume (FRD: total matches today/week/month) ── */}
            <div>
              <h2 className="mb-3 font-headline text-base font-bold text-on-surface">
                Match Generation Volume
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <VolumeCard label="Matches Today"      value={stats.matchesGenerated.today}     icon="today" />
                <VolumeCard label="Matches This Week"  value={stats.matchesGenerated.thisWeek}  icon="date_range" />
                <VolumeCard label="Matches This Month" value={stats.matchesGenerated.thisMonth} icon="calendar_month" />
              </div>
            </div>

            {/* ── 2. Core KPI Cards ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                icon="group" label="Profiles in Pool"
                value={stats.totalProfiles.toLocaleString()}
                subtext="Users with active roles"
                iconBg="#EFF6FF" iconColor="#1D4ED8"
              />
              <KpiCard
                icon="handshake" label="Acceptance Rate"
                value={`${stats.acceptanceRate}%`}
                subtext={`${stats.acceptedConnections.toLocaleString()} of ${stats.totalConnections.toLocaleString()} requests`}
                iconBg="#F0FDF4" iconColor="#15803D"
              />
              <KpiCard
                icon="forum" label="Active Deal Rooms"
                value={stats.activeDealRooms.toLocaleString()}
                subtext="Successful matches in progress"
                iconBg="#F5F3FF" iconColor="#6D28D9"
              />
              <KpiCard
                icon="analytics" label="Avg Compatibility Score"
                value={stats.avgCompatibilityScore != null ? `${stats.avgCompatibilityScore}%` : "—"}
                subtext={stats.avgCompatibilityScore != null ? "Across all shown matches" : "No match data yet"}
                iconBg="#FFF7ED" iconColor="#C2410C"
              />
            </div>

            {/* ── 3. Algorithm Distribution + Connection Breakdown (FRD: cold-start vs ML ratio) ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card surface="lowest" padding="md">
                <h2 className="mb-1 font-headline text-base font-bold text-on-surface">
                  Algorithm Distribution
                </h2>
                <p className="mb-4 text-xs text-on-surface-variant">
                  Cold-start (rule-based) vs. ML model ratio
                </p>
                {stats.algorithmDistribution.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No match events logged yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {stats.algorithmDistribution.map((item) => {
                      const meta = ALGO_META[item.algorithmType] ?? {
                        label: item.algorithmType, text: "#6B7280", bg: "#F3F4F6",
                      };
                      return (
                        <div key={item.algorithmType}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-semibold" style={{ color: meta.text }}>{meta.label}</span>
                            <span className="font-bold text-on-surface">
                              {item.count.toLocaleString()} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${item.percentage}%`, backgroundColor: meta.text }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card surface="lowest" padding="md">
                <h2 className="mb-4 font-headline text-base font-bold text-on-surface">
                  Connection Activity Breakdown
                </h2>
                <ChipRow
                  items={stats.connectionStatusBreakdown.map((i) => ({ status: i.status, count: i.count }))}
                  meta={STATUS_CHIP}
                  emptyText="No connection requests yet."
                />
              </Card>
            </div>

            {/* ── 4. Behavioral Signal Breakdown (FRD: accepts vs skips vs irrelevant flags) ── */}
            <Card surface="lowest" padding="md">
              <h2 className="mb-1 font-headline text-base font-bold text-on-surface">
                Behavioural Feedback Signals
              </h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                User actions taken on match recommendations — powers AI re-ranking
              </p>
              <ChipRow
                items={stats.behavioralSignals.map((i) => ({ action: i.action, count: i.count }))}
                meta={SIGNAL_CHIP}
                emptyText="No behavioural events logged yet — signals appear once users interact with matches."
              />
            </Card>

            {/* ── 5. Top Sectors by Match Volume (FRD: top sectors by match volume) ── */}
            {stats.topSectorsByVolume.length > 0 && (
              <Card surface="lowest" padding="md">
                <h2 className="mb-1 font-headline text-base font-bold text-on-surface">
                  Top Sectors by Match Volume
                </h2>
                <p className="mb-5 text-xs text-on-surface-variant">
                  Sectors generating the most match recommendations
                </p>
                <div className="flex flex-col gap-3">
                  {stats.topSectorsByVolume.map((item, i) => {
                    const max = stats.topSectorsByVolume[0]?.count ?? 1;
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.sector} className="flex items-center gap-4">
                        <span className="w-6 text-xs font-bold text-on-surface-variant">
                          #{i + 1}
                        </span>
                        <span className="w-36 truncate text-sm font-semibold text-on-surface">
                          {item.sector}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 text-right text-sm font-bold text-on-surface">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* ── 6. Zero-Engagement Profiles (FRD: profiles with zero matches) ── */}
            <div>
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-base font-bold text-on-surface">
                    Zero-Engagement Profiles
                  </h2>
                  {stats.zeroEngagementProfiles.length > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-extrabold text-amber-700">
                      {stats.zeroEngagementProfiles.length > 99 ? "99+" : stats.zeroEngagementProfiles.length}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  Users who have never sent or received a connection request — flagged for Admin review per FRD 12.3.
                </p>
              </div>

              <Card surface="lowest" padding="sm" className="mb-3">
                <Input
                  placeholder="Search by name, company or role…"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  adornment={<Icon name="search" size={18} />}
                />
              </Card>

              <Card surface="lowest" padding="none" className="overflow-hidden">
                {total === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-on-surface-variant">
                    <Icon name={search ? "search_off" : "check_circle"} size={36} />
                    <p className="text-sm">
                      {search
                        ? "No profiles match your search."
                        : "No zero-engagement profiles — everyone has been active!"}
                    </p>
                  </div>
                ) : (
                  <>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-outline/10 bg-surface-container-low text-left">
                          {["User", "Role", "Company", "Joined"].map((h) => (
                            <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline/10">
                        {pageRows.map((profile) => (
                          <tr key={profile.userId} className="transition-colors hover:bg-surface-container">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <AvatarInitials name={profile.name} photoKey={profile.profilePhoto} />
                                <span className="text-sm font-semibold text-on-surface">{profile.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-on-surface">
                              {ROLE_LABEL[profile.role] ?? profile.role}
                            </td>
                            <td className="px-5 py-4 text-sm text-on-surface-variant">{profile.company}</td>
                            <td className="px-5 py-4 text-sm text-on-surface-variant">
                              {profile.joinedAt
                                ? new Date(profile.joinedAt).toLocaleDateString([], {
                                    day: "numeric", month: "short", year: "numeric",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline/10 px-5 py-4">
                      <p className="text-sm text-on-surface-variant">
                        Showing {rangeStart}–{rangeEnd} of {total} profiles
                      </p>
                      <div className="flex items-center gap-1">
                        <PageBtn icon="chevron_left"  disabled={safePage <= 1}          onClick={() => setPage(safePage - 1)} />
                        <span className="px-3 text-sm font-semibold text-on-surface">{safePage} / {totalPages}</span>
                        <PageBtn icon="chevron_right" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} />
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>

          </div>
        )}
      </AsyncState>
    </div>
  );
}
