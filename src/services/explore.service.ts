import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { ExploreMatch, ExploreMatchesResponse } from "@/types/api.types";

/**
 * Explore data — the Matching Engine results powering the swipe deck + grid.
 *
 * Backed by the live `GET /api/v1/matching` endpoint; auth rides on the httpOnly
 * session cookie (the axios instance sets `withCredentials`).
 *
 * NOTE: matching-event logging (`POST /api/v1/matching/events`) was removed — the
 * route is not registered on the backend, so every call 404'd: one per match on each
 * Explore load, plus one per swipe. Bridge-Server HAS the controller written
 * (`controllers/matchingEventController.js`, model + repository too); it is simply
 * never mounted in `routes/matchingRoutes.js`, which only registers `/profiles`.
 * Re-add the calls here once that route exists — the Matching Engine admin dashboard
 * reads its stats from the events this used to write.
 */

/** Daily connection-request allowance. Carried on the same response as the matches —
 *  it is NOT a separate endpoint. */
export interface ExploreConnectionLimit {
  remaining: number;
  total: number;
}

export interface ExploreMatchesResult {
  matches: ExploreMatch[];
  limit: ExploreConnectionLimit;
}

/** Fetch the current profile's compatibility matches for the Explore views, together
 *  with the daily connection-request allowance that rides on the same response.
 *
 *  Both the deck/grid and the allowance ring used to call this endpoint separately,
 *  which downloaded the identical payload twice per page visit — they now share this
 *  single call (see ExploreView). The `?? 50` fallbacks apply only if the backend
 *  omits the limit fields entirely. */
export async function fetchExploreMatches(): Promise<ExploreMatchesResult> {
  const { data } = await api.get<ExploreMatchesResponse>(
    API_ENDPOINTS.MATCHING(),
  );
  const total = data.data.requestLimit ?? 50;
  return {
    matches: data.data.matches,
    limit: { total, remaining: data.data.requestsRemaining ?? total },
  };
}
