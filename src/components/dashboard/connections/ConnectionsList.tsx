"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { AsyncState } from "@/components/ui/AsyncState";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { initials, timeAgo } from "@/lib/admin-format";
import { CONNECTION_STATUS_META, ROLE_AVATAR_GRADIENT, roleLabelFor, type StatusFilter } from "@/lib/connections";
import type { ConnectionRequest } from "@/types/api.types";
import type { Role } from "@/lib/roles";

/** Profile picture when there is one, else a role-tinted initials avatar. Reused by the
 *  list and the detail drawer. */
export function ConnectionAvatar({
  name,
  role,
  size = 40,
  photoKey,
}: {
  name: string;
  role: Role;
  size?: number;
  photoKey?: string | null;
}) {
  return (
    <Avatar
      photoKey={photoKey}
      alt={name}
      className="shrink-0 rounded-xl"
      style={{ width: size, height: size }}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ROLE_AVATAR_GRADIENT[role]} font-black text-white`}
        style={{ width: size, height: size, fontSize: size * 0.34 }}
      >
        {initials(name)}
      </div>
    </Avatar>
  );
}

interface ConnectionsListProps {
  requests: ConnectionRequest[];
  status: StatusFilter;
  onSelect: (request: ConnectionRequest) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Presentational list of connection requests — a Card list of clickable rows
 * (mirrors the KYC Review layout). Data source agnostic: the page supplies the
 * requests + loading/error, and gets a callback when a row is opened.
 */
export function ConnectionsList({ requests, status, onSelect, loading, error, onRetry }: ConnectionsListProps) {
  const filtered = status === "ALL" ? requests : requests.filter((r) => r.status === status);

  return (
    <Card surface="lowest" padding="none" className="overflow-hidden">
      <AsyncState
        loading={!!loading}
        error={error ?? null}
        onRetry={onRetry}
        isEmpty={!loading && !error && filtered.length === 0}
        emptyIcon="inbox"
        emptyText="No connection requests here yet."
      >
        <ul className="divide-y divide-outline/5">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-container-low sm:px-5 sm:py-3.5"
              >
                <ConnectionAvatar name={r.name} role={r.role} size={40} photoKey={r.photoKey} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">{r.name}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {roleLabelFor(r.role)} · {r.company}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
                    <StatusPill {...CONNECTION_STATUS_META[r.status]} />
                    <span className="text-xs text-on-surface-variant">{timeAgo(r.updatedAt)}</span>
                  </div>
                </div>
                <div className="hidden min-w-0 flex-1 md:block">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                    <Icon name="bolt" size={13} className="shrink-0" />
                    <span className="truncate">{r.intent}</span>
                  </span>
                </div>
                <span className="hidden shrink-0 text-xs text-on-surface-variant md:block">{timeAgo(r.updatedAt)}</span>
                <div className="hidden md:block">
                  <StatusPill {...CONNECTION_STATUS_META[r.status]} />
                </div>
                <Icon name="chevron_right" size={20} className="shrink-0 text-on-surface-variant" />
              </button>
            </li>
          ))}
        </ul>
      </AsyncState>
    </Card>
  );
}
