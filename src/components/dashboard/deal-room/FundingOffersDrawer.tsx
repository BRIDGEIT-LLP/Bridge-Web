"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Drawer";
import { AsyncState } from "@/components/ui/AsyncState";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { fetchAllFundingOfferThreads } from "@/services/deal-room.service";
import { getCurrentUserId } from "@/lib/jwt";
import { formatDateTime } from "@/lib/utils";
import { FUNDING_OFFER_STATUS_META } from "./deal-room-meta";
import { OfferNegotiationTree } from "./OfferNegotiationTree";
import type { ApiError } from "@/lib/axios";
import type { DealFundingOffer } from "./types";

/** One label + value row inside the Current Offer card. */
function DetailRow({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-on-surface-variant">{label}</p>
        <p className="break-words text-sm font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

/** One negotiation thread's rows, oldest (root) first. */
interface OfferThreadGroup {
  rootOfferId: string;
  offers: DealFundingOffer[];
}

/** Group a flat, chronologically-ordered offer list into per-thread groups (keyed by
 *  rootOfferId, falling back to the row's own id for a thread's root row — matching
 *  backend semantics where a root offer's root_offer_id equals its own id). */
function groupByThread(offers: DealFundingOffer[]): OfferThreadGroup[] {
  const groups = new Map<string, DealFundingOffer[]>();
  for (const offer of offers) {
    const key = offer.rootOfferId ?? offer.id;
    const group = groups.get(key);
    if (group) {
      group.push(offer);
    } else {
      groups.set(key, [offer]);
    }
  }
  return Array.from(groups, ([rootOfferId, groupOffers]) => ({ rootOfferId, offers: groupOffers }));
}

interface NegotiationRoundProps {
  round: OfferThreadGroup;
  roundNumber: number;
  defaultOpen: boolean;
}

/** One collapsible "Round N" section — collapsed by default except the latest round,
 *  expands on click to reveal its connected offer tree. */
function NegotiationRound({ round, roundNumber, defaultOpen }: NegotiationRoundProps) {
  const [open, setOpen] = useState(defaultOpen);
  const first = round.offers[0];
  const last = round.offers[round.offers.length - 1];
  const statusMeta = FUNDING_OFFER_STATUS_META[last.status];

  return (
    <div className="rounded-xl border border-outline-variant/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="font-headline text-sm font-bold text-on-surface">Offer {roundNumber}</span>
          {first.sentAt && <span className="truncate text-xs text-on-surface-variant">Started {formatDateTime(first.sentAt)}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusPill icon={statusMeta.icon} label={statusMeta.label} />
          <Icon name={open ? "expand_less" : "expand_more"} size={20} className="text-on-surface-variant" />
        </span>
      </button>
      {open && (
        <div className="border-t border-outline-variant/30 p-3.5 pt-4">
          <OfferNegotiationTree offers={round.offers} />
        </div>
      )}
    </div>
  );
}

interface FundingOffersDrawerProps {
  open: boolean;
  onClose: () => void;
  dealRoomId: string;
  /** Bumped whenever an offer_received/_countered/_responded socket event lands, so an
   *  already-open drawer refetches live (mirrors MeetingsDrawer's dealRoomId-only
   *  refetch-on-open, extended with a live key since offers change more often mid-session). */
  refreshKey?: number;
  /** True once the deal is closed — disables all response actions. */
  /** The currently actionable offer, already fetched by DealSidePanel. */
  current: DealFundingOffer | null;
  closed?: boolean;
  /** True once the deal has moved past Negotiation — offers become view-only for both
   *  parties (server-enforced too), so Accept/Reject/Counter are hidden. */
  locked?: boolean;
  /** "current" (default) shows just the actionable Current Offer card — opened by
   *  clicking the panel's offer preview. "all" also loads and shows every past
   *  negotiation round below it — opened via the "View All" button. */
  view?: "current" | "all";
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  /** Hands the current offer up so the caller can open the counter-offer form prefilled. */
  onCounter: (offer: DealFundingOffer) => void;
}

/**
 * Right-side drawer for the deal room's funding-offer negotiation: the currently
 * actionable offer (with role-gated Accept/Reject/Counter) always on top, and — only
 * in "all" view — the full negotiation history (every past round) underneath.
 */
export function FundingOffersDrawer({
  open,
  onClose,
  dealRoomId,
  current,
  refreshKey,
  closed,
  locked,
  view = "current",
  onAccept,
  onReject,
  onCounter,
}: FundingOffersDrawerProps) {
  const [history, setHistory] = useState<DealFundingOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Only the negotiation HISTORY is fetched here. The current offer arrives as a prop
   *  from DealSidePanel, which already holds it — both used to hit
   *  `GET .../offers/current` simultaneously whenever an offer socket event bumped
   *  refreshKey. */
  const load = useCallback(async () => {
    if (view !== "all") {
      setHistory([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setHistory(await fetchAllFundingOfferThreads(dealRoomId));
    } catch (err) {
      setError((err as ApiError).message ?? "Couldn't load funding offers.");
    } finally {
      setLoading(false);
    }
  }, [dealRoomId, view]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state lives in load()
    if (open) load();
    // refreshKey: an offer socket event bumps it so an open drawer re-reads the history.
  }, [open, load, refreshKey]);

  const isRecipient = !!current && current.recipientUserId === getCurrentUserId();
  const canRespond = isRecipient && current?.status === "Pending" && !closed && !locked;

  return (
    <Drawer open={open} onClose={onClose} title="Funding Offer" subtitle="Active transaction" footer={null}>
      <AsyncState
        loading={loading}
        error={error}
        isEmpty={!current && history.length === 0}
        emptyIcon="handshake"
        emptyText="No funding offers yet."
        onRetry={load}
      >
        <div className="flex flex-col gap-6">
          {current && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="font-headline text-sm font-bold text-on-surface">Current Offer</h4>
                <StatusPill {...FUNDING_OFFER_STATUS_META[current.status]} />
              </div>

              <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <DetailRow icon="payments" label="Investment Amount" value={`${current.currency} ${current.amount.toLocaleString()}`} />
                <DetailRow icon="pie_chart" label="Equity Percentage" value={`${current.equityPercent}%`} />
                <DetailRow icon="request_quote" label="Company Valuation" value={current.valuationType} />
                <DetailRow
                  icon="event"
                  label="Offer Validity Period"
                  value={new Date(current.validUntil).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
                />
                {current.terms && <DetailRow icon="gavel" label="Terms & Conditions" value={current.terms} />}
                {current.notes && <DetailRow icon="notes" label="Supporting Notes" value={current.notes} />}
              </div>

              {canRespond ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onAccept(current.id)}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl cta-gradient font-bold text-on-primary"
                  >
                    <Icon name="check" size={16} />
                    Accept Offer
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onCounter(current)}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/50 font-bold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Icon name="swap_horiz" size={16} />
                      Counter
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(current.id)}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/50 font-bold text-on-surface-variant transition-colors hover:border-error/50 hover:text-error"
                    >
                      <Icon name="close" size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              ) : current.status === "Pending" ? (
                // Explain the missing actions instead of silently showing nothing — either
                // the deal has moved past Negotiation (locked), the room is closed, or I'm
                // the one who sent this offer (only the recipient may respond).
                <p className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                  <Icon name={locked && !closed ? "lock" : "hourglass_empty"} size={14} className="shrink-0" />
                  {closed
                    ? "This deal room is closed — no further action can be taken."
                    : locked
                      ? "Offers are locked — actions are only allowed during Negotiation."
                      : "Waiting for the other party to respond."}
                </p>
              ) : null}
            </section>
          )}

          {history.length > 0 &&
            (() => {
              // Rows arrive oldest-overall-first, so the first group is Round 1 —
              // render newest round first, expanded by default.
              const rounds = groupByThread(history).reverse();
              return (
                <section className="flex flex-col gap-2">
                  <h4 className="font-headline text-sm font-bold text-on-surface">Negotiation History</h4>
                  <div className="flex flex-col gap-2">
                    {rounds.map((round, i) => (
                      <NegotiationRound key={round.rootOfferId} round={round} roundNumber={rounds.length - i} defaultOpen={false} />
                    ))}
                  </div>
                </section>
              );
            })()}
        </div>
      </AsyncState>
    </Drawer>
  );
}
