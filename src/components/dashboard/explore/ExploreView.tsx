"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProfileShortsDeck } from "@/components/dashboard/explore/ProfileShortsDeck";
import { ProfileGridView } from "@/components/dashboard/explore/ProfileGridView";
import { CompatibilityRing } from "@/components/dashboard/explore/CompatibilityRing";
import { fetchExploreMatches } from "@/services/explore.service";
import type { ExploreMatch } from "@/types/api.types";

/**
 * Explore container — owns the view switch between the immersive "Shorts Mode" swipe
 * deck (default) and the browse-all grid. A single floating button toggles between
 * them (on Shorts it offers "Grid", on Grid it offers "Shorts"). Only the active
 * view is mounted, so e.g. the deck's keyboard shortcuts don't fire on the grid.
 *
 * It also owns the **single** `GET /matching` call for the whole screen. The deck, the
 * grid and the allowance ring all read from it, so toggling between views costs no
 * network at all — previously each view fetched its own copy (and the ring a third),
 * re-emitting the entire 'shown' event burst on every toggle.
 */

type ExploreViewMode = "shorts" | "grid";

export function ExploreView() {
  const [view, setView] = useState<ExploreViewMode>("shorts");
  const [limit, setLimit] = useState({ remaining: 50, total: 50 });
  const [matches, setMatches] = useState<ExploreMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchExploreMatches()
      .then(({ matches: next, limit: nextLimit }) => {
        setMatches(next);
        setLimit(nextLimit);
      })
      .catch(() => setError("Couldn't load matches. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() drives loading state; runs once on mount
    load();
  }, [load]);

  const isShorts = view === "shorts";
  // The button switches to the *other* view.
  const target = isShorts
    ? { label: "Grid", icon: "grid_view", mode: "grid" as const }
    : { label: "Shorts", icon: "view_carousel", mode: "shorts" as const };

  return (
    <div className="relative flex h-full flex-col bg-surface">
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2 sm:right-6 sm:top-4 sm:gap-3">
        <button
          type="button"
          onClick={() => setView(target.mode)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container-high sm:px-4 sm:py-2 sm:text-sm"
        >
          <Icon name={target.icon} size={18} />
          {target.label}
        </button>

        <div className="group relative shrink-0">
          <CompatibilityRing value={limit.remaining} max={limit.total} size={40} className="text-primary" />
          {/* Themed hover flyout (replaces the native `title` tooltip, which ignores app theming). */}
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max max-w-[min(220px,calc(100vw-2rem))] scale-95 rounded-lg bg-surface-container-highest px-3 py-2 text-center text-xs font-medium text-on-surface opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
          >
            {limit.remaining} of {limit.total} connection requests left today
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isShorts ? (
          <ProfileShortsDeck matches={matches} loading={loading} error={error} onReload={load} />
        ) : (
          <ProfileGridView matches={matches} loading={loading} error={error} onReload={load} />
        )}
      </div>
    </div>
  );
}
