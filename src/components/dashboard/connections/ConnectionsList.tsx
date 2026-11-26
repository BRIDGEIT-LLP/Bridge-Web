"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { AsyncState } from "@/components/ui/AsyncState";
import { initials } from "@/lib/admin-format";
import { intentLabel } from "@/lib/connection-intent-options";
import {
  agoLabel,
  availableActions,
  avatarColor,
  rationaleReasons,
  requestBadge,
  roleLabelFor,
  type ConnectionTab,
} from "@/lib/connections";
import type { ConnectionRequest } from "@/types/api.types";
import type { Role } from "@/lib/roles";

/** Profile picture when there is one, else a round initials avatar in a name-hashed colour
 *  (prototype `.av`). Reused by the list and the detail drawer. */
export function ConnectionAvatar({
  name,
  size = 40,
  photoKey,
}: {
  name: string;
  /** Kept for call-site compatibility — the prototype colours avatars by name, not role. */
  role?: Role;
  size?: number;
  photoKey?: string | null;
}) {
  return (
    <Avatar
      photoKey={photoKey}
      alt={name}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full font-headline font-bold tracking-[0.02em] text-white"
        style={{ width: size, height: size, fontSize: size * 0.35, background: avatarColor(name) }}
      >
        {initials(name)}
      </div>
    </Avatar>
  );
}

/** Prototype `.btn` — `sm` size (32px tall, 12.5px / 600, 8px radius). */
const BTN =
  "inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} border-transparent bg-primary text-white hover:bg-[#0A49B0] disabled:bg-[#A8BFE8]`;
const BTN_SECONDARY = `${BTN} border-[#CFD6DF] bg-white text-primary hover:border-primary hover:bg-[#EAF1FC] disabled:border-[#E3E8EE] disabled:text-[#A8BFE8]`;
const BTN_GHOST = `${BTN} border-transparent bg-transparent text-[#5B6472] hover:bg-[#F6F8FA] hover:text-[#1A1F2B]`;

const EMPTY_COPY: Record<ConnectionTab, { title: string; text: string; cta: boolean }> = {
  received: { title: "No requests waiting", text: "When a member asks to meet you, it shows up here.", cta: false },
  sent: { title: "No requests waiting on a reply", text: "Requests you send from Introductions appear here.", cta: true },
  history: { title: "Nothing here yet", text: "Requests that have been answered or withdrawn appear here.", cta: true },
};

function EmptyState({ tab }: { tab: ConnectionTab }) {
  const { title, text, cta } = EMPTY_COPY[tab];
  return (
    <div className="rounded-[14px] border border-[#E3E8EE] bg-white p-5">
      <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-[#5B6472]">
        <span className="mb-1 grid size-11 place-items-center rounded-xl bg-[#EAF1FC] text-primary">
          <Icon name="inbox" size={22} />
        </span>
        <h3 className="font-headline text-base font-bold tracking-[-0.01em] text-[#1A1F2B]">{title}</h3>
        <p className="text-[12.5px]">{text}</p>
        {cta && (
          <Link href="/dashboard/explore" className={BTN_SECONDARY}>
            Browse introductions
          </Link>
        )}
      </div>
    </div>
  );
}

interface ConnectionsListProps {
  requests: ConnectionRequest[];
  tab: ConnectionTab;
  /** Open the detail drawer. */
  onSelect: (request: ConnectionRequest) => void;
  onAccept: (request: ConnectionRequest) => void;
  onDecline: (request: ConnectionRequest) => void;
  onWithdraw: (request: ConnectionRequest) => void;
  /** Id of a request whose inline action is in flight (disables its buttons). */
  busyId?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Stack of request cards laid out like the prototype's Requests page: one white card per
 * request (avatar + name/status + meta + fit score, the member's message, the "why we think
 * you should meet" box on pending received requests, and right-aligned actions).
 * Data source agnostic: the screen supplies the already tab-filtered requests and receives
 * callbacks.
 */
export function ConnectionsList({
  requests,
  tab,
  onSelect,
  onAccept,
  onDecline,
  onWithdraw,
  busyId,
  loading,
  error,
  onRetry,
}: ConnectionsListProps) {
  return (
    <AsyncState loading={!!loading} error={error ?? null} onRetry={onRetry} isEmpty={false}>
      {requests.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const actions = availableActions(r.direction, r.status);
            const busy = busyId === r.id;
            const badge = requestBadge(r);
            const reasons = r.direction === "received" && tab === "received" ? rationaleReasons(r.matchRationale).slice(0, 2) : [];
            const meta = [`${roleLabelFor(r.role)}${r.company ? `, ${r.company}` : ""}`, r.city].filter(Boolean).join(" · ");

            return (
              <li key={r.id} className="flex min-w-0 flex-col gap-[14px] rounded-[14px] border border-[#E3E8EE] bg-white p-5">
                <div className="flex items-start gap-[14px]">
                  <ConnectionAvatar name={r.name} size={40} photoKey={r.photoKey} />
                  <div className="min-w-0 flex-1">
                    <h3 className="flex flex-wrap items-center gap-2 font-headline text-[15px] font-bold tracking-[-0.01em] text-[#1A1F2B]">
                      <button type="button" onClick={() => onSelect(r)} className="text-left hover:underline">
                        {r.name}
                      </button>
                      {badge && (
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-body text-[11px] font-semibold leading-normal tracking-normal ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </h3>
                    <p className="text-[13px] text-[#5B6472]">{meta}</p>
                    <p className="mt-0.5 text-[13px] text-[#5B6472]">
                      {r.direction === "received" ? "Sent you" : "You sent"} a request
                      {r.intent ? ` · ${intentLabel(r.intent)}` : ""} · {agoLabel(r.createdAt)}
                    </p>
                  </div>
                  {typeof r.matchPercentage === "number" && (
                    <div className="flex flex-none flex-col items-end gap-0.5">
                      <b className="font-headline text-[22px] font-bold leading-none tabular-nums tracking-[-0.01em] text-primary">
                        {r.matchPercentage}%
                      </b>
                      <span className="text-[11px] text-[#5B6472]">fit</span>
                    </div>
                  )}
                </div>

                {r.message && <p className="rounded-lg bg-[#F6F8FA] px-3 py-2.5 text-[12.5px]">“{r.message}”</p>}

                {r.direction === "received" && r.status === "DECLINED" && r.declineReason && (
                  <p className="text-[12.5px] text-[#5B6472]">Reason: {r.declineReason}</p>
                )}

                {reasons.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-[10px] bg-[#F6F8FA] px-3.5 py-3">
                    <h4 className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-[#5B6472]">
                      Why we think you should meet
                    </h4>
                    <ul className="flex flex-col gap-1">
                      {reasons.map((reason) => (
                        <li key={reason} className="flex gap-2 text-[13px]">
                          <Icon name="check" size={13} className="mt-[3px] shrink-0 text-[#1F7A4D]" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1" />
                    {actions.includes("DECLINE") && (
                      <button type="button" disabled={busy} onClick={() => onDecline(r)} className={BTN_SECONDARY}>
                        Decline
                      </button>
                    )}
                    {actions.includes("ACCEPT") && (
                      <button type="button" disabled={busy} onClick={() => onAccept(r)} className={BTN_PRIMARY}>
                        Accept
                      </button>
                    )}
                    {actions.includes("WITHDRAW") && (
                      <button type="button" disabled={busy} onClick={() => onWithdraw(r)} className={BTN_GHOST}>
                        Withdraw
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AsyncState>
  );
}
