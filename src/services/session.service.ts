import { api } from "@/lib/axios";
import { API_ENDPOINTS } from "@/config/constant";
import type { Portal } from "@/services/auth.service";
import type {
  SessionLimitStatusResponse,
  RevokeSelectedSessionsPayload,
  RevokeSelectedSessionsResponse,
} from "@/types/api.types";

/**
 * Endpoint map per portal.
 * Both "admin" and "superadmin" portals hit the same `/api/v1/admin/sessions/` routes —
 * the backend distinguishes ADMIN vs SUPER_ADMIN via the token's userType claim,
 * not via different URLs.
 */
const SESSION_ENDPOINTS: Record<
  Portal,
  { limitStatus: string; revokeSelected: string }
> = {
  user: {
    limitStatus: API_ENDPOINTS.SESSION_LIMIT_STATUS,
    revokeSelected: API_ENDPOINTS.REVOKE_SELECTED_SESSIONS,
  },
  admin: {
    limitStatus: API_ENDPOINTS.ADMIN_SESSION_LIMIT_STATUS,
    revokeSelected: API_ENDPOINTS.ADMIN_REVOKE_SELECTED_SESSIONS,
  },
  superadmin: {
    limitStatus: API_ENDPOINTS.ADMIN_SESSION_LIMIT_STATUS,
    revokeSelected: API_ENDPOINTS.ADMIN_REVOKE_SELECTED_SESSIONS,
  },
};

/**
 * Check whether the signed-in user/admin has reached their active-session limit.
 * Called after MFA OTP verification, before redirecting to the dashboard.
 *
 * `portal` selects the correct backend endpoint group:
 *   - "user"       → GET /api/v1/sessions/limit-status
 *   - "admin"      → GET /api/v1/admin/sessions/limit-status
 *   - "superadmin" → GET /api/v1/admin/sessions/limit-status
 *
 * The access token is automatically attached by the shared axios request
 * interceptor — no extra headers needed at the call site.
 *
 * Response shapes:
 *   atLimit: false → proceed to dashboard as normal.
 *   atLimit: true  → show the session-chooser modal with `activeSessions`.
 */
export async function getSessionLimitStatus(
  portal: Portal = "user",
): Promise<SessionLimitStatusResponse> {
  const { data } = await api.get<SessionLimitStatusResponse>(
    SESSION_ENDPOINTS[portal].limitStatus,
  );
  return data;
}

/**
 * Revoke the sessions identified by the supplied IDs. Called from the session-
 * chooser modal after the user/admin selects one or more devices to log out.
 *
 * `portal` selects the correct backend endpoint group (same as above).
 *
 * The access token is automatically attached by the shared axios request
 * interceptor. On success the caller closes the modal and redirects to the
 * dashboard. On error the caller shows the backend message inside the modal.
 */
export async function revokeSelectedSessions(
  payload: RevokeSelectedSessionsPayload,
  portal: Portal = "user",
): Promise<RevokeSelectedSessionsResponse> {
  const { data } = await api.post<RevokeSelectedSessionsResponse>(
    SESSION_ENDPOINTS[portal].revokeSelected,
    payload,
  );
  return data;
}
