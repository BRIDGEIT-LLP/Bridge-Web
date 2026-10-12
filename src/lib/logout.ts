import { getSession, type Session } from "@/lib/auth-session";
import { clearUserProfileCache } from "@/services/user.service";
import { clearAdminProfileCache } from "@/services/admin.service";
import { clearFilePreviewCache } from "@/services/file.service";
import { API_ENDPOINTS } from "@/config/constant";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/**
 * Revoke the current session on the backend and wipe local state.
 *
 * Safe to call outside AuthProvider (registration KYC steps live there). The
 * access token is an httpOnly cookie, so the browser attaches it via
 * credentials: "include". Local cleanup always runs even if the network call
 * fails, so the user is never stuck signed in on this device.
 */
export async function logoutSession(role?: Session["role"] | null): Promise<void> {
  try {
    const resolvedRole = role ?? getSession()?.role;
    const isAdminRole = resolvedRole === "admin" || resolvedRole === "super_admin";
    const logoutPath = isAdminRole
      ? API_ENDPOINTS.ADMIN_SESSION_LOGOUT
      : API_ENDPOINTS.SESSION_LOGOUT;

    await fetch(`${API_BASE_URL}${logoutPath}`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore — local cleanup always completes below.
  }

  try {
    localStorage.clear();
  } catch {
    /* ignore storage unavailability */
  }
  clearUserProfileCache();
  clearAdminProfileCache();
  clearFilePreviewCache();
}
