import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { clearSession, getSession } from "@/lib/auth-session";
import { SUSPENDED_ROUTE, parseSuspension, setSuspension, type SuspensionDetails } from "@/lib/suspension";

/**
 * Shared axios instance for all API calls.
 * Base URL comes from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
 * Auth tokens are httpOnly cookies now — withCredentials makes the browser attach
 * them automatically; there's no token for JS to read or set a header with.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  // timeout: 30000,
});

/** A normalized error shape surfaced to callers/UI. */
export interface ApiError {
  message: string;
  status?: number;
  data?: unknown;
}

// Guards against firing the logout/redirect more than once for a burst of 401s.
let isLoggingOut = false;

/**
 * On an expired/invalid token (401) anywhere in the app: clear the local session
 * metadata and bounce to the sign-in screen. Skipped on the auth screens
 * themselves (a 401 there is a normal "wrong credentials", not a dead session).
 * The httpOnly auth cookies themselves expire/get cleared server-side (logout,
 * natural expiry) — there's nothing for JS to clear here anymore.
 */
function handleUnauthorized() {
  if (typeof window === "undefined" || isLoggingOut) return;

  const path = window.location.pathname;
  if (
    path.startsWith("/login") ||
    path.startsWith("/admin/login") ||
    path.startsWith("/registration") ||
    // The reset flow uses a short-lived reset token; an expired one should surface
    // an inline error on the reset screen, not bounce the (logged-out) user away.
    path.startsWith("/reset-password")
  ) {
    return;
  }

  isLoggingOut = true;
  clearSession();
  toast.error("Your session has expired. Please sign in again.");
  // Send staff back to the admin sign-in, everyone else to the user sign-in.
  window.location.href = path.startsWith("/admin") ? "/admin/login" : "/login";
}

// Guards against a burst of 403s each trying to navigate.
let isSuspending = false;

/**
 * The backend's suspension block (403 from authMiddleware — see `lib/suspension.ts` for the
 * shape). Unlike `handleUnauthorized` this fires on every screen including the auth pages:
 * being told "suspended" is the whole point of that request.
 *
 * The 403 also clears the auth cookies server-side, so this response is the last thing we can
 * read about the account — its reason, plus whatever the dying session knew about the user,
 * is stashed for `/account-suspended` before the local session is dropped.
 */
function handleSuspended(details: SuspensionDetails) {
  if (typeof window === "undefined" || isSuspending) return;
  if (window.location.pathname.startsWith(SUSPENDED_ROUTE)) return;

  isSuspending = true;
  const session = getSession();
  setSuspension({
    ...details,
    name: session?.user?.name,
    email: session?.user?.email,
    role: session?.role,
  });
  clearSession();
  window.location.href = SUSPENDED_ROUTE;
}

// Normalize errors so callers get a predictable shape.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    // Suspension is checked first and wins: it's the more specific answer, and a suspension
    // that ever arrives as a 401 must still explain itself rather than degrade into the
    // generic "session expired" logout below.
    const suspension = parseSuspension(error.response?.status, error.response?.data);
    if (suspension) handleSuspended(suspension);
    else if (error.response?.status === 401) handleUnauthorized();

    let data: unknown = error.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = undefined;
      }
    }

    const normalized: ApiError = {
      // Show only the backend-provided message; fall back to a generic line so
      // raw axios/technical strings never reach the UI.
      message: (data as { message?: string } | undefined)?.message || "Something went wrong. Please try again.",
      status: error.response?.status,
      data,
    };
    return Promise.reject(normalized);
  }
);
