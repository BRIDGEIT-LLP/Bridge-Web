"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { AsyncState } from "@/components/ui/AsyncState";
import { ProfileCardFace, ProfileShortsCard } from "@/components/dashboard/explore/ProfileShortsCard";
import { ProposalFormModal, type ProposalRecipient } from "@/components/dashboard/connections/ProposalFormModal";
import { useSenderIdentity } from "@/components/dashboard/connections/sender-identity";
import { normalizeRole } from "@/lib/roles";
import type { ExploreDecision, ExploreMatch } from "@/types/api.types";

/**
 * The Explore "Shorts Mode" viewer. Shows one swipeable card at a time (with the next
 * one peeking behind for depth) and a fixed action bar. Decisions can come from a
 * drag, the action buttons, or the keyboard:
 *   ← Reject   → Connect   ↓ Skip
 *
 * The card visuals + gestures live in `ProfileShortsCard`; this component owns the
 * current index and the commanded-exit handshake so only one place advances the deck.
 * The queue itself is fetched once by `ExploreView` and passed in, so toggling to the
 * grid and back doesn't refetch.
 */

interface ActionConfig {
  decision: ExploreDecision;
  label: string;
  icon: string;
  /** Tailwind classes for the round (glass) button — sits over the dark card. */
  circle: string;
  /** Icon size in px. */
  iconSize: number;
}

const ACTIONS: ActionConfig[] = [
  {
    decision: "reject",
    label: "Reject",
    icon: "close",
    circle: "size-12 bg-white/10 border border-white/25 text-error backdrop-blur-md",
    iconSize: 22,
  },
  {
    decision: "skip",
    label: "Skip",
    icon: "expand_more",
    circle: "size-11 bg-white/10 border border-white/25 text-white/90 backdrop-blur-md",
    iconSize: 20,
  },
  {
    decision: "send",
    label: "Send",
    icon: "person_add",
    circle: "size-14 bg-white/10 border border-white/25 text-white backdrop-blur-md",
    iconSize: 24,
  },
];

interface ProfileShortsDeckProps {
  matches: ExploreMatch[];
  loading: boolean;
  error: string | null;
  /** Refetch the shared match list (Retry / "Start over"). Owned by ExploreView. */
  onReload: () => void;
}

export function ProfileShortsDeck({ matches, loading, error, onReload }: ProfileShortsDeckProps) {
  const [index, setIndex] = useState(0);
  /** When set, the active card animates out in that direction. */
  const [commandedExit, setCommandedExit] = useState<ExploreDecision | null>(null);
  /** Recipient for the open proposal modal; null = modal closed. */
  const [proposalRecipient, setProposalRecipient] = useState<ProposalRecipient | null>(null);

  // Only fetched once the proposal modal is actually opened — most sessions never do.
  const { sender } = useSenderIdentity(proposalRecipient != null);

  // A fresh list (first load, Retry, "Start over") always restarts the deck at the top.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the cursor is the point
    setIndex(0);
  }, [matches]);

  const current = matches[index];
  const next = matches[index + 1];

  /** Set when a request was just sent, so the exit handler knows to refetch. */
  const reloadAfterExit = useRef(false);

  // Card finished flying off screen → advance the deck.
  // The swipe used to POST /matching/events here; that route isn't registered on the
  // backend (see explore.service.ts), so it only ever 404'd. Re-add once it exists.
  const handleExit = useCallback(() => {
    setIndex((i) => i + 1);
    setCommandedExit(null);

    
    if (reloadAfterExit.current) {
      reloadAfterExit.current = false;
      onReload();
    }
  }, [onReload]);

  // Trigger an action from a button / keyboard (ignored mid-animation). "send"
  // opens the proposal modal instead of committing; reject/skip exit immediately.
  const commandAction = useCallback(
    (decision: ExploreDecision) => {
      if (!current || commandedExit || proposalRecipient != null) return;
      if (decision === "send") {
        setProposalRecipient({
          id: current.profileId,
          roleId: current.roleId,
          companyId: current.companyId,
          name: [current.first_name, current.last_name].filter(Boolean).join(" ").trim(),
          company: current.organization_name,
          role: normalizeRole(current.role),
        });
        return;
      }
      setCommandedExit(decision);
    },
    [current, commandedExit, proposalRecipient],
  );

  // Proposal sent → fly the card out ("send") so the deck advances via handleExit.
  const handleProposalSent = useCallback(() => {
    setProposalRecipient(null);
    reloadAfterExit.current = true;
    setCommandedExit("send");
  }, []);

  // Keyboard shortcuts: ← reject, → connect, ↓ skip.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") commandAction("reject");
      else if (e.key === "ArrowRight") commandAction("send");
      else if (e.key === "ArrowDown") commandAction("skip");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandAction]);

  const exhausted = !loading && !error && index >= matches.length;

  return (
    <div className="relative flex h-full min-h-[520px] w-full items-center justify-center overflow-hidden bg-surface px-3 pb-3 pt-16 sm:min-h-[640px] sm:px-4 sm:pb-4">
      <div className="relative h-full max-h-[820px] w-full max-w-md">
        <AsyncState
          loading={loading}
          error={error}
          onRetry={onReload}
          isEmpty={exhausted}
          emptyIcon="done_all"
          emptyText="You're all caught up — no more matches right now."
        >
          {/* Next card peeking behind for depth */}
          {next && (
            <div className="absolute inset-0 scale-[0.94] opacity-70">
              <ProfileCardFace match={next} />
            </div>
          )}
          {/* Active, swipeable card (keyed so each match mounts fresh) */}
          {current && (
            <ProfileShortsCard
              key={current.profileId}
              match={current}
              commandedExit={commandedExit}
              onExit={handleExit}
              onSendIntent={() => commandAction("send")}
            />
          )}
        </AsyncState>

        {/* Action buttons — transparent overlay pinned to the bottom of the card */}
        {current && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5">
            <div className="pointer-events-auto flex items-center gap-5">
              {ACTIONS.map((action) => (
                <button
                  key={action.decision}
                  type="button"
                  onClick={() => commandAction(action.decision)}
                  disabled={!!commandedExit}
                  className="group flex flex-col items-center gap-1.5 transition-transform active:scale-90 disabled:opacity-60"
                >
                  <span
                    className={`flex items-center justify-center rounded-full transition-transform group-hover:scale-110 ${action.circle}`}
                  >
                    <Icon
                      name={action.icon}
                      size={action.iconSize}
                      filled={action.decision === "send"}
                    />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/85">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* "All caught up" gets a restart affordance below the empty state */}
        {exhausted && (
          <div className="absolute inset-x-0 bottom-10 flex justify-center">
            <button
              type="button"
              onClick={onReload}
              className="flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-on-secondary transition-transform active:scale-95"
            >
              <Icon name="refresh" size={18} />
              Start over
            </button>
          </div>
        )}
      </div>

      {proposalRecipient && (
        <ProposalFormModal
          open
          recipient={proposalRecipient}
          sender={sender}
          onClose={() => setProposalRecipient(null)}
          onSent={handleProposalSent}
        />
      )}
    </div>
  );
}
