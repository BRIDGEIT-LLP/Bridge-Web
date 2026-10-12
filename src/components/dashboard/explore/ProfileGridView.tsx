"use client";

import { useState } from "react";
import { AsyncState } from "@/components/ui/AsyncState";
import { ProfileGridCard } from "@/components/dashboard/explore/ProfileGridCard";
import { MatchProfileModal } from "@/components/dashboard/explore/MatchProfileModal";
import { ProposalFormModal, type ProposalRecipient } from "@/components/dashboard/connections/ProposalFormModal";
import { useSenderIdentity } from "@/components/dashboard/connections/sender-identity";
import { normalizeRole } from "@/lib/roles";
import type { ExploreMatch } from "@/types/api.types";

interface ProfileGridViewProps {
  matches: ExploreMatch[];
  loading: boolean;
  error: string | null;
  /** Refetch the shared match list (Retry). Owned by ExploreView. */
  onReload: () => void;
}

/**
 * Explore **grid** view — the same matches as the "Shorts Mode" deck, shown as a
 * scrollable, responsive card grid for browsing. Presentational: the match list is
 * fetched once by `ExploreView` and passed in, so switching between grid and shorts
 * costs no network.
 */
export function ProfileGridView({ matches, loading, error, onReload }: ProfileGridViewProps) {
  /** Recipient for the open proposal modal; null = modal closed. */
  const [proposalRecipient, setProposalRecipient] = useState<ProposalRecipient | null>(null);
  /** Match whose full profile is open; null = closed. */
  const [profileMatch, setProfileMatch] = useState<ExploreMatch | null>(null);

  // Only fetched once the proposal modal is actually opened — most sessions never do.
  const { sender } = useSenderIdentity(proposalRecipient != null);

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-surface px-3 pb-4 pt-16 sm:px-6 sm:pb-6">
      <AsyncState
        loading={loading}
        error={error}
        onRetry={onReload}
        isEmpty={!loading && !error && matches.length === 0}
        emptyIcon="group_off"
        emptyText="No matches to explore right now."
      >
        <div className="flex flex-col gap-4 sm:gap-5">
          {matches.map((match) => (
            <ProfileGridCard
              key={match.profileId}
              match={match}
              onConnect={(m) =>
                setProposalRecipient({
                  id: m.profileId,
                  roleId: m.roleId,
                  companyId: m.companyId,
                  name: [m.first_name, m.last_name].filter(Boolean).join(" ").trim(),
                  company: m.organization_name,
                  role: normalizeRole(m.role),
                })
              }
              onViewProfile={setProfileMatch}
            />
          ))}
        </div>
      </AsyncState>

      {proposalRecipient && (
        <ProposalFormModal
          open
          recipient={proposalRecipient}
          sender={sender}
          onClose={() => setProposalRecipient(null)}
          // Refetch: the profile just requested drops out of the results, and the
          // connection allowance the ring shows has gone down by one.
          onSent={() => {
            setProposalRecipient(null);
            onReload();
          }}
        />
      )}

      <MatchProfileModal match={profileMatch} onClose={() => setProfileMatch(null)} />
    </div>
  );
}
