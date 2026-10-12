import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import { getUserId } from "@/lib/auth-session";
import { parseConnectionStatus } from "@/lib/connections";
import type { UserProfilePayload, BuildProfileResponse, UserSearchResult, ConnectionStatus } from "@/types/api.types";

/**
 * Create the user profile (complete-profile step).
 *
 * The payload keys are the backend `user` table columns (snake_case); the role is
 * derived from the JWT on the server, so it is not sent in the body. Auth rides on
 * the httpOnly session cookie (the axios instance sets `withCredentials`).
 */
export async function buildProfile(payload: UserProfilePayload): Promise<BuildProfileResponse> {
  const { data } = await api.post<BuildProfileResponse>(API_ENDPOINTS.BUILD_PROFILE, payload);
  clearUserProfileCache();
  return data;
}

/** One field returned by GET /api/v1/users/profile. */
export interface ProfileField {
  label: string;
  columnName: string;
  /**
   * The stored column value, straight off the row — so a numeric column
   * (`ticket_size_amt_min`, `number_of_investments_to_date`, `years_in_operation`, …)
   * arrives as a real JSON **number**, not a string. Normalize with the profile page's
   * `normalizeValue` before rendering; a raw number handed to an input renders blank.
   *
   * `founders` is the exception: jsonb `[{ name, url }, …]`, not a string list.
   */
  value: string | string[] | number | { name?: string; url?: string }[];
  isEditable: boolean;
  /** Input type: "string" | "number" | "url" | "email" | "textarea" | "array" | ... */
  type: string;
  /** Options available when type === "array" */
  options?: { value: string; label: string }[];
  /** Present on the switch-role form; GET /users/profile does not send this. */
  isRequired?: boolean;
}

export interface GetProfileResponse {
  success?: boolean;
  message?: string;
  data?: ProfileField[];
}

/** GET /api/v1/users/role-details payload: profile fields plus viewer↔target status. */
export interface ViewedUserProfile {
  fields: ProfileField[];
  connectionStatus: ConnectionStatus | null;
}

interface RoleDetailsPayload {
  fields?: ProfileField[];
  connection_status?: string | null;
}

export interface GetRoleDetailsResponse {
  success?: boolean;
  message?: string;
  data?: ProfileField[] | RoleDetailsPayload;
}

export interface SaveProfileResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Module-level cache for the CURRENT user's profile. It's session-stable, but several
 * unrelated components need it (My Profile, the Explore proposal modal, the public
 * profile page), so without this they each issue their own GET on every navigation.
 *
 * The *promise* is cached, not just the value, so simultaneous mounts — and React
 * StrictMode's double-invoke in dev — collapse into a single request. A rejection
 * evicts the entry immediately (see below) so a failed load never sticks and every
 * existing Retry button still works.
 */
let profileCache: { at: number; promise: Promise<GetProfileResponse> } | null = null;
const PROFILE_TTL_MS = 5 * 60_000;

/** Drop the cached profile. Called after a save, and on logout / role switch. */
export function clearUserProfileCache(): void {
  profileCache = null;
}

/**
 * Fetch the current user's profile fields from GET /api/v1/users/profile.
 * Auth rides on the httpOnly session cookie (`withCredentials`), not a header.
 *
 * Served from the module cache when it's younger than PROFILE_TTL_MS — call
 * `clearUserProfileCache()` after anything that changes the profile or the user.
 */
export function getUserProfile(): Promise<GetProfileResponse> {
  if (profileCache && Date.now() - profileCache.at < PROFILE_TTL_MS) {
    return profileCache.promise;
  }

  const promise = api
    .get<GetProfileResponse>(API_ENDPOINTS.GET_PROFILE)
    .then((res) => res.data)
    .catch((err) => {
      // Never cache a failure — drop the entry so the next call (a Retry button,
      // a remount) actually hits the network again.
      if (profileCache?.promise === promise) profileCache = null;
      throw err;
    });

  profileCache = { at: Date.now(), promise };
  return promise;
}

/**
 * Save / update the current user's profile (PUT /api/v1/users/profile).
 * API is not yet live — callers should show a toast rather than failing silently.
 */
export async function saveUserProfile(
  payload: Record<string, unknown>,
): Promise<SaveProfileResponse> {
  const { data } = await api.put<SaveProfileResponse>(API_ENDPOINTS.SAVE_PROFILE, payload);
  // The cached copy is now stale — the next getUserProfile() must refetch.
  clearUserProfileCache();
  return data;
}

/**
 * Navbar typeahead search (GET /api/v1/users/search?q=). Pass an AbortSignal so the
 * caller can cancel a stale in-flight request when the query changes again.
 */
export async function searchUsers(query: string, signal?: AbortSignal): Promise<UserSearchResult[]> {
  const { data } = await api.get<{ data?: UserSearchResult[] }>(API_ENDPOINTS.USERS_SEARCH, {
    params: { q: query },
    signal,
  });
  const currentUserId = getUserId();
  const results = data.data ?? [];
  return currentUserId ? results.filter((u) => u.user_id !== currentUserId) : results;
}

/**
 * Full role-scoped profile for one search result (GET /api/v1/users/role-details).
 * Returns the same `ProfileField[]` shape as `getUserProfile` (label/columnName/
 * value/isEditable/type), plus the live blocking connection status with the viewer.
 */
export async function getUserRoleDetails(params: {
  userId: string;
  companyId?: string;
  roleId: number;
}): Promise<ViewedUserProfile> {
  const { data } = await api.get<GetRoleDetailsResponse>(API_ENDPOINTS.USER_ROLE_DETAILS, { params });
  const payload = data.data;
  if (Array.isArray(payload)) {
    return { fields: payload, connectionStatus: null };
  }
  return {
    fields: payload?.fields ?? [],
    connectionStatus: parseConnectionStatus(payload?.connection_status ?? null),
  };
}

/* ----- Role switch ----------------------------------------------------------
 * Switching role changes which subset of the (single, wide) `user` row matters:
 * a Startup fills funding_stage / use_of_funds, an Investor fills investor_type /
 * ticket_size_amt_min. GET /auth/switch-role-details returns the target role's
 * field list (no company_user_role write). Unfilled fields are carried to the
 * form by `lib/switch-role-handoff.ts` and saved with POST /auth/request-role-switch.
 * See app/dashboard/switch-role/page.tsx.
 * -------------------------------------------------------------------------- */

/**
 * A field of the target role's profile, as rendered by the switch-role form.
 * Deliberately the same shape as `ProfileField` so `ProfileFieldRow` renders it
 * unchanged, plus the `isRequired` flag from the switch-role response.
 */
export interface SwitchRoleField extends ProfileField {
  isRequired?: boolean;
}