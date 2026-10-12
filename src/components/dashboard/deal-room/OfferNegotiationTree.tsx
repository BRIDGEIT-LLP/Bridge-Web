"use client";

import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/dashboard/kyc-status";
import { formatDateTime } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/jwt";
import { FUNDING_OFFER_STATUS_META } from "./deal-room-meta";
import type { DealFundingOffer } from "./types";

/** Show a party's name, "You" for the current user, or a "User #id" fallback when the
 *  backend didn't include the joined user (fullName() returns "" then — never render a
 *  blank "Sent by  to "). Mirrors the backend export service's `User #<id>` convention. */
function nameFor(name: string, userId: string): string {
  if (userId === getCurrentUserId()) return "You";
  return name.trim() || `User #${userId}`;
}

// Same colour language as DealStageStepper.tsx: inline styles because this Tailwind v4
// setup doesn't reliably generate arbitrary colour utilities.
const GREEN = "#15803d"; // Accepted
const RED = "#b3261e"; // Rejected
const BLUE = "#0c56d0"; // live/current node (matches --color-primary)
const TRACK = "#e4e9ea"; // connector + upcoming circle border
const MUTED = "#586064";

const NODE_COLOR: Record<DealFundingOffer["status"], string> = {
  Draft: MUTED,
  Pending: BLUE,
  Accepted: GREEN,
  Rejected: RED,
  Countered: MUTED,
};

/** Past-tense verb for the "who actioned it" sub-line, per terminal status. */
const RESPONSE_VERB: Partial<Record<DealFundingOffer["status"], string>> = {
  Accepted: "accepted",
  Rejected: "rejected",
  Countered: "countered",
};

const CIRCLE = 36;
const BAR = 3;

interface OfferNegotiationTreeProps {
  /** Every round of the negotiation thread, oldest (root) first. */
  offers: DealFundingOffer[];
}

/**
 * Vertical connected timeline of a deal room's funding-offer negotiation: the root
 * offer at top, each counter-offer below it connected by a line, ending in whatever
 * the latest round's status is (Pending/Accepted/Rejected/Countered). The data model
 * guarantees a single linear chain per deal room (only one Pending offer may exist at
 * a time), so this never branches.
 */
export function OfferNegotiationTree({ offers }: OfferNegotiationTreeProps) {
  if (offers.length === 0) return null;

  return (
    <div className="flex flex-col">
      {offers.map((offer, i) => {
        const isLast = i === offers.length - 1;
        const statusMeta = FUNDING_OFFER_STATUS_META[offer.status];
        const color = NODE_COLOR[offer.status];
        const responseVerb = RESPONSE_VERB[offer.status];

        return (
          <div key={offer.id} className="relative flex gap-3.5 pb-6 last:pb-0">
            {/* Connector from this circle down to the next one. */}
            {!isLast && (
              <span
                aria-hidden
                className="absolute rounded-full"
                style={{ left: (CIRCLE - BAR) / 2, top: CIRCLE, bottom: 0, width: BAR, backgroundColor: TRACK }}
              />
            )}

            {/* Circle */}
            <span
              className="relative z-10 flex shrink-0 items-center justify-center rounded-full text-white"
              style={{ width: CIRCLE, height: CIRCLE, backgroundColor: color }}
            >
              <Icon name={statusMeta.icon} size={17} />
            </span>

            {/* Node content */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.04em] text-on-surface-variant">
                  {offer.isCounterOffer ? `Counter · Version ${offer.version}` : "Original Offer"}
                </span>
                <StatusPill icon={statusMeta.icon} label={statusMeta.label} />
              </div>

              <p className="text-sm font-semibold text-on-surface">
                {offer.currency} {offer.amount.toLocaleString()} · {offer.equityPercent}% ({offer.valuationType})
              </p>

              {offer.sentAt && (
                <p className="text-xs text-on-surface-variant">
                  Sent by <span className="font-semibold text-on-surface">{nameFor(offer.offeredByName, offer.createdByUserId)}</span> to{" "}
                  <span className="font-semibold text-on-surface">{nameFor(offer.recipientName, offer.recipientUserId)}</span> ·{" "}
                  {formatDateTime(offer.sentAt)}
                </p>
              )}

              {offer.respondedAt && responseVerb && (
                <p className="text-xs text-on-surface-variant">
                  {offer.respondedByName != null && offer.respondedByUserId != null && (
                    <span className="font-semibold text-on-surface">{nameFor(offer.respondedByName, offer.respondedByUserId)} </span>
                  )}
                  {responseVerb} it · {formatDateTime(offer.respondedAt)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
